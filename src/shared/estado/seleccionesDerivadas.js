// Selectores puros sobre el estado derivado del reducer — ver reducirEventos.js.

import { calcularTierPorPercentil } from '../puntaje/formulaDePuntaje.js';

export function combinarParticipantesConPresencia(estado, presencia) {
  return presencia.map((presente) => {
    const participanteDelReducer = estado.participantes[presente.participantId];
    return {
      participantId: presente.participantId,
      nombre: presente.nombre,
      emoji: presente.emoji,
      conectado: presente.conectado !== false,
      rol: participanteDelReducer?.rol ?? 'participante',
      stanceId: participanteDelReducer?.stanceId ?? null,
      turnosPrincipalesAceptados: participanteDelReducer?.turnosPrincipalesAceptados ?? 0,
      rechazosAcumulados: participanteDelReducer?.rechazosAcumulados ?? 0,
      // rechazosAcumulados es la RACHA (vuelve a 0 al aceptar un turno); el total sale del log.
      turnosRechazadosEnTotal: (estado.turnos.rechazos ?? []).filter(
        (rechazo) => rechazo.participantId === presente.participantId
      ).length,
      posicionesCompletadas: participanteDelReducer?.posicionesCompletadas ?? 0,
      puntajeTotal: participanteDelReducer?.puntajeTotal ?? 0,
      ingresoConfirmado: participanteDelReducer?.ingresoConfirmado ?? false,
      intervenciones: participanteDelReducer?.intervenciones ?? 0,
      argumentoListo: participanteDelReducer?.argumentoListo ?? false,
    };
  });
}

export function soyCoModerador(estado, participantId) {
  return estado.participantes[participantId]?.rol === 'co_moderador';
}

export function siguientePosicionParaParticipante(estado, participantId) {
  return (estado.participantes[participantId]?.posicionesCompletadas ?? 0) + 1;
}

export function haTenidoTurnoPrincipal(estado, participantId) {
  return (estado.participantes[participantId]?.turnosPrincipalesAceptados ?? 0) > 0;
}

export function obtenerArgumentosDeParticipante(estado, participantId) {
  return Object.values(estado.argumentos).filter((argumento) => argumento.participantId === participantId);
}

export function misArgumentosSinConexionSaliente(estado, participantId) {
  return obtenerArgumentosDeParticipante(estado, participantId).filter(
    (argumento) => !argumento.conexionSalienteId
  );
}

export function obtenerBidsAbiertos(estado) {
  return Object.values(estado.bids).filter((bid) => bid.estado === 'abierto');
}

export function obtenerBidsPendientesDeDecision(estado) {
  return Object.values(estado.bids).filter((bid) => bid.estado === 'cerrado_pendiente_decision');
}

export function obtenerSugerenciasVisiblesParaParticipante(estado, participantId) {
  return Object.values(estado.sugerencias).filter((sugerencia) => {
    if (sugerencia.resolucion) {
      return false;
    }
    const argumentoOrigen = estado.argumentos[sugerencia.sourceArgumentId];
    const argumentoDestino = estado.argumentos[sugerencia.targetArgumentId];
    return (
      argumentoOrigen?.participantId === participantId || argumentoDestino?.participantId === participantId
    );
  });
}

// Nadie califica lo suyo. Un co-moderador veía su propio argumento de ingreso en su cola de
// validación (bug real reportado en prueba en vivo): es juez y parte, y si además es el único
// co-moderador ese caso no le corresponde a nadie, así que tampoco debe figurar como pendiente
// en los contadores del host ni en su propia capa instruccional.
function hayQuienPuedaRevisar(estado, autorId) {
  return (estado.coModeradores?.participantIds ?? []).some((coModeradorId) => coModeradorId !== autorId);
}

export function obtenerArgumentosSinValidar(estado, { excluirParticipantId = null } = {}) {
  return Object.values(estado.argumentos).filter(
    (argumento) =>
      !argumento.validacion &&
      argumento.participantId !== excluirParticipantId &&
      hayQuienPuedaRevisar(estado, argumento.participantId)
  );
}

