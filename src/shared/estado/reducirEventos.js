// Reducer puro del motor de debate — ver docs/09-modelo-de-eventos.md.
// estado = reduce(eventos, estadoInicial). Ningún cliente confía en memoria propia
// no verificable: esto es lo único que determina el estado derivado de la sesión.
//
// Nota: nombre/emoji de cada participante NO viven aquí — vienen de Ably presence
// (nativo, no es un evento del log) y se combinan con este estado en las selecciones
// derivadas (ver seleccionesDerivadas.js).

import { EVENTOS } from '../eventos/nombresDeEventos.js';

export function estadoInicial() {
  return {
    programa: null,
    fase: { actual: null, historial: [] },
    apertura: null,
    posturasPropuestas: {},
    intervencionesVerbales: {},
    participantes: {},
    coModeradores: null,
    turnos: {
      ofertaActiva: null,
      turnoEnCurso: null,
      excluidosTemporalmente: [],
      ultimoResultadoPorTurnId: {},
      // Historial de rechazos, para que el motor pueda aplicar la penalidad una sola vez
      // por turno rechazado (ver procesarRechazosDeTurno).
      rechazos: [],
    },
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
    // Requisito de ingreso (docs/09): se confirma al entrar con un argumento aprobado. Quien
    // está en la sala sin confirmarlo es oyente — ve todo, no recibe turnos y no puntúa.
    ingresoConfirmado: false,
    // Veces que esta persona tomó la palabra, por argumento escrito o por turno hablado. El
    // debate no cierra hasta que todos tengan al menos una (ver reglasDeIngreso.js).
    intervenciones: 0,
    // Tiene un argumento redactado y aprobado esperando turno. Solo a quien lo tiene se le
    // ofrece la palabra: el turno es para defender lo escrito, no para escribir (docs/04).
    argumentoListo: false,
    // true solo tras el cierre DEFINITIVO de la apertura (ver EVENTOS.APERTURA_RONDA_CERRADA
    // con esFinal:true) si esta persona nunca logró un argumento aprobado — excluida de la
    // ruleta de turnos del resto de la sesión (ver elegirCandidatoParaTurno en motorDeSesion.js).
    sinArgumentoDeApertura: false,
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

    case EVENTOS.INGRESO_CONFIRMADO:
      return conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        ingresoConfirmado: true,
        stanceId: data.stanceId ?? participante.stanceId,
      }));

    case EVENTOS.POSTURA_PROPUESTA:
      return {
        ...estado,
        posturasPropuestas: {
          ...estado.posturasPropuestas,
          [data.propuestaId]: { ...data, decision: null },
        },
      };

    case EVENTOS.POSTURA_DECISION_MODERADOR: {
      const propuestaExistente = estado.posturasPropuestas[data.propuestaId];
      if (!propuestaExistente || propuestaExistente.decision) {
        return estado;
      }
      return {
        ...estado,
        posturasPropuestas: {
          ...estado.posturasPropuestas,
          [data.propuestaId]: { ...propuestaExistente, decision: data.decision, stanceId: data.stanceId ?? null },
        },
      };
    }

    case EVENTOS.APERTURA_RONDA_INICIADA:
      return {
        ...estado,
        apertura: {
          ronda: data.ronda,
          iniciadaEn: data.iniciadaEn,
          expiraEn: data.expiraEn,
          cerrada: false,
          esperandoSegundaOportunidad: false,
          ultimoCierre: estado.apertura?.ultimoCierre ?? null,
        },
      };

    case EVENTOS.APERTURA_RONDA_EXTENDIDA:
      if (!estado.apertura || estado.apertura.ronda !== data.ronda) {
        return estado;
      }
      return { ...estado, apertura: { ...estado.apertura, expiraEn: data.hasta } };

    case EVENTOS.APERTURA_RONDA_CERRADA: {
      if (!estado.apertura) {
        return estado;
      }
      let siguiente = {
        ...estado,
        apertura: {
          ...estado.apertura,
          cerrada: true,
          esperandoSegundaOportunidad: !data.esFinal,
          ultimoCierre: { ronda: data.ronda, aprobados: data.aprobados, pendientes: data.pendientes, esFinal: data.esFinal },
        },
      };
      if (data.esFinal) {
        for (const participantId of data.pendientes) {
          siguiente = conParticipanteActualizado(siguiente, participantId, (participante) => ({
            ...participante,
            sinArgumentoDeApertura: true,
          }));
        }
      }
      return siguiente;
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
            // "argumento" (defender algo ya escrito) o "verbal" (intervenir sin argumento).
            modo: data.modo ?? 'argumento',
            estado: 'pendiente',
          },
        },
      };

    case EVENTOS.TURNO_ACEPTADO: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        turnosPrincipalesAceptados: participante.turnosPrincipalesAceptados + 1,
        // El tope es de rechazos CONSECUTIVOS (docs/04): tomar la palabra corta la racha. Sin
        // este reset, tres rechazos en toda la sesión dejaban a esa persona en modo forzado
        // para siempre, sin volver a poder decidir nunca.
        rechazosAcumulados: 0,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          ofertaActiva:
            siguiente.turnos.ofertaActiva?.turnId === data.turnId ? null : siguiente.turnos.ofertaActiva,
          turnoEnCurso: {
            turnId: data.turnId,
            participantId: data.participantId,
            modo: siguiente.turnos.ofertaActiva?.modo ?? 'argumento',
          },
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
          rechazos: [...siguiente.turnos.rechazos, { turnId: data.turnId, participantId: data.participantId }],
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
        // Igual que al aceptar: ya tomó la palabra, la racha de rechazos se corta. Si no, el
        // primer turno forzado condenaba a todos los siguientes a ser forzados también.
        rechazosAcumulados: 0,
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

    case EVENTOS.ARGUMENTO_LISTO:
      return conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        argumentoListo: true,
      }));

    case EVENTOS.INTERVENCION_VERBAL_REGISTRADA: {
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        intervenciones: participante.intervenciones + 1,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          turnoEnCurso:
            siguiente.turnos.turnoEnCurso?.turnId === data.turnId ? null : siguiente.turnos.turnoEnCurso,
        },
        intervencionesVerbales: {
          ...siguiente.intervencionesVerbales,
          [data.intervencionId]: { ...data, calificacion: null },
        },
      };
    }

    case EVENTOS.INTERVENCION_VERBAL_CALIFICADA: {
      const intervencionExistente = estado.intervencionesVerbales[data.intervencionId];
      if (!intervencionExistente || intervencionExistente.calificacion) {
        return estado;
      }
      return {
        ...estado,
        intervencionesVerbales: {
          ...estado.intervencionesVerbales,
          [data.intervencionId]: {
            ...intervencionExistente,
            calificacion: { calidad: data.calidad, coModeradorId: data.coModeradorId, nota: data.nota ?? '' },
          },
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
      // Un bid aprobado publica su argumento reusando el turnId del turno PRINCIPAL en curso
      // (así queda registrado durante qué turno pasó — ver procesarBidsResueltos en
      // motorDeSesion.js), pero lo publica OTRA persona, no quien tiene la palabra. Comparar
      // solo el turnId cerraba el turno de quien seguía hablando apenas se aprobaba el bid de
      // otro participante — su argumento preparado quedaba huérfano y se le volvía a ofrecer
      // el mismo turno. Bug real reportado en prueba en vivo.
      const esQuienTieneLaPalabra = estado.turnos.turnoEnCurso?.participantId === data.participantId;
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        posicionesCompletadas: Math.max(participante.posicionesCompletadas, data.posicionEnRonda),
        // El argumento de ingreso NO cuenta como haber tomado la palabra: se escribe antes de
        // que arranque el debate y nadie lo escuchó (ver IngresoConArgumento.jsx). Contarlo
        // dejaba a todo el mundo con intervenciones >= 1 apenas entraba, así que
        // participantesSinIntervenir quedaba vacío y el turno hablado de respaldo no se
        // ofrecía nunca. Bug real reportado en prueba en vivo con 8 participantes.
        intervenciones: participante.intervenciones + (data.esArgumentoDeIngreso ? 0 : 1),
        // El argumento que esperaba turno ya se expuso: para volver a la ruleta hay que
        // preparar uno nuevo. Si esto vino de un bid aprobado de otro participante, no toca
        // el "listo" de nadie más.
        argumentoListo: esQuienTieneLaPalabra ? false : participante.argumentoListo,
      }));
      return {
        ...siguiente,
        turnos: {
          ...siguiente.turnos,
          turnoEnCurso:
            esQuienTieneLaPalabra && siguiente.turnos.turnoEnCurso?.turnId === data.turnId
              ? null
              : siguiente.turnos.turnoEnCurso,
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
