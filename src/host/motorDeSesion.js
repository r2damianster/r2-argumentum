// Motor de sesión — corre SOLO en el cliente del host (autoridad única, ver plan de
// implementación). Ofrece turnos, dispara Groq-sugerencias al cerrar fase, calcula y
// publica todo el puntaje, y resuelve bids. El resto de clientes solo publican
// eventos "de intención" y reconstruyen su vista con el reducer (ver useEstadoDeSesion).

import { EVENTOS, TIPOS_DE_FASE, TIPOS_DE_BID } from '../shared/eventos/nombresDeEventos.js';
import {
  calcularPuntajeDeArgumento,
  calcularNumeroDeCoModeradores,
  PUNTAJE_DE_COMODERADOR,
} from '../shared/puntaje/formulaDePuntaje.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    .map((presente) => presente.participantId)
    .filter((participantId) => estado.participantes[participantId]?.rol !== 'co_moderador')
    .filter(
      (participantId) => (estado.participantes[participantId]?.posicionesCompletadas ?? 0) < limiteDePosiciones
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

function crearAcumuladorDePuntaje(estado) {
  const totales = {};
  return function aplicarDelta(participantId, delta) {
    if (totales[participantId] === undefined) {
      totales[participantId] = estado.participantes[participantId]?.puntajeTotal ?? 0;
    }
    totales[participantId] += delta;
    return totales[participantId];
  };
}

export function crearMotorDeSesion({ programa }) {
  const temporizadoresDeOferta = new Map(); // turnId -> timeoutId
  const temporizadoresDeBid = new Map(); // bidId -> timeoutId
  const argumentosYaPuntuados = new Set();
  const bidsYaProcesados = new Set();
  const rondasYaSugeridas = new Set();
  let indiceDeFase = -1;
  let contexto = { estado: null, presencia: [], publicar: () => {} };

  function estaCerrada() {
    return Boolean(contexto.estado?.sesion?.cerrada);
  }

  function limiteDePosiciones() {
    return programa.valoresBasePosicion.length;
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
    if (!candidatoId) {
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
    publicar(EVENTOS.TURNO_OFRECIDO, { turnId, candidateId: candidatoId, ofrecidoEn, expiraEn });

    const timeoutId = setTimeout(() => {
      temporizadoresDeOferta.delete(turnId);
      if (contexto.estado?.turnos.ofertaActiva?.turnId === turnId) {
        contexto.publicar(EVENTOS.TURNO_EXPIRADO, { turnId, candidateId: candidatoId });
      }
    }, programa.timeoutAceptacion * 1000);
    temporizadoresDeOferta.set(turnId, timeoutId);
  }

  function procesarValidacionesPendientes() {
    const { estado, publicar } = contexto;
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);

    for (const argumento of Object.values(estado.argumentos)) {
      if (!argumento.validacion || argumentosYaPuntuados.has(argumento.argumentId)) {
        continue;
      }
      argumentosYaPuntuados.add(argumento.argumentId);

      const puntajeBase = calcularPuntajeDeArgumento({
        posicionEnRonda: argumento.posicionEnRonda,
        ronda: argumento.ronda,
        viaCoModerador: argumento.viaCoModerador,
      });
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: argumento.participantId,
        delta: puntajeBase,
        categoria: 'argumento',
        motivo: `Argumento posición ${argumento.posicionEnRonda}, ronda ${argumento.ronda}`,
        nuevoTotal: aplicarDelta(argumento.participantId, puntajeBase),
      });

      const { coModeradorId, tipoFinal, faltaMarcada, nota } = argumento.validacion;
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
    const { estado, publicar } = contexto;
    if (!estado) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);

    for (const bid of Object.values(estado.bids)) {
      if (!bid.decisionFinal || bidsYaProcesados.has(bid.bidId)) {
        continue;
      }
      bidsYaProcesados.add(bid.bidId);

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

        const puntajeBase = calcularPuntajeDeArgumento({ posicionEnRonda, ronda: bid.ronda, viaCoModerador: false });
        publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
          participantId: bid.participantId,
          delta: puntajeBase,
          categoria: 'argumento',
          motivo: `Bid de intervención aprobado (${bid.tipoDeBid})`,
          nuevoTotal: aplicarDelta(bid.participantId, puntajeBase),
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

  function sincronizar({ estado, presencia, publicar }) {
    contexto = { estado, presencia, publicar };
    if (!estado || estaCerrada()) {
      return;
    }
    ofrecerSiguienteTurnoSiHaceFalta();
    procesarValidacionesPendientes();
    procesarBidsResueltos();
    iniciarTemporizadoresDeBidsNuevos();
  }

  function iniciarSesion() {
    const { estado, presencia, publicar } = contexto;
    const participantesElegibles = presencia.map((presente) => presente.participantId);
    const numeroDeCoModeradores = calcularNumeroDeCoModeradores(
      participantesElegibles.length,
      programa.topeMaximoCoModeradores
    );
    const coModeradoresSorteados = [...participantesElegibles]
      .sort(() => Math.random() - 0.5)
      .slice(0, numeroDeCoModeradores);

    publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
      participantIds: coModeradoresSorteados,
      formulaUsada: 'ceil(n * 0.10)_min_1',
      totalParticipantes: participantesElegibles.length,
    });

    if (programa.asignacionPostura !== 'libre') {
      const argumentadores = participantesElegibles.filter((id) => !coModeradoresSorteados.includes(id));
      argumentadores.forEach((participantId, indice) => {
        const stance = programa.posturas[indice % programa.posturas.length];
        publicar(EVENTOS.POSTURA_ASIGNADA, {
          participantId,
          stanceId: stance.id,
          metodo: programa.asignacionPostura,
        });
      });
    }

    indiceDeFase = 0;
    const primeraFase = programa.fases[indiceDeFase];
    publicar(EVENTOS.FASE_INICIADA, { phaseType: primeraFase.tipo, ronda: primeraFase.ronda ?? null });
  }

  async function dispararSugerenciasDeConexion(ronda) {
    const { estado, publicar } = contexto;
    const argumentosDeLaRonda = Object.values(estado.argumentos).filter((argumento) => argumento.ronda === ronda);
    if (argumentosDeLaRonda.length < 2) {
      return;
    }
    try {
      const respuesta = await fetch('/api/groq-sugerir-conexiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argumentos: argumentosDeLaRonda.map((argumento) => ({ argumentId: argumento.argumentId, texto: argumento.texto })),
        }),
      });
      if (!respuesta.ok) {
        return;
      }
      const { sugerencias } = await respuesta.json();
      for (const sugerencia of sugerencias || []) {
        publicar(EVENTOS.CONEXION_SUGERIDA, { suggestionId: generarId('sugerencia'), ronda, ...sugerencia });
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
    publicar(EVENTOS.FASE_CERRADA, { phaseType: faseActual.tipo, ronda: faseActual.ronda });

    if (faseActual.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS && !rondasYaSugeridas.has(faseActual.ronda)) {
      rondasYaSugeridas.add(faseActual.ronda);
      await dispararSugerenciasDeConexion(faseActual.ronda);
    }

    indiceDeFase += 1;
    while (
      indiceDeFase < programa.fases.length &&
      programa.fases[indiceDeFase].tipo === TIPOS_DE_FASE.CONEXION_SUGERIDA
    ) {
      // El disparo de Groq ya ocurrió automáticamente arriba (ver decisión de diseño #4
      // del plan) — esta entrada de `fases` no necesita su propio phase.started.
      indiceDeFase += 1;
    }

    if (indiceDeFase < programa.fases.length) {
      const siguienteFase = programa.fases[indiceDeFase];
      publicar(EVENTOS.FASE_INICIADA, { phaseType: siguienteFase.tipo, ronda: siguienteFase.ronda ?? null });
    }
  }

  function cerrarTopicoDeBids(turnoPrincipalId) {
    const { estado, publicar } = contexto;
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

  function cerrarSesion() {
    contexto.publicar(EVENTOS.SESION_CERRADA, {});
  }

  function destruir() {
    for (const timeoutId of temporizadoresDeOferta.values()) clearTimeout(timeoutId);
    for (const timeoutId of temporizadoresDeBid.values()) clearTimeout(timeoutId);
    temporizadoresDeOferta.clear();
    temporizadoresDeBid.clear();
  }

  return { sincronizar, iniciarSesion, cerrarFaseActual, cerrarTopicoDeBids, decidirBid, cerrarSesion, destruir };
}