export function obtenerIntervencionesSinCalificar(estado, { excluirParticipantId = null } = {}) {
  return Object.values(estado.intervencionesVerbales).filter(
    (intervencion) =>
      !intervencion.calificacion &&
      intervencion.participantId !== excluirParticipantId &&
      hayQuienPuedaRevisar(estado, intervencion.participantId)
  );
}

// Exposiciones de argumentos que el co-moderador todavía no calificó: la que se está diciendo
// ahora primero (es la que se califica «mientras habla») y después las ya terminadas. Nadie se
// califica a sí mismo. Sin `coModeradorId` devuelve las que ningún co-moderador calificó.
export function obtenerExposicionesSinCalificar(estado, { coModeradorId = null, excluirParticipantId = null } = {}) {
  const ordenDeEstado = { en_curso: 0, terminada: 1 };
  return Object.values(estado.exposiciones ?? {})
    .filter((exposicion) => {
      if (!(exposicion.estado in ordenDeEstado) || exposicion.participantId === excluirParticipantId) {
        return false;
      }
      if (!hayQuienPuedaRevisar(estado, exposicion.participantId)) {
        return false;
      }
      return coModeradorId
        ? !exposicion.calificaciones[coModeradorId]
        : Object.keys(exposicion.calificaciones).length === 0;
    })
    .sort((una, otra) => ordenDeEstado[una.estado] - ordenDeEstado[otra.estado]);
}

// Presence solo conoce a quienes están (o estuvieron, en esta pestaña) conectados. Un host que
// refresca la pestaña pierde a todos los que ya se habían ido, y con ellos sus nombres: el
// marcador los borraba y el mapa y el informe mostraban el ID técnico. El log sí los conserva
// (`ingreso.confirmado` trae nombre y emoji), así que se suman al roster como desconectados.
// Devuelve la MISMA referencia si no hay nada que sumar, para no invalidar memoizaciones.
export function completarPresenciaConParticipantes(presencia, participantes) {
  const idsEnPresencia = new Set(presencia.map((presente) => presente.participantId));
  const faltantes = Object.values(participantes ?? {})
    .filter((participante) => participante.nombre && !idsEnPresencia.has(participante.participantId))
    .map((participante) => ({
      participantId: participante.participantId,
      nombre: participante.nombre,
      emoji: participante.emoji,
      conectado: false,
    }));
  return faltantes.length === 0 ? presencia : [...presencia, ...faltantes];
}

// El reducer guarda nombre/emoji solo como respaldo (ver arriba); la fuente principal es la
// lista de presencia, completada con `completarPresenciaConParticipantes`. Si aun así no hay
// nombre, cae de vuelta al participantId para no perder la fila del ranking/grafo.
export function nombreDeParticipante(presencia, participantId) {
  const presente = presencia.find((p) => p.participantId === participantId);
  return presente ? `${presente.emoji ?? ''} ${presente.nombre ?? participantId}`.trim() : participantId;
}

export function calcularRankingPorPostura(estado, programa, presencia = []) {
  const participantesPorPostura = new Map();
  for (const stance of programa.posturas) {
    participantesPorPostura.set(stance.id, []);
  }

  for (const participante of Object.values(estado.participantes)) {
    if (participante.rol === 'co_moderador' || !participante.stanceId) {
      continue;
    }
    const lista = participantesPorPostura.get(participante.stanceId);
    if (lista) {
      lista.push(participante);
    }
  }

  const ranking = {};
  for (const [stanceId, participantes] of participantesPorPostura) {
    const ordenados = [...participantes].sort((a, b) => b.puntajeTotal - a.puntajeTotal);
    const total = ordenados.length;
    ranking[stanceId] = ordenados.map((participante, indice) => {
      const percentil = total <= 1 ? 100 : ((total - 1 - indice) / (total - 1)) * 100;
      const presente = presencia.find((p) => p.participantId === participante.participantId);
      return {
        ...participante,
        nombre: presente?.nombre ?? participante.participantId,
        emoji: presente?.emoji ?? '',
        tier: calcularTierPorPercentil(percentil),
      };
    });
  }
  return ranking;
}
