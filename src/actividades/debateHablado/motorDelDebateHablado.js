// Procesos del motor propios del DEBATE HABLADO: la ruleta de turnos, la exposición oral de cada
// argumento, el turno hablado de respaldo y los bids de intervención. Se extrajeron de
// motorDeSesion.js para que el motor base no dependa de una actividad concreta (ver
// docs/13-foro-escrito-y-nucleo-reutilizable.md): cada actividad aporta su propio juego de procesos
// y el motor base solo los llama.
//
// Reciben del motor base unos «servicios» (acceso al estado vigente, idempotencia, parámetros de
// puntaje) y devuelven los ganchos y las acciones que el motor expone a la consola del host.

import { EVENTOS, TIPOS_DE_BID, TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import {
  calcularPuntajeDeArgumento,
  calcularPuntajeDeTurnoVerbal,
  calcularPenalidadPorRechazoDeTurno,
} from '../../shared/puntaje/formulaDePuntaje.js';
import { calcularAjustesDeExposiciones } from '../../shared/puntaje/evaluacionDeExposiciones.js';
import { participantesSinIntervenir } from '../../shared/ingreso/reglasDeIngreso.js';

// Margen desde que arranca la fase antes de ofrecer el primer turno HABLADO de respaldo. El
// turno hablado es la salida para que el debate no quede en silencio cuando nadie preparó
// nada (docs/04), no la forma normal de abrir una ronda: sin esta espera se ofrecería en el
// mismo segundo en que empieza la fase, cuando todavía nadie pudo escribir.
const ESPERA_ANTES_DEL_TURNO_HABLADO_MS = 60 * 1000;
const MAX_FALLOS_CONSECUTIVOS_RULETA = 4;

// Una intervención hablada arranca valiendo el puntaje base de turno verbal; la calificación
// del co-moderador la ajusta. "Aceptable" la deja como está, así el ajuste es una corrección y
// no un segundo puntaje paralelo.
function ajustePorCalidadDeIntervencion(calidad, parametros) {
  const base = calcularPuntajeDeTurnoVerbal(parametros);
  if (calidad === 'buena') {
    return base;
  }
  if (calidad === 'insuficiente') {
    return -base;
  }
  return 0;
}

function sorteoPonderado(candidatos, pesos) {
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);
  let punto = Math.random() * pesoTotal;
  for (let indice = 0; indice < candidatos.length; indice += 1) {
    punto -= pesos[indice];
    if (punto <= 0) {
      return candidatos[indice];
    }
  }
  return candidatos[candidatos.length - 1];
}

