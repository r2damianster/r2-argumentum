// Reducer puro del motor de debate — ver docs/09-modelo-de-eventos.md.
// estado = reduce(eventos, estadoInicial). Ningún cliente confía en memoria propia
// no verificable: esto es lo único que determina el estado derivado de la sesión.
//
// Nota: nombre/emoji de cada participante NO viven acá — vienen de Ably presence
// (nativo, no es un evento del log) y se combinan con este estado en las selecciones
// derivadas (ver seleccionesDerivadas.js).

import { EVENTOS } from '../eventos/nombresDeEventos.js';

export function estadoInicial() {
  return {
    programa: null,
    fase: { actual: null, historial: [] },
    participantes: {},
    coModeradores: null,
    turnos: { ofertaActiva: null, turnoEnCurso: null, excluidosTemporalmente: [], ultimoResultadoPorTurnId: {} },
    argumentos: {},
    intentosEnCurso: {},
    bids: {},
    cierresDeBids: [],
    conexiones: {},
    sugerencias: {},
    sesion: { cerrada: false, cerradaEn: null },
  };
}

function crearParticipanteVacio(participantId) {
  return {
    participantId,
    rol: 'participante',
    stanceId: null,
    turnosPrincipalesAceptados: 0,
    rechazosAcumulados: 0,
    posicionesCompletadas: 0,
    puntajeTotal: 0,
  };
}

function conParticipanteActualizado(estado, participantId, actualizar) {
  const participanteExistente = estado.participantes[participantId] || crearParticipanteVacio(participantId);
  return {
    ...estado,
    participantes: {
      ...estado.participantes,
      [participantId]: actualizar(participanteExistente),
    },
  };
}

