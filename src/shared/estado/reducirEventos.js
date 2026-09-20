// Reducer puro del motor de debate — ver docs/09-modelo-de-eventos.md.
// estado = reduce(eventos, estadoInicial). Ningún cliente confía en memoria propia
// no verificable: esto es lo único que determina el estado derivado de la sesión.
//
// Nota: nombre/emoji de cada participante vienen de Ably presence (nativo, no es un evento del
// log) y se combinan con este estado en las selecciones derivadas (ver seleccionesDerivadas.js).
// Como presence solo sabe quién está conectado ahora, `ingreso.confirmado` también los trae y el
// reducer los guarda como respaldo para quien ya se desconectó.

import {
  EVENTOS,
  CALIDADES_DE_EXPOSICION,
  DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION,
} from '../eventos/nombresDeEventos.js';

export function estadoInicial() {
  return {
    programa: null,
    fase: { actual: null, historial: [] },
    apertura: null,
    posturasPropuestas: {},
    intervencionesVerbales: {},
    // Exposición oral de un argumento ya publicado, por argumentId: quién la calificó (cada
    // co-moderador una vez) y qué decidió el moderador. Se aplica al puntaje al cerrar la sesión
    // (ver evaluacionDeExposiciones.js).
    exposiciones: {},
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
      ruletaPausada: false,
      fallosConsecutivosDeOferta: 0,
      motivoPausa: null,
    },
    argumentos: {},
    intentosEnCurso: {},
    bids: {},
    cierresDeBids: [],
    conexiones: {},
    sugerencias: {},
    // `identificador` distingue esta sesión de otra que haya usado el mismo código de sala
    // (ver mensajesDeLaSesionVigente y la instantánea local).
    sesion: { cerrada: false, cerradaEn: null, identificador: null },
    // Acciones que el motor del host ya ejecutó, marcadas en el propio log de eventos. El
    // motor llevaba esa cuenta solo en memoria: si el host refrescaba la pestaña a mitad del
    // debate, arrancaba con la cuenta en blanco y volvía a puntuar cada argumento, a repartir
    // cada bono y a republicar el argumento de cada bid aprobado. Con la marca en el estado,
    // un motor recién creado sabe qué se hizo antes de él (ver motorDeSesion.js).
    accionesDelMotor: {},
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
    // El argumento publicado (y ya puntuando) que esta persona todavía no expuso en un turno.
    argumentoPendienteId: null,
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

// Cualquier evento publicado por el motor puede traer una `claveDeIdempotencia`: queda
// registrada en el estado para que un motor nuevo (host que refrescó) no repita esa acción.
export function reducirEventos(estado, evento) {
  // Una copia local guardada antes de que existieran las exposiciones no trae ese campo.
  const estadoCompleto = estado.exposiciones ? estado : { ...estado, exposiciones: {} };
  const siguiente = aplicarEvento(estadoCompleto, evento);
  const clave = evento.data?.claveDeIdempotencia;
  if (!clave || siguiente.accionesDelMotor?.[clave]) {
    return siguiente;
  }
  return {
    ...siguiente,
    accionesDelMotor: { ...siguiente.accionesDelMotor, [clave]: true },
  };
}

function aplicarEvento(estado, evento) {
  const { name, data } = evento;

  switch (name) {
    case EVENTOS.PROGRAMA_PUBLICADO:
      return {
        ...estado,
        programa: data.programa,
        sesion: { ...estado.sesion, identificador: data.identificadorDeSesion ?? estado.sesion.identificador },
      };

    case EVENTOS.FASE_INICIADA:
      return {
        ...estado,
        fase: { ...estado.fase, actual: { tipo: data.phaseType, ronda: data.ronda ?? null, iniciadaEn: data.timestamp } },
        turnos: {
          ...estado.turnos,
          fallosConsecutivosDeOferta: 0,
          ruletaPausada: false,
          motivoPausa: null,
        },
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
        // Nombre y emoji viajan en el log además de en presence: presence solo sabe quién está
        // conectado AHORA, así que quien cierra la pestaña desaparece de ella y, si el host
        // refresca, su nombre se perdía y el marcador/informe mostraban el ID técnico. El log
        // sí sobrevive (ver instantaneaLocal.js). Bug real reportado en prueba en vivo.
        nombre: data.nombre ?? participante.nombre,
        emoji: data.emoji ?? participante.emoji,
      }));

    case EVENTOS.ARGUMENTO_EN_EXPOSICION: {
      // Solo tiene sentido mientras ese turno siga en curso: un evento tardío de un turno ya
      // cerrado no debe pegarse al turno siguiente.
      const turnoEnCurso = estado.turnos.turnoEnCurso;
      if (!turnoEnCurso || turnoEnCurso.turnId !== data.turnId || turnoEnCurso.participantId !== data.participantId) {
        return estado;
      }
      // Con argumentId, esta exposición pasa a ser calificable por los co-moderadores desde que
      // empieza. Si ya se había expuesto (turno repetido tras una interrupción, ya terminada) no
      // se reabre: conserva lo que ya le calificaron.
      const exposicionPrevia = data.argumentId ? estado.exposiciones[data.argumentId] : null;
      const exposiciones =
        data.argumentId && exposicionPrevia?.estado !== 'terminada'
          ? {
              ...estado.exposiciones,
              [data.argumentId]: {
                calificaciones: {},
                decisionModerador: null,
                ...exposicionPrevia,
                argumentId: data.argumentId,
                turnId: data.turnId,
                participantId: data.participantId,
                estado: 'en_curso',
              },
            }
          : estado.exposiciones;
      return {
        ...estado,
        exposiciones,
        turnos: {
          ...estado.turnos,
          turnoEnCurso: {
            ...turnoEnCurso,
            presentacion: {
              texto: data.texto,
              tipoDeclarado: data.tipoDeclarado ?? null,
              stanceId: data.stanceId ?? null,
              argumentoObjetivoId: data.argumentoObjetivoId ?? null,
              anunciadoEn: data.timestamp ?? null,
            },
          },
        },
      };
    }

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
          fallosConsecutivosDeOferta: 0,
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
          fallosConsecutivosDeOferta: (siguiente.turnos.fallosConsecutivosDeOferta ?? 0) + 1,
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
          fallosConsecutivosDeOferta: (estado.turnos.fallosConsecutivosDeOferta ?? 0) + 1,
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
          fallosConsecutivosDeOferta: 0,
        },
      };
    }

    case EVENTOS.TURNO_RULETA_PAUSADA:
      return {
        ...estado,
        turnos: {
          ...estado.turnos,
          ruletaPausada: true,
          motivoPausa: data.motivo ?? 'Pausada por el moderador o por abstención de la sala',
        },
      };

    case EVENTOS.TURNO_RULETA_REANUDADA:
      return {
        ...estado,
        turnos: {
          ...estado.turnos,
          ruletaPausada: false,
          fallosConsecutivosDeOferta: 0,
          motivoPausa: null,
        },
      };

    case EVENTOS.TURNO_TERMINADO_POR_HOST: {
      if (estado.turnos.turnoEnCurso?.turnId !== data.turnId) {
        return estado;
      }
      // El "argumento listo" de quien hablaba se conserva: si vuelve, puede recibir la palabra
      // otra vez para defenderlo. No se cuenta como intervención ni como rechazo.
      const exposicionesActualizadas = Object.fromEntries(
        Object.entries(estado.exposiciones).map(([argumentId, exposicion]) => [
          argumentId,
          exposicion.turnId === data.turnId && exposicion.estado === 'en_curso'
            ? { ...exposicion, estado: 'interrumpida' }
            : exposicion,
        ])
      );
      return {
        ...estado,
        exposiciones: exposicionesActualizadas,
        turnos: {
          ...estado.turnos,
          turnoEnCurso: null,
          ultimoResultadoPorTurnId: { ...estado.turnos.ultimoResultadoPorTurnId, [data.turnId]: 'ended_by_host' },
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
      // Un argumento publicado al aprobarse (`pendienteDeExposicion`) ya puntúa y ya está en el
      // mapa, pero todavía no se expuso: no cuenta como intervención, deja a su autor en la
      // ruleta y queda anotado como el que tiene que defender.
      const estaPendienteDeExposicion = Boolean(data.pendienteDeExposicion);
      const esQuienTieneLaPalabra =
        !estaPendienteDeExposicion && estado.turnos.turnoEnCurso?.participantId === data.participantId;
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        posicionesCompletadas: Math.max(participante.posicionesCompletadas, data.posicionEnRonda),
        argumentoPendienteId: estaPendienteDeExposicion ? data.argumentId : participante.argumentoPendienteId,
        // El argumento de ingreso NO cuenta como haber tomado la palabra: se escribe antes de
        // que arranque el debate y nadie lo escuchó (ver IngresoConArgumento.jsx). Contarlo
        // dejaba a todo el mundo con intervenciones >= 1 apenas entraba, así que
        // participantesSinIntervenir quedaba vacío y el turno hablado de respaldo no se
        // ofrecía nunca. Bug real reportado en prueba en vivo con 8 participantes.
        intervenciones: participante.intervenciones + (data.esArgumentoDeIngreso || estaPendienteDeExposicion ? 0 : 1),
        // El argumento que esperaba turno ya se expuso: para volver a la ruleta hay que
        // preparar uno nuevo. Si esto vino de un bid aprobado de otro participante, no toca
        // el "listo" de nadie más.
        argumentoListo: estaPendienteDeExposicion ? true : esQuienTieneLaPalabra ? false : participante.argumentoListo,
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

    // Quien tenía la palabra terminó de exponer el argumento que ya estaba publicado: ahí sí
    // cuenta como haber tomado la palabra y el turno queda libre. Un evento repetido no suma dos
    // veces.
    case EVENTOS.EXPOSICION_TERMINADA: {
      if (estado.exposiciones[data.argumentId]?.estado === 'terminada') {
        return estado;
      }
      const siguiente = conParticipanteActualizado(estado, data.participantId, (participante) => ({
        ...participante,
        intervenciones: participante.intervenciones + 1,
        argumentoListo: false,
        argumentoPendienteId:
          participante.argumentoPendienteId === data.argumentId ? null : participante.argumentoPendienteId,
      }));
      return {
        ...siguiente,
        exposiciones: {
          ...siguiente.exposiciones,
          [data.argumentId]: {
            calificaciones: {},
            decisionModerador: null,
            ...siguiente.exposiciones[data.argumentId],
            argumentId: data.argumentId,
            turnId: data.turnId,
            participantId: data.participantId,
            estado: 'terminada',
            terminadaEn: data.timestamp ?? null,
          },
        },
        turnos: {
          ...siguiente.turnos,
          turnoEnCurso:
            siguiente.turnos.turnoEnCurso?.turnId === data.turnId ? null : siguiente.turnos.turnoEnCurso,
        },
      };
    }

    // Cada co-moderador califica una vez cada exposición: si vuelve a calificar, reemplaza su nota
    // (así el promedio nunca cuenta dos veces al mismo).
    case EVENTOS.EXPOSICION_CALIFICADA: {
      const exposicion = estado.exposiciones[data.argumentId];
      if (!exposicion || !Object.values(CALIDADES_DE_EXPOSICION).includes(data.calidad)) {
        return estado;
      }
      return {
        ...estado,
        exposiciones: {
          ...estado.exposiciones,
          [data.argumentId]: {
            ...exposicion,
            calificaciones: {
              ...exposicion.calificaciones,
              [data.coModeradorId]: { calidad: data.calidad, nota: data.nota ?? '' },
            },
          },
        },
      };
    }

    // El moderador puede cambiar su decisión hasta que cierre la sesión; "sin_evaluar" la deshace.
    case EVENTOS.EXPOSICION_EVALUADA_POR_MODERADOR: {
      const exposicion = estado.exposiciones[data.argumentId];
      if (!exposicion) {
        return estado;
      }
      let decisionModerador = null;
      if (data.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.DESCARTADA) {
        decisionModerador = { decision: data.decision, calidad: null };
      } else if (
        data.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.EVALUADA &&
        Object.values(CALIDADES_DE_EXPOSICION).includes(data.calidad)
      ) {
        decisionModerador = { decision: data.decision, calidad: data.calidad };
      }
      return {
        ...estado,
        exposiciones: { ...estado.exposiciones, [data.argumentId]: { ...exposicion, decisionModerador } },
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
      return { ...estado, sesion: { ...estado.sesion, cerrada: true, cerradaEn: data.timestamp } };

    default:
      return estado;
  }
}
