// Motor de sesión — corre SOLO en el cliente del host (autoridad única, ver plan de
// implementación). Ofrece turnos, dispara Groq-sugerencias al cerrar fase, calcula y
// publica todo el puntaje, y resuelve bids. El resto de clientes solo publican
// eventos "de intención" y reconstruyen su vista con el reducer (ver useEstadoDeSesion).

import { EVENTOS, TIPOS_DE_FASE, TIPOS_DE_BID } from '../shared/eventos/nombresDeEventos.js';
import {
  calcularPuntajeDeArgumento,
  calcularPuntajeDeTurnoVerbal,
  calcularNumeroDeCoModeradores,
  calcularBonosDeCoModerador,
  calcularPenalidadPorRechazoDeTurno,
  resolverParametrosDePuntaje,
} from '../shared/puntaje/formulaDePuntaje.js';
import { calcularAjustesDeExposiciones } from '../shared/puntaje/evaluacionDeExposiciones.js';
import { participantesSinIntervenir } from '../shared/ingreso/reglasDeIngreso.js';

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

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Margen desde que arranca la fase antes de ofrecer el primer turno HABLADO de respaldo. El
// turno hablado es la salida para que el debate no quede en silencio cuando nadie preparó
// nada (docs/04), no la forma normal de abrir una ronda: sin esta espera se ofrecería en el
// mismo segundo en que empieza la fase, cuando todavía nadie pudo escribir.
const ESPERA_ANTES_DEL_TURNO_HABLADO_MS = 60 * 1000;

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
    // Requisito de entrada: quien no logró un argumento aprobado en la apertura (agotadas
    // las dos rondas, ver EVENTOS.APERTURA_RONDA_CERRADA con esFinal:true) queda excluido de
    // la ruleta de turnos por el resto de la sesión — sin argumento, sin puntaje.
    .filter((participantId) => !estado.participantes[participantId]?.sinArgumentoDeApertura)
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
  const pool = sinTurnoPrincipal.length > 0 ? sinTurnoPrincipal : elegibles;

  if (sinTurnoPrincipal.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const pesos = pool.map(
    (participantId) => 1 / (1 + (estado.participantes[participantId]?.turnosPrincipalesAceptados ?? 0))
  );
  return sorteoPonderado(pool, pesos);
}

// El puntaje acumulado nunca baja de cero: una penalidad puede consumir lo que la persona
// tenía, no dejarla en deuda. Observado en prueba en vivo (alguien con 10 puntos rechazó un
// turno y quedó en −10): proyectado en el aula se lee como un castigo desproporcionado, y no
// cambia el ranking, que ordena por percentiles dentro de cada postura. El desincentivo real
// de rechazar sigue existiendo por otro lado: a los N rechazos consecutivos el turno se
// fuerza y hay que hablar igual (ver docs/04).
//
// El `delta` publicado conserva el valor nominal de la regla — así el export muestra la
// penalidad completa que se aplicó y el tope que la cortó, en vez de esconderla.
function crearAcumuladorDePuntaje(estado) {
  const totales = {};
  return function aplicarDelta(participantId, delta) {
    if (totales[participantId] === undefined) {
      totales[participantId] = estado.participantes[participantId]?.puntajeTotal ?? 0;
    }
    totales[participantId] = Math.max(0, totales[participantId] + delta);
    return totales[participantId];
  };
}

