// Selectores puros sobre el estado derivado del reducer — ver reducirEventos.js.

import { calcularTierPorPercentil } from '../puntaje/formulaDePuntaje.js';

export function combinarParticipantesConPresencia(estado, presencia) {
  return presencia.map((presente) => {
    const participanteDelReducer = estado.participantes[presente.participantId];
    return {
      participantId: presente.participantId,
      nombre: presente.nombre,
      emoji: presente.emoji,
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

// El reducer no guarda nombre/emoji (viven en presence, ver reducirEventos.js) — esto
// resuelve el nombre visible a partir de la lista de presencia en vivo. Si alguien ya se
// desconectó, cae de vuelta al participantId para no perder la fila del ranking/grafo.
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