export function reducirEventos(estado, evento) {
  const { name, data } = evento;

  switch (name) {
    case EVENTOS.PROGRAMA_PUBLICADO:
      return { ...estado, programa: data.programa };

    case EVENTOS.FASE_INICIADA:
      return {
        ...estado,
        fase: { ...estado.fase, actual: { tipo: data.phaseType, ronda: data.ronda ?? null, iniciadaEn: data.timestamp } },
      };

    case EVENTOS.FASE_CERRADA: {
      const faseCerrada = estado.fase.actual
        ? { ...estado.fase.actual, cerradaEn: data.timestamp }
        : { tipo: data.phaseType, ronda: data.ronda ?? null, iniciadaEn: null, cerradaEn: data.timestamp };
      return {
        ...estado,
        fase: { actual: null, historial: [...estado.fase.historial, faseCerrada] },
      };
    }

    case EVENTOS.POSTURA_ASIGNADA:
      return conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        stanceId: data.stanceId,
      }));

    case EVENTOS.COMODERADORES_SELECCIONADOS: {
      let siguienteEstado = { ...estado, coModeradores: data };
      for (const participantId of data.participantIds) {
        siguienteEstado = conParticipanteActualizado(siguienteEstado, participantId, (participante) => ({
          ...participante,
          rol: 'co_moderador',
        }));
      }
      return siguienteEstado;
    }

    case EVENTOS.TURNO_OFRECIDO:
      return {
        ...estado,
        turnos: {
          ...estado.turnos,
          ofertaActiva: {
            turnId: data.turnId,
            candidateId: data.candidateId,
            ofrecidoEn: data.ofrecidoEn,
            expiraEn: data.expiraEn,
            estado: 'pendiente',
          },
        },
      };

    case EVENTOS.TURNO_ACEPTADO: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        turnosPrincipalesAceptados: participante.turnosPrincipalesAceptados + 1,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          ofertaActiva:
            siguiente.turnos.ofertaActiva?.turnId === data.turnId ? null : siguiente.turnos.ofertaActiva,
          turnoEnCurso: { turnId: data.turnId, participantId: data.participantId },
          excluidosTemporalmente: [],
          ultimoResultadoPorTurnId: { ...siguiente.turnos.ultimoResultadoPorTurnId, [data.turnId]: 'accepted' },
        },
      };
    }

    case EVENTOS.TURNO_RECHAZADO: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        rechazosAcumulados: data.totalRechazosDelParticipante,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          ofertaActiva:
            siguiente.turnos.ofertaActiva?.turnId === data.turnId ? null : siguiente.turnos.ofertaActiva,
          excluidosTemporalmente: Array.from(
            new Set([...siguiente.turnos.excluidosTemporalmente, data.participantId])
          ),
          ultimoResultadoPorTurnId: { ...siguiente.turnos.ultimoResultadoPorTurnId, [data.turnId]: 'rejected' },
        },
      };
    }

    case EVENTOS.TURNO_EXPIRADO:
      return {
        ...estado,
        turnos: {
          ...estado.turnos,
          ofertaActiva: estado.turnos.ofertaActiva?.turnId === data.turnId ? null : estado.turnos.ofertaActiva,
          excluidosTemporalmente: Array.from(
            new Set([...estado.turnos.excluidosTemporalmente, data.candidateId])
          ),
          ultimoResultadoPorTurnId: { ...estado.turnos.ultimoResultadoPorTurnId, [data.turnId]: 'timeout' },
        },
      };

    case EVENTOS.TURNO_FORZADO: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        turnosPrincipalesAceptados: participante.turnosPrincipalesAceptados + 1,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          ofertaActiva:
            siguiente.turnos.ofertaActiva?.turnId === data.turnId ? null : siguiente.turnos.ofertaActiva,
          turnoEnCurso: { turnId: data.turnId, participantId: data.participantId },
          excluidosTemporalmente: [],
          ultimoResultadoPorTurnId: { ...siguiente.turnos.ultimoResultadoPorTurnId, [data.turnId]: 'forced' },
        },
      };
    }

    case EVENTOS.ARGUMENTO_INTENTO:
      return {
        ...estado,
        intentosEnCurso: {
          ...estado.intentosEnCurso,
          [data.attemptId]: { ...data, resultado: null },
        },
      };

    case EVENTOS.ARGUMENTO_RESULTADO_VALIDACION: {
      const intentoExistente = estado.intentosEnCurso[data.attemptId];
      if (!intentoExistente) {
        return estado;
      }
      return {
        ...estado,
        intentosEnCurso: {
          ...estado.intentosEnCurso,
          [data.attemptId]: {
            ...intentoExistente,
            resultado: { aprobado: data.aprobado, motivo: data.motivo, sugerenciaDeCorreccion: data.sugerenciaDeCorreccion },
          },
        },
      };
    }

    case EVENTOS.ARGUMENTO_PUBLICADO: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        posicionesCompletadas: Math.max(participante.posicionesCompletadas, data.posicionEnRonda),
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          turnoEnCurso:
            siguiente.turnos.turnoEnCurso?.turnId === data.turnId ? null : siguiente.turnos.turnoEnCurso,
        },
        argumentos: {
          ...siguiente.argumentos,
          [data.argumentId]: { ...data, validacion: null, conexionSalienteId: null },
        },
      };
    }

    case EVENTOS.ARGUMENTO_VALIDADO: {
      const argumentoExistente = estado.argumentos[data.argumentId];
      if (!argumentoExistente || argumentoExistente.validacion) {
        return estado;
      }
      return {
        ...estado,
        argumentos: {
          ...estado.argumentos,
          [data.argumentId]: {
            ...argumentoExistente,
            validacion: {
              coModeradorId: data.coModeradorId,
              tipoFinal: data.tipoFinal,
              puntajeAsignado: data.puntajeAsignado,
              nota: data.nota,
              faltaMarcada: data.faltaMarcada,
              timestamp: data.timestamp,
            },
          },
        },
      };
    }

    case EVENTOS.CONEXION_CREADA: {
      const argumentoOrigen = estado.argumentos[data.sourceArgumentId];
      if (!argumentoOrigen || argumentoOrigen.conexionSalienteId) {
        return estado;
      }
      return {
        ...estado,
        conexiones: { ...estado.conexiones, [data.linkId]: data },
        argumentos: {
          ...estado.argumentos,
          [data.sourceArgumentId]: { ...argumentoOrigen, conexionSalienteId: data.linkId },
        },
      };
    }

    case EVENTOS.CONEXION_SUGERIDA:
      return {
        ...estado,
        sugerencias: { ...estado.sugerencias, [data.suggestionId]: { ...data, resolucion: null } },
      };

    case EVENTOS.SUGERENCIA_RESUELTA: {
      const sugerenciaExistente = estado.sugerencias[data.suggestionId];
      if (!sugerenciaExistente || sugerenciaExistente.resolucion) {
        return estado;
      }
      return {
        ...estado,
        sugerencias: {
          ...estado.sugerencias,
          [data.suggestionId]: {
            ...sugerenciaExistente,
            resolucion: { resolucion: data.resolucion, porParticipanteId: data.porParticipanteId },
          },
        },
      };
    }

    case EVENTOS.BID_ENVIADO:
      return {
        ...estado,
        bids: {
          ...estado.bids,
          [data.bidId]: { ...data, votos: {}, estado: 'abierto', decisionFinal: null },
        },
      };

    case EVENTOS.BID_VOTO_COMODERADOR: {
      const bidExistente = estado.bids[data.bidId];
      if (!bidExistente) {
        return estado;
      }
      return {
        ...estado,
        bids: {
          ...estado.bids,
          [data.bidId]: { ...bidExistente, votos: { ...bidExistente.votos, [data.coModeradorId]: data.voto } },
        },
      };
    }

    case EVENTOS.BID_EVALUACION_EXPIRADA: {
      const bidExistente = estado.bids[data.bidId];
      if (!bidExistente || bidExistente.estado !== 'abierto') {
        return estado;
      }
      return { ...estado, bids: { ...estado.bids, [data.bidId]: { ...bidExistente, estado: 'expirado' } } };
    }

    case EVENTOS.TOPICO_BIDS_CERRADOS: {
      let bidsActualizados = estado.bids;
      for (const bidId of data.listaDeBidIds) {
        const bidExistente = bidsActualizados[bidId];
        if (bidExistente && bidExistente.estado !== 'resuelto') {
          bidsActualizados = { ...bidsActualizados, [bidId]: { ...bidExistente, estado: 'cerrado_pendiente_decision' } };
        }
      }
      return { ...estado, bids: bidsActualizados, cierresDeBids: [...estado.cierresDeBids, data] };
    }

    case EVENTOS.BID_DECISION_MODERADOR: {
      const bidExistente = estado.bids[data.bidId];
      if (!bidExistente || bidExistente.decisionFinal) {
        return estado;
      }
      return {
        ...estado,
        bids: {
          ...estado.bids,
          [data.bidId]: { ...bidExistente, decisionFinal: data.decisionFinal, estado: 'resuelto' },
        },
      };
    }

    case EVENTOS.PUNTAJE_ACTUALIZADO:
      return conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        puntajeTotal: data.nuevoTotal,
      }));

    case EVENTOS.SESION_CERRADA:
      return { ...estado, sesion: { cerrada: true, cerradaEn: data.timestamp } };

    default:
      return estado;
  }
}