// El límite de posiciones es siempre el total de valores base configurados (típicamente 3:
// 1ra/2da/3ra), independientemente de en qué ronda se completen — la ronda solo afecta el
// descuento de puntaje (ver calcularPuntajeDeArgumento), no el tope acumulado de posiciones.
function elegirCandidatoParaTurno(estado, presencia, limiteDePosiciones) {
  const candidatosPosibles = presencia
    .filter((presente) => presente.conectado !== false)
    .map((presente) => presente.participantId)
    .filter((participantId) => estado.participantes[participantId]?.rol !== 'co_moderador')
    // El stanceId se fija al confirmar el ingreso (ver IngresoConArgumento) — no se le puede
    // ofrecer turno a alguien sin postura.
    .filter((participantId) => Boolean(estado.participantes[participantId]?.stanceId))
    // Los oyentes (entraron a la sala pero nunca confirmaron su argumento de ingreso) miran
    // el debate, no participan de la ruleta — ver reglasDeIngreso.js.
    .filter((participantId) => estado.participantes[participantId]?.ingresoConfirmado)
    // El turno es para DEFENDER algo ya escrito, no una invitación a ponerse a escribir contra
    // reloj (docs/04): solo entra a la ruleta quien ya tiene un argumento listo esperando.
    .filter((participantId) => estado.participantes[participantId]?.argumentoListo)
    // Con el argumento publicado al aprobarse, quien ya tiene sus 3 posiciones puede tener la
    // tercera esperando exposición: ese sí debe poder defenderla. El tope solo deja fuera a quien
    // no tiene nada pendiente y ya completó todas sus posiciones.
    .filter(
      (participantId) =>
        Boolean(estado.participantes[participantId]?.argumentoPendienteId) ||
        (estado.participantes[participantId]?.posicionesCompletadas ?? 0) < limiteDePosiciones
    );

  if (candidatosPosibles.length === 0) {
    return null;
  }

  // La exclusión temporal prioriza a otros participantes tras un rechazo/timeout, pero si
  // ahora mismo TODOS los candidatos posibles están excluidos (ej. queda uno solo y ya
  // timeouteó), ignorarla es la única forma de no bloquear la ruleta para siempre.
  const sinExcluidos = candidatosPosibles.filter(
    (participantId) => !estado.turnos.excluidosTemporalmente.includes(participantId)
  );
  const elegibles = sinExcluidos.length > 0 ? sinExcluidos : candidatosPosibles;

  const sinTurnoPrincipal = elegibles.filter(
    (participantId) => (estado.participantes[participantId]?.turnosPrincipalesAceptados ?? 0) === 0
  );
  const poolBase = sinTurnoPrincipal.length > 0 ? sinTurnoPrincipal : elegibles;

  // Requisito: Priorizar diversidad de posturas en la primera fase / ronda inicial (Punto 3).
  // Si existen posturas que aún no han tenido representación en turnos aceptados,
  // priorizar candidatos de dichas posturas para asegurar cobertura entre las N posturas.
  const posturasConTurno = new Set(
    Object.values(estado.participantes)
      .filter((participante) => (participante.turnosPrincipalesAceptados ?? 0) > 0 && participante.stanceId)
      .map((participante) => participante.stanceId)
  );

  const dePosturasSinTurno = poolBase.filter(
    (participantId) => !posturasConTurno.has(estado.participantes[participantId]?.stanceId)
  );

  const pool = dePosturasSinTurno.length > 0 ? dePosturasSinTurno : poolBase;

  if (sinTurnoPrincipal.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const pesos = pool.map(
    (participantId) => 1 / (1 + (estado.participantes[participantId]?.turnosPrincipalesAceptados ?? 0))
  );
  return sorteoPonderado(pool, pesos);
}

export function crearProcesosDelDebateHablado(servicios) {
  const {
    programa,
    obtenerContexto,
    parametrosDePuntajeVigentes,
    yaSeHizo,
    comenzarAccion,
    estaCerrada,
    generarId,
    crearAcumuladorDePuntaje,
  } = servicios;

  const temporizadoresDeOferta = new Map(); // turnId -> timeoutId
  const temporizadoresDeBid = new Map(); // bidId -> timeoutId
  const ofertasYaExpiradas = new Set();

  function limiteDePosiciones() {
    return parametrosDePuntajeVigentes().valoresBasePosicion.length;
  }

  function ofrecerSiguienteTurnoSiHaceFalta() {
    const { estado, presencia, publicar } = obtenerContexto();
    if (!estado || estaCerrada()) {
      return;
    }
    if (estado.fase.actual?.tipo !== TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS) {
      return;
    }
    if (estado.turnos.ofertaActiva || estado.turnos.turnoEnCurso) {
      return;
    }
    if (estado.turnos.ruletaPausada) {
      return;
    }
    if ((estado.turnos.fallosConsecutivosDeOferta ?? 0) >= MAX_FALLOS_CONSECUTIVOS_RULETA) {
      publicar(EVENTOS.TURNO_RULETA_PAUSADA, {
        motivo: `Se han rechazado o vencido ${MAX_FALLOS_CONSECUTIVOS_RULETA} turnos consecutivos. Ruleta pausada automáticamente para evitar bucle infinito.`,
      });
      return;
    }

    const candidatoId = elegirCandidatoParaTurno(estado, presencia, limiteDePosiciones());

    // Nadie tiene un argumento listo. Si además queda gente que todavía no tomó la palabra, en
    // vez de dejar el debate en silencio se le ofrece un turno HABLADO sin argumento escrito:
    // vale pocos puntos y lo califica un co-moderador después (decisión del usuario, docs/04).
    if (!candidatoId) {
      // Recién arrancada la fase todavía nadie tuvo tiempo de preparar nada: ofrecer la
      // palabra en ese instante sería empujar a hablar sin argumento al primer segundo de la
      // ronda. Se espera un rato antes de caer al turno hablado de respaldo.
      const iniciadaEn = estado.fase.actual?.iniciadaEn ?? 0;
      if (Date.now() - iniciadaEn < ESPERA_ANTES_DEL_TURNO_HABLADO_MS) {
        return;
      }
      const sinIntervenir = participantesSinIntervenir(estado, presencia);
      const disponibles = sinIntervenir.filter(
        (participantId) => !estado.turnos.excluidosTemporalmente.includes(participantId)
      );
      // Misma salvedad que en la ruleta de argumentos: si TODOS los que faltan por hablar
      // están excluidos temporalmente, ignorar la exclusión es lo único que evita que el
      // turno hablado quede bloqueado para siempre.
      const candidatos = disponibles.length > 0 ? disponibles : sinIntervenir;
      if (candidatos.length > 0) {
        ofrecerTurnoVerbal(candidatos[Math.floor(Math.random() * candidatos.length)]);
      }
      return;
    }

    const rechazosDelCandidato = estado.participantes[candidatoId]?.rechazosAcumulados ?? 0;
    const turnId = generarId('turno');

    if (rechazosDelCandidato >= programa.maxRechazosAntesDeForzar) {
      publicar(EVENTOS.TURNO_FORZADO, { turnId, participantId: candidatoId });
      return;
    }

    const ofrecidoEn = Date.now();
    const expiraEn = ofrecidoEn + programa.timeoutAceptacion * 1000;
    publicar(EVENTOS.TURNO_OFRECIDO, { turnId, candidateId: candidatoId, ofrecidoEn, expiraEn, modo: 'argumento' });

    const timeoutId = setTimeout(() => {
      temporizadoresDeOferta.delete(turnId);
      if (obtenerContexto().estado?.turnos.ofertaActiva?.turnId === turnId) {
        obtenerContexto().publicar(EVENTOS.TURNO_EXPIRADO, { turnId, candidateId: candidatoId });
      }
    }, programa.timeoutAceptacion * 1000);
    temporizadoresDeOferta.set(turnId, timeoutId);
  }

  // El temporizador que hace expirar una oferta vive en memoria: si el host refresca la
  // pestaña con un turno ofrecido, ese temporizador se pierde y la oferta queda colgada para
  // siempre — nadie tiene la palabra y la ruleta no vuelve a girar. El motor nuevo adopta la
  // oferta que encuentra en el estado y la hace expirar en el plazo que le quedaba.
  function vigilarOfertaHuerfana() {
    const { estado, publicar } = obtenerContexto();
    const oferta = estado?.turnos.ofertaActiva;
    if (!oferta || temporizadoresDeOferta.has(oferta.turnId) || ofertasYaExpiradas.has(oferta.turnId)) {
      return;
    }

    const milisegundosRestantes = (oferta.expiraEn ?? 0) - Date.now();
    if (milisegundosRestantes <= 0) {
      ofertasYaExpiradas.add(oferta.turnId);
      publicar(EVENTOS.TURNO_EXPIRADO, { turnId: oferta.turnId, candidateId: oferta.candidateId });
      return;
    }

    const timeoutId = setTimeout(() => {
      temporizadoresDeOferta.delete(oferta.turnId);
      if (obtenerContexto().estado?.turnos.ofertaActiva?.turnId === oferta.turnId) {
        ofertasYaExpiradas.add(oferta.turnId);
        obtenerContexto().publicar(EVENTOS.TURNO_EXPIRADO, { turnId: oferta.turnId, candidateId: oferta.candidateId });
      }
    }, milisegundosRestantes);
    temporizadoresDeOferta.set(oferta.turnId, timeoutId);
  }

  // Turno hablado sin argumento escrito. Se ofrece solo cuando ya no queda ningún argumento
  // preparado por exponer y todavía hay gente que no tomó la palabra ni una vez.
  function ofrecerTurnoVerbal(candidatoId) {
    const { publicar } = obtenerContexto();
    const turnId = generarId('turno-verbal');
    const ofrecidoEn = Date.now();
    const expiraEn = ofrecidoEn + programa.timeoutAceptacion * 1000;

    publicar(EVENTOS.TURNO_OFRECIDO, { turnId, candidateId: candidatoId, ofrecidoEn, expiraEn, modo: 'verbal' });

    const timeoutId = setTimeout(() => {
      temporizadoresDeOferta.delete(turnId);
      if (obtenerContexto().estado?.turnos.ofertaActiva?.turnId === turnId) {
        obtenerContexto().publicar(EVENTOS.TURNO_EXPIRADO, { turnId, candidateId: candidatoId });
      }
    }, programa.timeoutAceptacion * 1000);
    temporizadoresDeOferta.set(turnId, timeoutId);
  }

  // Rechazar el turno cuesta puntos, y al estudiante se le avisa en el propio botón antes de
  // confirmar (docs/04). El descuento sale de la fórmula única, escalado por el perfil.
  function procesarRechazosDeTurno() {
    const { estado } = obtenerContexto();
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    const penalidad = calcularPenalidadPorRechazoDeTurno(parametrosDePuntajeVigentes());

    for (const { turnId, participantId } of estado.turnos.rechazos) {
      const clave = `penalidad-rechazo:${turnId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId,
        delta: penalidad,
        categoria: 'argumento',
        motivo: 'Rechazó el turno para defender su argumento',
        nuevoTotal: aplicarDelta(participantId, penalidad),
      });
    }
  }

  // El puntaje de una intervención hablada se acredita al registrarse, igual que el de un
  // argumento: no depende de que haya co-moderadores (ver el bug de las salas de 2). La
  // calificación posterior del co-moderador ajusta hacia arriba o hacia abajo.
  function procesarIntervencionesVerbales() {
    const { estado } = obtenerContexto();
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    const parametros = parametrosDePuntajeVigentes();

    for (const intervencion of Object.values(estado.intervencionesVerbales)) {
      const clave = `puntaje-intervencion:${intervencion.intervencionId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      const puntaje = calcularPuntajeDeTurnoVerbal(parametros);
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: intervencion.participantId,
        delta: puntaje,
        categoria: 'argumento',
        motivo: 'Intervención hablada sin argumento escrito',
        nuevoTotal: aplicarDelta(intervencion.participantId, puntaje),
      });
    }

    for (const intervencion of Object.values(estado.intervencionesVerbales)) {
      const clave = `calificacion-intervencion:${intervencion.intervencionId}`;
      if (!intervencion.calificacion || yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      const ajuste = ajustePorCalidadDeIntervencion(intervencion.calificacion.calidad, parametros);
      if (ajuste === 0) {
        continue;
      }
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: intervencion.participantId,
        delta: ajuste,
        categoria: 'argumento',
        motivo: `Intervención hablada calificada como ${intervencion.calificacion.calidad}`,
        nuevoTotal: aplicarDelta(intervencion.participantId, ajuste),
      });
    }
  }

  function procesarBidsResueltos() {
    const { estado } = obtenerContexto();
    if (!estado) {
      return;
    }

    for (const bid of Object.values(estado.bids)) {
      const clave = `bid-resuelto:${bid.bidId}`;
      if (!bid.decisionFinal || yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      if (bid.decisionFinal === 'aprobado') {
        const tipoDeclarado = bid.tipoDeBid === TIPOS_DE_BID.DESMONTAR ? 'contraargumento' : 'refuerzo';
        const stanceId = estado.participantes[bid.participantId]?.stanceId ?? null;
        const posicionEnRonda = (estado.participantes[bid.participantId]?.posicionesCompletadas ?? 0) + 1;
        const argumentId = generarId('argumento');

        publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
          argumentId,
          participantId: bid.participantId,
          turnId: bid.turnoPrincipalId,
          ronda: bid.ronda,
          posicionEnRonda,
          tipoDeclarado,
          argumentoObjetivoId: bid.argumentoObjetivoId,
          texto: bid.texto,
          stanceId,
          viaCoModerador: false,
        });
        // El puntaje base de este argumento lo acredita procesarArgumentosNuevos, igual que a
        // cualquier otro (misma fórmula de posición/ronda/vía) — publicarlo también aquí lo
        // puntuaba dos veces, porque ese argumentId no tenía todavía su clave de idempotencia.
        // Bug real reportado en prueba en vivo.

        // El bid ya conoce el objetivo exacto (no hace falta esperar una sugerencia de Groq
        // ni que el participante lo conecte a mano): se publica el link de una vez. Bug real
        // reportado en prueba en vivo — el argumento quedaba suelto, sin arista, en el grafo.
        publicar(EVENTOS.CONEXION_CREADA, {
          linkId: generarId('conexion'),
          sourceArgumentId: argumentId,
          targetArgumentId: bid.argumentoObjetivoId,
          tipoDeRelacion: tipoDeclarado,
          porParticipanteId: bid.participantId,
        });
      }

      // Los co-moderadores que votaron este bid puntúan al cerrar la sesión, junto con el resto de
      // sus revisiones, según su porcentaje de acierto (ver aplicarEvaluacionesDeExposiciones).
    }
  }

  function iniciarTemporizadoresDeBidsNuevos() {
    const { estado, publicar } = obtenerContexto();
    if (!estado) {
      return;
    }
    for (const bid of Object.values(estado.bids)) {
      if (bid.estado === 'abierto' && !temporizadoresDeBid.has(bid.bidId)) {
        const timeoutId = setTimeout(() => {
          temporizadoresDeBid.delete(bid.bidId);
          if (obtenerContexto().estado?.bids[bid.bidId]?.estado === 'abierto') {
            publicar(EVENTOS.BID_EVALUACION_EXPIRADA, { bidId: bid.bidId });
          }
        }, programa.tiempoLimiteEvaluacionBid * 1000);
        temporizadoresDeBid.set(bid.bidId, timeoutId);
      }
    }
  }

  // El "tópico" de bids de un turno se cierra cuando ya no quedan bids pendientes de
  // resolver (todos votados por todos los co-moderadores, o expirados) — ver docs/04.
  // Esto lo hacía nadie antes (bug real: los bids quedaban abiertos para siempre,
  // invisibles para el veredicto del host). El host también puede forzarlo manualmente
  // con cerrarTopicoDeBids() (botón "Cerrar tópico de bids ahora").
  function cerrarTopicosDeBidsResueltosAutomaticamente() {
    const { estado } = obtenerContexto();
    const numeroDeCoModeradores = estado.coModeradores?.participantIds.length ?? 0;
    if (numeroDeCoModeradores === 0) {
      return;
    }

    const bidsPendientesPorTurno = new Map();
    for (const bid of Object.values(estado.bids)) {
      if (bid.estado !== 'abierto' && bid.estado !== 'expirado') {
        continue;
      }
      if (!bidsPendientesPorTurno.has(bid.turnoPrincipalId)) {
        bidsPendientesPorTurno.set(bid.turnoPrincipalId, []);
      }
      bidsPendientesPorTurno.get(bid.turnoPrincipalId).push(bid);
    }

    for (const [turnoPrincipalId, bidsDelTurno] of bidsPendientesPorTurno) {
      const clave = `topico-bids:${turnoPrincipalId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      const yaNoQuedanPendientes = bidsDelTurno.every(
        (bid) => bid.estado === 'expirado' || Object.keys(bid.votos).length >= numeroDeCoModeradores
      );
      if (yaNoQuedanPendientes) {
        cerrarTopicoDeBids(turnoPrincipalId, comenzarAccion(clave));
      }
    }
  }

  function cerrarTopicoDeBids(turnoPrincipalId, publicarDeLaAccion = null) {
    const { estado } = obtenerContexto();
    const publicar = publicarDeLaAccion ?? obtenerContexto().publicar;
    const listaDeBidIds = Object.values(estado.bids)
      .filter((bid) => bid.turnoPrincipalId === turnoPrincipalId && bid.estado !== 'resuelto')
      .map((bid) => bid.bidId);
    if (listaDeBidIds.length === 0) {
      return;
    }
    publicar(EVENTOS.TOPICO_BIDS_CERRADOS, { turnoPrincipalId, listaDeBidIds, cerradoPor: 'moderador' });
  }

  function decidirBid(bidId, decisionFinal) {
    obtenerContexto().publicar(EVENTOS.BID_DECISION_MODERADOR, { bidId, decisionFinal });
  }

  // Libera la ruleta cuando quien tiene la palabra ya no la va a terminar (pestaña cerrada,
  // sin conexión, o se olvidó de publicar). El motor no ofrece turnos mientras haya uno abierto.
  function terminarTurnoEnCurso() {
    const turnoEnCurso = obtenerContexto().estado?.turnos.turnoEnCurso;
    if (!turnoEnCurso) {
      return;
    }
    obtenerContexto().publicar(EVENTOS.TURNO_TERMINADO_POR_HOST, {
      turnId: turnoEnCurso.turnId,
      participantId: turnoEnCurso.participantId,
    });
  }

  function pausarRuleta() {
    if (!obtenerContexto().estado || estaCerrada()) {
      return;
    }
    obtenerContexto().publicar(EVENTOS.TURNO_RULETA_PAUSADA, {
      motivo: 'Pausada manualmente por el moderador',
    });
  }

  function reanudarRuleta() {
    if (!obtenerContexto().estado || estaCerrada()) {
      return;
    }
    obtenerContexto().publicar(EVENTOS.TURNO_RULETA_REANUDADA, {});
  }

  // El puntaje provisional de un argumento sale de su posición, ronda y vía (docs/05).
  function calcularPuntajeProvisional(argumento) {
    const delta = calcularPuntajeDeArgumento(
      {
        posicionEnRonda: argumento.posicionEnRonda,
        ronda: argumento.ronda,
        viaCoModerador: argumento.viaCoModerador,
      },
      parametrosDePuntajeVigentes()
    );
    return { delta, motivo: `Argumento posición ${argumento.posicionEnRonda}, ronda ${argumento.ronda}` };
  }

  // Los ajustes que se aplican una sola vez, al cerrar la sesión: la exposición oral ajusta al
  // expositor y los co-moderadores puntúan por su acierto (docs/05).
  function calcularAjustesAlCierre(estado) {
    return calcularAjustesDeExposiciones({ estado, parametros: parametrosDePuntajeVigentes() });
  }

  function destruir() {
    for (const timeoutId of temporizadoresDeOferta.values()) clearTimeout(timeoutId);
    for (const timeoutId of temporizadoresDeBid.values()) clearTimeout(timeoutId);
    temporizadoresDeOferta.clear();
    temporizadoresDeBid.clear();
  }

  return {
    alSincronizarAntesDelPuntaje() {
      vigilarOfertaHuerfana();
      ofrecerSiguienteTurnoSiHaceFalta();
    },
    alSincronizarDespuesDelPuntaje() {
      procesarRechazosDeTurno();
      procesarIntervencionesVerbales();
      procesarBidsResueltos();
      iniciarTemporizadoresDeBidsNuevos();
      cerrarTopicosDeBidsResueltosAutomaticamente();
    },
    calcularPuntajeProvisional,
    calcularAjustesAlCierre,
    acciones: {
      cerrarTopicoDeBids,
      decidirBid,
      terminarTurnoEnCurso,
      pausarRuleta,
      reanudarRuleta,
    },
    destruir,
  };
}