export function crearMotorDeSesion({ programa }) {
  // El perfil de puntaje lo elige el docente en la configuración, DESPUÉS de que el motor se
  // creó, y viaja en el Programa que se republica al iniciar sesión. Por eso los parámetros se
  // resuelven contra el Programa del canal en cada uso, no una sola vez al construir el motor.
  function parametrosDePuntajeVigentes() {
    return resolverParametrosDePuntaje(contexto.estado?.programa ?? programa);
  }
  const temporizadoresDeOferta = new Map(); // turnId -> timeoutId
  const temporizadoresDeBid = new Map(); // bidId -> timeoutId
  const ofertasYaExpiradas = new Set();

  // Cada acción irrepetible del motor (puntuar un argumento, resolver un bid, cerrar una
  // ronda) tiene una clave estable. El conjunto local cubre el lapso entre publicar y que el
  // evento vuelva por el canal; el log del estado cubre el caso grande: un host que refresca
  // la pestaña a mitad del debate y crea un motor nuevo, que sin esto volvía a puntuar todo
  // y a republicar el argumento de cada bid aprobado.
  const accionesDeEsteMotor = new Set();

  function yaSeHizo(clave) {
    return accionesDeEsteMotor.has(clave) || Boolean(contexto.estado?.accionesDelMotor?.[clave]);
  }

  // Marca la acción y devuelve un publicador que le pega la clave al PRIMER evento que emita
  // (una acción puede publicar varios eventos, o ninguno).
  function comenzarAccion(clave) {
    accionesDeEsteMotor.add(clave);
    let claveYaAdjuntada = false;
    return function publicarDeLaAccion(nombreDeEvento, datos) {
      const datosFinales = claveYaAdjuntada ? datos : { ...datos, claveDeIdempotencia: clave };
      claveYaAdjuntada = true;
      contexto.publicar(nombreDeEvento, datosFinales);
    };
  }

  let contexto = { estado: null, presencia: [], publicar: () => {} };

  function estaCerrada() {
    return Boolean(contexto.estado?.sesion?.cerrada);
  }

  // Mismo criterio que usa el host para mostrar la sala de configuración previa. Antes de que
  // arranque la primera fase, el perfil de puntaje elegido por el docente todavía puede no
  // estar publicado (se republica recién al hacer clic en "Iniciar sesión", ver ControlDeFases)
  // — puntuar un argumento de ingreso antes de eso lo deja fijado con parámetros por defecto
  // para siempre, aunque el docente después elija otro perfil. Bug real reportado en prueba en
  // vivo: el argumento de ingreso quedaba en la escala Liviana aunque se hubiera elegido
  // Estándar, porque se puntuaba en cuanto llegaba, no cuando el perfil ya era definitivo.
  function sesionIniciada() {
    const { estado } = contexto;
    return Boolean(estado?.fase.actual) || (estado?.fase.historial.length ?? 0) > 0;
  }

  function limiteDePosiciones() {
    return parametrosDePuntajeVigentes().valoresBasePosicion.length;
  }

  function esLaMismaEntradaDeFase(entradaDelPrograma, faseDelEstado) {
    return (
      entradaDelPrograma.tipo === faseDelEstado.tipo &&
      (entradaDelPrograma.ronda ?? null) === (faseDelEstado.ronda ?? null)
    );
  }

  // En qué punto del Programa está el debate, deducido del log de fases y no de un contador en
  // memoria. Con el contador, un host que refrescaba la pestaña arrancaba de nuevo en -1 y la
  // siguiente fase que cerrara mandaba el debate de vuelta a la primera fase del Programa.
  function indiceDeLaFaseMasReciente() {
    const { estado } = contexto;
    const recorridas = [...(estado?.fase.historial ?? [])];
    if (estado?.fase.actual) {
      recorridas.push(estado.fase.actual);
    }

    let indice = -1;
    for (const recorrida of recorridas) {
      indice += 1;
      while (indice < programa.fases.length && !esLaMismaEntradaDeFase(programa.fases[indice], recorrida)) {
        indice += 1;
      }
      if (indice >= programa.fases.length) {
        return programa.fases.length;
      }
    }
    return indice;
  }

  function ofrecerSiguienteTurnoSiHaceFalta() {
    const { estado, presencia, publicar } = contexto;
    if (!estado || estaCerrada()) {
      return;
    }
    if (estado.fase.actual?.tipo !== TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS) {
      return;
    }
    if (estado.turnos.ofertaActiva || estado.turnos.turnoEnCurso) {
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
      if (contexto.estado?.turnos.ofertaActiva?.turnId === turnId) {
        contexto.publicar(EVENTOS.TURNO_EXPIRADO, { turnId, candidateId: candidatoId });
      }
    }, programa.timeoutAceptacion * 1000);
    temporizadoresDeOferta.set(turnId, timeoutId);
  }

  // El temporizador que hace expirar una oferta vive en memoria: si el host refresca la
  // pestaña con un turno ofrecido, ese temporizador se pierde y la oferta queda colgada para
  // siempre — nadie tiene la palabra y la ruleta no vuelve a girar. El motor nuevo adopta la
  // oferta que encuentra en el estado y la hace expirar en el plazo que le quedaba.
  function vigilarOfertaHuerfana() {
    const { estado, publicar } = contexto;
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
      if (contexto.estado?.turnos.ofertaActiva?.turnId === oferta.turnId) {
        ofertasYaExpiradas.add(oferta.turnId);
        contexto.publicar(EVENTOS.TURNO_EXPIRADO, { turnId: oferta.turnId, candidateId: oferta.candidateId });
      }
    }, milisegundosRestantes);
    temporizadoresDeOferta.set(oferta.turnId, timeoutId);
  }

  // Turno hablado sin argumento escrito. Se ofrece solo cuando ya no queda ningún argumento
  // preparado por exponer y todavía hay gente que no tomó la palabra ni una vez.
  function ofrecerTurnoVerbal(candidatoId) {
    const { publicar } = contexto;
    const turnId = generarId('turno-verbal');
    const ofrecidoEn = Date.now();
    const expiraEn = ofrecidoEn + programa.timeoutAceptacion * 1000;

    publicar(EVENTOS.TURNO_OFRECIDO, { turnId, candidateId: candidatoId, ofrecidoEn, expiraEn, modo: 'verbal' });

    const timeoutId = setTimeout(() => {
      temporizadoresDeOferta.delete(turnId);
      if (contexto.estado?.turnos.ofertaActiva?.turnId === turnId) {
        contexto.publicar(EVENTOS.TURNO_EXPIRADO, { turnId, candidateId: candidatoId });
      }
    }, programa.timeoutAceptacion * 1000);
    temporizadoresDeOferta.set(turnId, timeoutId);
  }

  // Rechazar el turno cuesta puntos, y al estudiante se le avisa en el propio botón antes de
  // confirmar (docs/04). El descuento sale de la fórmula única, escalado por el perfil.
  function procesarRechazosDeTurno() {
    const { estado } = contexto;
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
    const { estado } = contexto;
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

  // El puntaje base de un argumento (posición × ronda × vía, ver docs/05) NO depende de que un
  // co-moderador lo revise: se acredita apenas el argumento entra al canal. Antes estaba
  // acoplado a `argument.validated`, así que en una sala sin co-moderadores (n=2, donde el
  // sorteo correctamente asigna 0) nadie podía validar nada y el marcador quedaba en 0 para
  // todos, para siempre. Bug real reportado en prueba en vivo.
  function procesarArgumentosNuevos() {
    const { estado } = contexto;
    if (!estado || !sesionIniciada()) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);

    for (const argumento of Object.values(estado.argumentos)) {
      const clave = `puntaje-argumento:${argumento.argumentId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      const puntajeBase = calcularPuntajeDeArgumento(
        {
          posicionEnRonda: argumento.posicionEnRonda,
          ronda: argumento.ronda,
          viaCoModerador: argumento.viaCoModerador,
        },
        parametrosDePuntajeVigentes()
      );
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: argumento.participantId,
        delta: puntajeBase,
        categoria: 'argumento',
        motivo: `Argumento posición ${argumento.posicionEnRonda}, ronda ${argumento.ronda}`,
        nuevoTotal: aplicarDelta(argumento.participantId, puntajeBase),
      });
    }
  }

  // Bonos de co-moderación: se acreditan recién cuando un co-moderador revisa el argumento.
  // Si quien validó fue el moderador desde su consola (respaldo cuando no hay co-moderadores),
  // la revisión vale para el registro pero no reparte bonos — el host no es participante.
  function procesarValidacionesDeCoModerador() {
    const { estado } = contexto;
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    const PUNTAJE_DE_COMODERADOR = calcularBonosDeCoModerador(parametrosDePuntajeVigentes());

    for (const argumento of Object.values(estado.argumentos)) {
      const clave = `validacion-comoderador:${argumento.argumentId}`;
      if (!argumento.validacion || yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      const { coModeradorId, tipoFinal, faltaMarcada, nota } = argumento.validacion;
      if (estado.participantes[coModeradorId]?.rol !== 'co_moderador') {
        continue;
      }
      if (tipoFinal && tipoFinal !== argumento.tipoDeclarado) {
        publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
          participantId: coModeradorId,
          delta: PUNTAJE_DE_COMODERADOR.RECLASIFICACION_CORRECTA,
          categoria: 'co_moderacion',
          motivo: 'Reclasificación correcta de tipo de relación',
          nuevoTotal: aplicarDelta(coModeradorId, PUNTAJE_DE_COMODERADOR.RECLASIFICACION_CORRECTA),
        });
      }
      if (argumento.viaCoModerador) {
        publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
          participantId: coModeradorId,
          delta: PUNTAJE_DE_COMODERADOR.CASO_ESCALADO_RATIFICADO,
          categoria: 'co_moderacion',
          motivo: 'Caso escalado por Groq, ratificado por co-moderador',
          nuevoTotal: aplicarDelta(coModeradorId, PUNTAJE_DE_COMODERADOR.CASO_ESCALADO_RATIFICADO),
        });
      }
      if (faltaMarcada) {
        const bono = nota?.trim()
          ? PUNTAJE_DE_COMODERADOR.FALTA_DETECTADA_CON_JUSTIFICACION
          : PUNTAJE_DE_COMODERADOR.FALTA_SIN_JUSTIFICAR_O_REVERTIDA;
        publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
          participantId: coModeradorId,
          delta: bono,
          categoria: 'co_moderacion',
          motivo: nota?.trim() ? 'Falta marcada con justificación' : 'Falta marcada sin justificación',
          nuevoTotal: aplicarDelta(coModeradorId, bono),
        });
      }
    }
  }

  function procesarBidsResueltos() {
    const { estado } = contexto;
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    const PUNTAJE_DE_COMODERADOR = calcularBonosDeCoModerador(parametrosDePuntajeVigentes());

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

      for (const [coModeradorId, voto] of Object.entries(bid.votos)) {
        const votoCoincideConDecision =
          (voto === 'aprueba' && bid.decisionFinal === 'aprobado') ||
          (voto === 'rechaza' && bid.decisionFinal === 'rechazado');
        if (votoCoincideConDecision) {
          publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
            participantId: coModeradorId,
            delta: PUNTAJE_DE_COMODERADOR.VOTO_DE_BID_COINCIDENTE,
            categoria: 'co_moderacion',
            motivo: 'Voto de bid coincidió con la decisión del moderador',
            nuevoTotal: aplicarDelta(coModeradorId, PUNTAJE_DE_COMODERADOR.VOTO_DE_BID_COINCIDENTE),
          });
        }
      }
    }
  }

  function iniciarTemporizadoresDeBidsNuevos() {
    const { estado, publicar } = contexto;
    if (!estado) {
      return;
    }
    for (const bid of Object.values(estado.bids)) {
      if (bid.estado === 'abierto' && !temporizadoresDeBid.has(bid.bidId)) {
        const timeoutId = setTimeout(() => {
          temporizadoresDeBid.delete(bid.bidId);
          if (contexto.estado?.bids[bid.bidId]?.estado === 'abierto') {
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
    const { estado } = contexto;
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

  // Participantes que deberían escribir el argumento de apertura: todos los conectados menos
  // co-moderadores. OJO: no filtrar por stanceId — con asignacionPostura:"libre" alguien que
  // todavía no eligió postura tiene posicionesCompletadas=0 y por eso nunca puede haber
  // "escrito" (bug real ya corregido una vez: filtrarlo lo excluía del conteo). Se lo cuenta
  // igual, así "todos listos" espera también a esa persona.
  function participantesElegiblesParaApertura() {
    const { estado, presencia } = contexto;
    return presencia
      .filter((presente) => presente.conectado !== false)
      .map((presente) => presente.participantId)
      .filter((participantId) => estado.participantes[participantId]?.rol !== 'co_moderador');
  }

  function tieneArgumentoDeApertura(estado, participantId) {
    return (estado.participantes[participantId]?.posicionesCompletadas ?? 0) >= 1;
  }

  // Fase de apertura simultánea (docs/09): requisito de entrada antes de empezar el debate en
  // sí. Máquina de rondas gestionada por el HOST, no por temporizadores automáticos — nadie se
  // fuerza a cerrar solo: al vencer el tiempo de una ronda con pendientes, el motor espera a
  // que el moderador decida (dar 1 minuto más, cerrar ya, o dar/negar la segunda oportunidad).
  // Ronda 1 (duracionMin del Programa, con gracia opcional de 1 min) → si quedan pendientes,
  // decisión del host → ronda 2 (1 min fijo, solo para quienes faltan) → corte definitivo: sin
  // argumento aprobado en ninguna ronda = sin puntaje y fuera de la ruleta de turnos
  // (ver elegirCandidatoParaTurno).
  function gestionarFaseDeAperturaSiHaceFalta() {
    const { estado } = contexto;
    const faseActual = estado.fase.actual;
    if (!faseActual || faseActual.tipo !== TIPOS_DE_FASE.APERTURA_SIMULTANEA) {
      return;
    }

    const elegibles = participantesElegiblesParaApertura();
    if (elegibles.length === 0) {
      return;
    }

    const claveDeInicio = `apertura-iniciada:${faseActual.iniciadaEn}`;
    if (!yaSeHizo(claveDeInicio)) {
      const publicar = comenzarAccion(claveDeInicio);
      const entradaDeFase = programa.fases.find((fase) => fase.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA);
      const duracionMs = (entradaDeFase?.duracionMin ?? 5) * 60 * 1000;
      const iniciadaEn = Date.now();
      publicar(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn, expiraEn: iniciadaEn + duracionMs });
      return;
    }

    if (!estado.apertura || estado.apertura.cerrada) {
      return;
    }

    const claveDeRonda = `apertura-ronda-cerrada:${faseActual.iniciadaEn}:${estado.apertura.ronda}`;
    if (yaSeHizo(claveDeRonda)) {
      return;
    }
    const todosListos = elegibles.every((participantId) => tieneArgumentoDeApertura(estado, participantId));
    if (todosListos) {
      // Nadie quedó pendiente — se cierra sola, sin molestar al host con una pregunta vacía.
      // La acción se marca ANTES de publicar: publicar es async (viaja por Ably), así que sin
      // esto varios ticks de sincronizar() de por medio publicarían el mismo cierre repetidas
      // veces hasta que estado.apertura.cerrada refleje la vuelta del evento.
      cerrarRondaDeApertura({ publicarDeLaAccion: comenzarAccion(claveDeRonda) });
    }
  }

  // El host cierra la ronda de apertura vigente. Con pendientes en ronda 1 esto NO es
  // definitivo — solo pausa a esperar la decisión de dar o no la segunda oportunidad (ver
  // `esperandoSegundaOportunidad` en el reducer). En ronda 2, o si no quedan pendientes, o si
  // `forzarFinal` viene true (el host declinó la segunda oportunidad), es el corte definitivo.
  function cerrarRondaDeApertura({ forzarFinal = false, publicarDeLaAccion = null } = {}) {
    const { estado } = contexto;
    const publicar = publicarDeLaAccion ?? contexto.publicar;
    if (!estado.apertura) {
      return;
    }
    const elegibles = participantesElegiblesParaApertura();
    const aprobados = elegibles.filter((participantId) => tieneArgumentoDeApertura(estado, participantId));
    const pendientes = elegibles.filter((participantId) => !tieneArgumentoDeApertura(estado, participantId));
    const rondaActual = estado.apertura.ronda;
    const esFinal = forzarFinal || rondaActual === 2 || pendientes.length === 0;

    publicar(EVENTOS.APERTURA_RONDA_CERRADA, { ronda: rondaActual, aprobados, pendientes, esFinal });
    if (esFinal) {
      cerrarFaseActual();
    }
  }

  // Da 1 minuto extra dentro de ronda 1 (el host consultó a los estudiantes y hacen falta más
  // segundos) — no crea una ronda nueva, solo extiende el plazo vigente.
  function extenderRondaDeApertura() {
    const { estado, publicar } = contexto;
    if (!estado.apertura || estado.apertura.ronda !== 1 || estado.apertura.cerrada) {
      return;
    }
    publicar(EVENTOS.APERTURA_RONDA_EXTENDIDA, { ronda: 1, hasta: Date.now() + 60 * 1000 });
  }

  // Segunda oportunidad: solo válida tras cerrar ronda 1 con pendientes (esperandoSegundaOportunidad).
  // 1 minuto fijo, y esta vez el cierre siempre es definitivo (cerrarRondaDeApertura ya lo sabe
  // por `rondaActual === 2`).
  function abrirSegundaOportunidadDeApertura() {
    const { estado, publicar } = contexto;
    if (!estado.apertura?.esperandoSegundaOportunidad) {
      return;
    }
    const iniciadaEn = Date.now();
    publicar(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 2, iniciadaEn, expiraEn: iniciadaEn + 60 * 1000 });
  }

  function sincronizar({ estado, presencia, publicar }) {
    contexto = { estado, presencia, publicar };
    if (!estado || estaCerrada()) {
      return;
    }
    vigilarOfertaHuerfana();
    ofrecerSiguienteTurnoSiHaceFalta();
    procesarArgumentosNuevos();
    procesarValidacionesDeCoModerador();
    procesarRechazosDeTurno();
    procesarIntervencionesVerbales();
    procesarBidsResueltos();
    iniciarTemporizadoresDeBidsNuevos();
    cerrarTopicosDeBidsResueltosAutomaticamente();
    gestionarFaseDeAperturaSiHaceFalta();
  }

  function iniciarSesion() {
    const { estado, presencia, publicar } = contexto;
    // Quien está conectado pero aún no confirmó su ingreso sigue como oyente: no participa del
    // debate, así que tampoco entra al sorteo (si no, quedaba como co-moderador y oyente a la vez).
    const participantesElegibles = presencia
      .filter((presente) => presente.conectado !== false)
      .map((presente) => presente.participantId)
      .filter((participantId) => estado?.participantes[participantId]?.ingresoConfirmado);
    const numeroDeCoModeradoresCalculado = calcularNumeroDeCoModeradores(
      participantesElegibles.length,
      programa.topeMaximoCoModeradores
    );
    // Bug real confirmado en prueba con 1 participante: ceil(n×0.10) con mínimo 1 puede
    // convertir a TODOS los presentes en co-moderadores, dejando cero argumentadores (nadie
    // puede escribir nada). Un debate necesita al menos 2 personas defendiendo postura —
    // el sorteo de co-moderadores nunca debe comerse más de participantesElegibles.length-2.
    const numeroDeCoModeradores = Math.min(
      numeroDeCoModeradoresCalculado,
      Math.max(0, participantesElegibles.length - 2)
    );
    const coModeradoresSorteados = [...participantesElegibles]
      .sort(() => Math.random() - 0.5)
      .slice(0, numeroDeCoModeradores);

    publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
      participantIds: coModeradoresSorteados,
      formulaUsada: 'ceil(n * 0.10)_min_1',
      totalParticipantes: participantesElegibles.length,
    });

    // La postura ya se asignó al confirmar el ingreso (ver IngresoConArgumento.jsx): con
    // asignación aleatoria, `elegirPosturaMenosRepresentada` la fijó de forma balanceada antes
    // de escribir el argumento; con "libre", el estudiante la eligió. Reasignarla aquí por
    // round-robin (como se hacía antes de que el ingreso incluyera la postura) le pisaba la
    // postura ya elegida sin avisar — el argumento de ingreso quedaba con un stanceId y el
    // participante con otro distinto, y el ranking/informe los mostraban en columnas
    // contradictorias. Bug real reportado en prueba en vivo.

    const primeraFase = programa.fases[0];
    publicar(EVENTOS.FASE_INICIADA, { phaseType: primeraFase.tipo, ronda: primeraFase.ronda ?? null });
  }

  // Manda TODO el pool de argumentos acumulado hasta ahora (no solo los de la fase que se
  // cierra) — así Groq también puede encontrar conexiones entre una reacción nueva y un
  // argumento de la fase de apertura, no solo entre argumentos de la misma fase.
  async function dispararSugerenciasDeConexion(publicarDeLaAccion = null) {
    const { estado } = contexto;
    const publicar = publicarDeLaAccion ?? contexto.publicar;
    const todosLosArgumentos = Object.values(estado.argumentos);
    if (todosLosArgumentos.length < 2) {
      return;
    }
    try {
      const respuesta = await fetch('/api/groq-sugerir-conexiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argumentos: todosLosArgumentos.map((argumento) => ({ argumentId: argumento.argumentId, texto: argumento.texto })),
        }),
      });
      if (!respuesta.ok) {
        return;
      }
      const { sugerencias } = await respuesta.json();
      // Segunda red, además de la del endpoint: una sugerencia que nombra un argumento
      // inexistente no se puede dibujar como arista ni aceptar, y publicarla solo ensucia el
      // canal y el mapa.
      const idsDeArgumentos = new Set(todosLosArgumentos.map((argumento) => argumento.argumentId));
      const sugerenciasUtilizables = (sugerencias || []).filter(
        (sugerencia) =>
          idsDeArgumentos.has(sugerencia.sourceArgumentId) &&
          idsDeArgumentos.has(sugerencia.targetArgumentId) &&
          sugerencia.sourceArgumentId !== sugerencia.targetArgumentId
      );
      for (const sugerencia of sugerenciasUtilizables) {
        publicar(EVENTOS.CONEXION_SUGERIDA, { suggestionId: generarId('sugerencia'), ronda: 1, ...sugerencia });
      }
    } catch {
      // Sin sugerencias de Groq esta ronda: no bloquea el avance de fase.
    }
  }

  async function cerrarFaseActual() {
    const { estado, publicar } = contexto;
    const faseActual = estado.fase.actual;
    if (!faseActual) {
      return;
    }
    // Se resuelve ANTES del await: mientras Groq responde, el phase.closed de abajo puede
    // volver por el canal y dejar `fase.actual` en null, y entonces el índice deducido del log
    // ya no sería el de la fase que se está cerrando.
    let indiceSiguiente = indiceDeLaFaseMasReciente() + 1;

    publicar(EVENTOS.FASE_CERRADA, { phaseType: faseActual.tipo, ronda: faseActual.ronda });

    const claveDeAnalisis = `sugerencias-groq:${faseActual.tipo}:${faseActual.iniciadaEn}`;
    const esFaseQueDisparaGroq =
      faseActual.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS || faseActual.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA;
    if (esFaseQueDisparaGroq && !yaSeHizo(claveDeAnalisis)) {
      await dispararSugerenciasDeConexion(comenzarAccion(claveDeAnalisis));
    }

    while (
      indiceSiguiente < programa.fases.length &&
      programa.fases[indiceSiguiente].tipo === TIPOS_DE_FASE.CONEXION_SUGERIDA
    ) {
      // El disparo de Groq ya ocurrió automáticamente arriba (ver decisión de diseño #4
      // del plan) — esta entrada de `fases` no necesita su propio phase.started.
      indiceSiguiente += 1;
    }

    if (indiceSiguiente < programa.fases.length) {
      const siguienteFase = programa.fases[indiceSiguiente];
      publicar(EVENTOS.FASE_INICIADA, { phaseType: siguienteFase.tipo, ronda: siguienteFase.ronda ?? null });
    }
  }

  function cerrarTopicoDeBids(turnoPrincipalId, publicarDeLaAccion = null) {
    const { estado } = contexto;
    const publicar = publicarDeLaAccion ?? contexto.publicar;
    const listaDeBidIds = Object.values(estado.bids)
      .filter((bid) => bid.turnoPrincipalId === turnoPrincipalId && bid.estado !== 'resuelto')
      .map((bid) => bid.bidId);
    if (listaDeBidIds.length === 0) {
      return;
    }
    publicar(EVENTOS.TOPICO_BIDS_CERRADOS, { turnoPrincipalId, listaDeBidIds, cerradoPor: 'moderador' });
  }

  function decidirBid(bidId, decisionFinal) {
    contexto.publicar(EVENTOS.BID_DECISION_MODERADOR, { bidId, decisionFinal });
  }

  // Las calificaciones de las exposiciones (co-moderadores y moderador) ajustan el puntaje una
  // sola vez, al cerrar: para entonces el moderador ya pudo revisarlas o descartarlas (docs/05).
  // Se publican ANTES de `session.closed`, porque el motor deja de sincronizar apenas la sesión
  // queda cerrada y los ajustes se perderían. Hasta aquí el marcador es provisional.
  function aplicarEvaluacionesDeExposiciones() {
    const { estado } = contexto;
    const clave = 'evaluaciones-finales';
    if (!estado || yaSeHizo(clave)) {
      return;
    }
    const ajustes = calcularAjustesDeExposiciones({ estado, parametros: parametrosDePuntajeVigentes() });
    if (ajustes.length === 0) {
      return;
    }
    const publicar = comenzarAccion(clave);
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    for (const ajuste of ajustes) {
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: ajuste.participantId,
        delta: ajuste.delta,
        categoria: ajuste.categoria,
        motivo: ajuste.motivo,
        nuevoTotal: aplicarDelta(ajuste.participantId, ajuste.delta),
      });
    }
  }

  function cerrarSesion() {
    aplicarEvaluacionesDeExposiciones();
    contexto.publicar(EVENTOS.SESION_CERRADA, {});
  }

  // Libera la ruleta cuando quien tiene la palabra ya no la va a terminar (pestaña cerrada,
  // sin conexión, o se olvidó de publicar). El motor no ofrece turnos mientras haya uno abierto.
  function terminarTurnoEnCurso() {
    const turnoEnCurso = contexto.estado?.turnos.turnoEnCurso;
    if (!turnoEnCurso) {
      return;
    }
    contexto.publicar(EVENTOS.TURNO_TERMINADO_POR_HOST, {
      turnId: turnoEnCurso.turnId,
      participantId: turnoEnCurso.participantId,
    });
  }

  function destruir() {
    for (const timeoutId of temporizadoresDeOferta.values()) clearTimeout(timeoutId);
    for (const timeoutId of temporizadoresDeBid.values()) clearTimeout(timeoutId);
    temporizadoresDeOferta.clear();
    temporizadoresDeBid.clear();
  }

  return {
    sincronizar,
    iniciarSesion,
    cerrarFaseActual,
    cerrarRondaDeApertura,
    extenderRondaDeApertura,
    abrirSegundaOportunidadDeApertura,
    cerrarTopicoDeBids,
    decidirBid,
    cerrarSesion,
    terminarTurnoEnCurso,
    destruir,
  };
}
