// Estado PRIVADO del docente en el control de lectura — ver docs/14-control-de-lectura.md.
//
// Se reconstruye en el host a partir de los canales privados (entregas y docente) y de una copia local.
// Es lo único que conoce el texto de cada entrega, las calificaciones y las notas. Funciones puras: el
// hook del host las llama y las pantallas del docente leen sus resultados.

import { EVENTOS_PRIVADOS } from './canalesPrivados.js';
import { contarPalabras, contarParrafos } from '../escritura/contarTexto.js';
import { normalizarDecisionDeIntegridad } from './integridadDeLasEntregas.js';
import {
  calcularNotaDeRubrica,
  filtrarComentariosPorCriterio,
  filtrarNivelesValidos,
  rubricaEstaCompleta,
} from '../rubrica/rubrica.js';

export const ESTADOS_DE_CALIFICACION = {
  SIN_CALIFICAR: 'sin_calificar',
  BORRADOR: 'borrador',
  APROBADA: 'aprobada',
};

export function estadoPrivadoInicial() {
  return {
    textos: {},
    confirmaciones: {},
    calificaciones: {},
    devoluciones: {},
    reconsideraciones: {},
    sugerencias: {},
    // Revisión entre pares: lo que envió cada revisor ({ [revisorId]: { [indice]: revisión } }), el reparto
    // (null hasta que se hace) y lo que decidió el docente de cada revisión ({ [autorId]: { [revisorId]: decisión } }).
    revisionesEnviadas: {},
    asignaciones: null,
    moderacionDeRevisiones: {},
    // Lo que decidió el docente sobre las marcas de integridad de cada entrega.
    decisionesDeIntegridad: {},
  };
}

const MAXIMO_DEL_COMENTARIO_GENERAL = 1200;

// `registro` es lo que devuelven procesarMensajeDeEntrega y procesarMensajeDelDocente.
export function reducirEstadoPrivado(estado, registro) {
  // El reparto de pares es de toda la sala. Se hace una sola vez: el primero es el que vale (si el host
  // refresca la pestaña a mitad de la fase, no se vuelve a sortear).
  if (registro?.nombre === EVENTOS_PRIVADOS.ASIGNACION_DE_PARES) {
    if (estado.asignaciones) {
      return estado;
    }
    const asignaciones = {};
    for (const [revisorId, autores] of Object.entries(registro.asignaciones ?? {})) {
      if (Array.isArray(autores)) {
        asignaciones[revisorId] = autores.map(String);
      }
    }
    return { ...estado, asignaciones };
  }
  if (!registro?.participantId) {
    return estado;
  }
  const { participantId } = registro;

  switch (registro.nombre) {
    case EVENTOS_PRIVADOS.ENTREGA_TEXTO:
      // No se edita después de enviar: el primer texto es el que vale.
      if (estado.textos[participantId]) {
        return estado;
      }
      return {
        ...estado,
        textos: {
          ...estado.textos,
          [participantId]: {
            texto: registro.texto,
            palabras: contarPalabras(registro.texto),
            parrafos: contarParrafos(registro.texto),
            enviadoPorTiempo: registro.enviadoPorTiempo,
            enviadoEn: registro.enviadoEn,
          },
        },
      };

    case EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION:
      if (estado.confirmaciones[participantId]) {
        return estado;
      }
      return {
        ...estado,
        confirmaciones: {
          ...estado.confirmaciones,
          [participantId]: { decision: registro.decision, motivo: registro.motivo, enviadoEn: registro.enviadoEn },
        },
      };

    case EVENTOS_PRIVADOS.CALIFICACION_GUARDADA:
      return {
        ...estado,
        calificaciones: {
          ...estado.calificaciones,
          [participantId]: {
            niveles: registro.niveles && typeof registro.niveles === 'object' ? registro.niveles : {},
            comentariosPorCriterio:
              registro.comentariosPorCriterio && typeof registro.comentariosPorCriterio === 'object'
                ? registro.comentariosPorCriterio
                : {},
            comentarioGeneral: String(registro.comentarioGeneral ?? '').slice(0, MAXIMO_DEL_COMENTARIO_GENERAL),
            aprobada: Boolean(registro.aprobada),
            actualizadaEn: registro.enviadoEn,
          },
        },
      };

    case EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA:
      return {
        ...estado,
        devoluciones: {
          ...estado.devoluciones,
          [participantId]: {
            devueltaEn: estado.devoluciones[participantId]?.devueltaEn ?? registro.enviadoEn,
            hasta: estado.devoluciones[participantId]?.hasta ?? (Number(registro.hasta) || null),
            revisada: Boolean(estado.devoluciones[participantId]?.revisada || registro.revisada),
          },
        },
      };

    // Lo que una persona envió al revisar el texto de un par. La primera de cada índice es la que vale.
    case EVENTOS_PRIVADOS.ENTREGA_REVISION_PAR:
      if (estado.revisionesEnviadas[participantId]?.[registro.indice]) {
        return estado;
      }
      return {
        ...estado,
        revisionesEnviadas: {
          ...estado.revisionesEnviadas,
          [participantId]: {
            ...estado.revisionesEnviadas[participantId],
            [registro.indice]: {
              niveles: registro.niveles,
              comentariosPorCriterio: registro.comentariosPorCriterio,
              comentarioGeneral: registro.comentarioGeneral,
              enviadoEn: registro.enviadoEn,
            },
          },
        },
      };

    // El docente decide qué de una revisión llega al autor: aprobarla (con los textos que él dejó, editados
    // o no) o descartarla. Aquí `participantId` es el AUTOR y `revisorId` quien revisó.
    case EVENTOS_PRIVADOS.MODERACION_DE_REVISION:
      if (!registro.revisorId) {
        return estado;
      }
      return {
        ...estado,
        moderacionDeRevisiones: {
          ...estado.moderacionDeRevisiones,
          [participantId]: {
            ...estado.moderacionDeRevisiones[participantId],
            [registro.revisorId]: {
              estado: registro.estado === 'descartada' ? 'descartada' : 'aprobada',
              comentariosPorCriterio:
                registro.comentariosPorCriterio && typeof registro.comentariosPorCriterio === 'object'
                  ? registro.comentariosPorCriterio
                  : {},
              comentarioGeneral: String(registro.comentarioGeneral ?? '').slice(0, MAXIMO_DEL_COMENTARIO_GENERAL),
            },
          },
        },
      };

    // La decisión del docente sobre una marca de integridad: la última reemplaza a la anterior.
    case EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD:
      return {
        ...estado,
        decisionesDeIntegridad: { ...estado.decisionesDeIntegridad, [participantId]: normalizarDecisionDeIntegridad(registro) },
      };

    // La sugerencia de Groq para esta entrega. Una sola por entrega: la primera es la que vale (pedir otra
    // costaría una llamada y cambiaría lo que el docente ya está viendo).
    case EVENTOS_PRIVADOS.SUGERENCIA_DE_IA:
      if (estado.sugerencias[participantId]) {
        return estado;
      }
      return {
        ...estado,
        sugerencias: {
          ...estado.sugerencias,
          [participantId]: registro.sugerencia
            ? { sugerencia: registro.sugerencia, omitida: null }
            : { sugerencia: null, omitida: String(registro.omitida ?? 'sin_sugerencia') },
        },
      };

    case EVENTOS_PRIVADOS.RECONSIDERACION_RESUELTA:
      // Una sola reconsideración: la primera resolución es la que vale.
      if (estado.reconsideraciones[participantId]) {
        return estado;
      }
      return {
        ...estado,
        reconsideraciones: {
          ...estado.reconsideraciones,
          [participantId]: { resultado: registro.resultado === 'cambia' ? 'cambia' : 'mantiene' },
        },
      };

    default:
      return estado;
  }
}

export function reducirRegistrosPrivados(registros) {
  return registros.reduce(reducirEstadoPrivado, estadoPrivadoInicial());
}

// El código anónimo de una entrega sale de un hash de quien la escribió, no del orden de llegada: así
// «Entrega 03» no delata a quien entregó tercero, y el código no cambia mientras llegan otras entregas.
// Cuatro caracteres dejan la colisión casi en cero; si ocurre, se resuelve de forma determinista.
function codigoAnonimoBase(participantId) {
  let hash = 2166136261;
  for (const caracter of participantId) {
    hash ^= caracter.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

export function asignarCodigosAnonimos(participantIds) {
  const codigos = {};
  const usados = new Set();
  for (const participantId of [...participantIds].sort()) {
    let codigo = codigoAnonimoBase(participantId);
    let sal = 0;
    while (usados.has(codigo)) {
      sal += 1;
      codigo = codigoAnonimoBase(`${participantId}#${sal}`);
    }
    usados.add(codigo);
    codigos[participantId] = codigo;
  }
  return codigos;
}

const ORDEN_DE_LOS_ESTADOS = {
  [ESTADOS_DE_CALIFICACION.SIN_CALIFICAR]: 0,
  [ESTADOS_DE_CALIFICACION.BORRADOR]: 1,
  [ESTADOS_DE_CALIFICACION.APROBADA]: 2,
};

// La cola de calificación del docente. Solo entran las entregas que el estado público registró (así se
// respetan el ingreso y los tiempos): un texto privado sin entrega pública se ignora. Va ordenada por lo
// pendiente primero y, dentro de cada grupo, por código anónimo (no por orden de llegada).
export function construirColaDelDocente({ estadoPrivado, estado, rubrica }) {
  const entregasPublicas = Object.values(estado.lectura?.entregas ?? {});
  const codigos = asignarCodigosAnonimos(entregasPublicas.map((entrega) => entrega.participantId));

  const cola = entregasPublicas.map((entregaPublica) => {
    const { participantId } = entregaPublica;
    const texto = estadoPrivado.textos[participantId] ?? null;
    const calificacionGuardada = estadoPrivado.calificaciones[participantId] ?? null;
    const calificacion = calificacionGuardada
      ? {
          ...calificacionGuardada,
          niveles: filtrarNivelesValidos(rubrica, calificacionGuardada.niveles),
          comentariosPorCriterio: filtrarComentariosPorCriterio(rubrica, calificacionGuardada.comentariosPorCriterio),
        }
      : null;
    const aprobada = Boolean(calificacion?.aprobada) && rubricaEstaCompleta(rubrica, calificacion.niveles);
    const confirmacionPrivada = estadoPrivado.confirmaciones[participantId] ?? null;
    const notaDeLaRubrica = calificacion ? calcularNotaDeRubrica(rubrica, calificacion.niveles) : null;
    // Descuento por integridad: el automático por texto pegado (lo calcula el host con lo que publicó el
    // estudiante) o, si el docente decidió algo, lo que él decidió: «descuento» pone su cifra; descartar la
    // marca o dejar una observación REVIERTEN el automático.
    const decisionDeIntegridad = estadoPrivado.decisionesDeIntegridad?.[participantId] ?? null;
    const descuentoAutomatico = estadoPrivado.descuentosAutomaticos?.[participantId] ?? 0;
    const descuentoDeIntegridad = decisionDeIntegridad ? decisionDeIntegridad.descuento : descuentoAutomatico;
    const sugerenciaGuardada = estadoPrivado.sugerencias[participantId] ?? null;
    const sugerencia = sugerenciaGuardada?.sugerencia
      ? {
          ...sugerenciaGuardada.sugerencia,
          niveles: filtrarNivelesValidos(rubrica, sugerenciaGuardada.sugerencia.niveles),
          comentariosPorCriterio: filtrarComentariosPorCriterio(rubrica, sugerenciaGuardada.sugerencia.comentariosPorCriterio),
        }
      : null;

    return {
      participantId,
      codigoAnonimo: codigos[participantId],
      etiqueta: `Entrega ${codigos[participantId]}`,
      texto: texto?.texto ?? null,
      textoPendiente: !texto,
      palabras: texto?.palabras ?? entregaPublica.palabras,
      parrafos: texto?.parrafos ?? entregaPublica.parrafos,
      enviadaPorTiempo: entregaPublica.enviadaPorTiempo,
      entregadaEn: entregaPublica.entregadaEn,
      calificacion,
      estadoDeCalificacion: aprobada
        ? ESTADOS_DE_CALIFICACION.APROBADA
        : calificacion
          ? ESTADOS_DE_CALIFICACION.BORRADOR
          : ESTADOS_DE_CALIFICACION.SIN_CALIFICAR,
      // La nota final es la de la rúbrica menos el descuento por integridad que el docente haya decidido
      // aplicar (manual, con motivo; nunca automático).
      notaDeLaRubrica: notaDeLaRubrica,
      descuentoDeIntegridad: descuentoDeIntegridad,
      descuentoAutomatico,
      decisionDeIntegridad,
      nota: notaDeLaRubrica === null ? null : Math.round(Math.max(0, notaDeLaRubrica - descuentoDeIntegridad) * 100) / 100,
      devuelta: Boolean(entregaPublica.devueltaEn),
      confirmaHasta: entregaPublica.confirmaHasta,
      devolucionRevisada: entregaPublica.devolucionRevisada,
      confirmacion: entregaPublica.confirmacion,
      motivoDeDesacuerdo:
        confirmacionPrivada?.decision === 'en_desacuerdo' ? confirmacionPrivada.motivo : '',
      reconsideracion: estadoPrivado.reconsideraciones[participantId] ?? null,
      // La sugerencia de Groq: orientativa, anónima y solo para el docente. `completa` se vuelve a calcular
      // con la rúbrica vigente.
      sugerencia: sugerencia ? { ...sugerencia, completa: rubricaEstaCompleta(rubrica, sugerencia.niveles) } : null,
      sugerenciaOmitida: sugerenciaGuardada?.omitida ?? null,
      sugerenciaConsultada: Boolean(sugerenciaGuardada),
    };
  });

  return cola.sort(
    (itemA, itemB) =>
      ORDEN_DE_LOS_ESTADOS[itemA.estadoDeCalificacion] - ORDEN_DE_LOS_ESTADOS[itemB.estadoDeCalificacion] ||
      itemA.codigoAnonimo.localeCompare(itemB.codigoAnonimo)
  );
}

// Lo único de la calificación que llega al estudiante: los comentarios por criterio y el general, y los
// comentarios de pares que el docente aprobó. La nota y los niveles NUNCA salen de aquí.
export function construirDevolucionParaElEstudiante({ rubrica, calificacion, revisionesDePares = [] }) {
  const comentarios = filtrarComentariosPorCriterio(rubrica, calificacion?.comentariosPorCriterio);
  return {
    criterios: rubrica
      .filter((criterio) => comentarios[criterio.id])
      .map((criterio) => ({ criterioId: criterio.id, nombre: criterio.nombre, comentario: comentarios[criterio.id] })),
    comentarioGeneral: String(calificacion?.comentarioGeneral ?? '').slice(0, MAXIMO_DEL_COMENTARIO_GENERAL),
    // Lo que escribió un compañero (anónimo) y el docente aprobó: solo comentarios, nunca niveles.
    revisionesDePares: revisionesDePares
      .map((revision) => {
        const delPar = filtrarComentariosPorCriterio(rubrica, revision.comentariosPorCriterio);
        return {
          criterios: rubrica
            .filter((criterio) => delPar[criterio.id])
            .map((criterio) => ({ criterioId: criterio.id, nombre: criterio.nombre, comentario: delPar[criterio.id] })),
          comentarioGeneral: String(revision.comentarioGeneral ?? '').slice(0, MAXIMO_DEL_COMENTARIO_GENERAL),
        };
      })
      .filter((revision) => revision.criterios.length > 0 || revision.comentarioGeneral),
  };
}

export function resumirLaCola(cola) {
  return {
    total: cola.length,
    sinCalificar: cola.filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.SIN_CALIFICAR).length,
    enBorrador: cola.filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.BORRADOR).length,
    aprobadas: cola.filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA).length,
    porDevolver: cola.filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA && !item.devuelta).length,
    devueltas: cola.filter((item) => item.devuelta).length,
    desacuerdosPorResolver: cola.filter(
      (item) => item.confirmacion?.decision === 'en_desacuerdo' && !item.reconsideracion
    ).length,
  };
}

// Aprobación en lote de las sugerencias de la IA. La «confianza» que informa Groq mide qué tan seguro está el
// modelo, no qué tan bueno es el texto, y es inestable (el mismo texto flojo dio 0,2 y 0,9 en dos corridas): por
// sí sola no basta. Por eso el lote solo ofrece lo que además es una nota sugerida decente y no tiene marcas de
// integridad. Una nota baja o una posible copia las mira el docente una por una.
export const CONFIANZA_MINIMA_PARA_APROBAR_EN_LOTE = 0.8;
export const NOTA_MINIMA_PARA_APROBAR_EN_LOTE = 6;

// Lo que se guarda como calificación cuando el docente acepta la sugerencia (completa o para editarla).
export function datosDeCalificacionDesdeSugerencia(sugerencia, { aprobada }) {
  return {
    niveles: { ...sugerencia.niveles },
    comentariosPorCriterio: { ...sugerencia.comentariosPorCriterio },
    comentarioGeneral: sugerencia.comentarioGeneral ?? '',
    aprobada,
  };
}

// Las entregas que se pueden aprobar en lote: sin calificación del docente y con una sugerencia completa
// y de confianza alta. Aprobar en lote es una decisión del docente (un botón con confirmación), no un
// automatismo: la IA solo sugiere.
// `rubrica`: para calcular la nota que sugiere la IA. `entregasConMarcas`: Set de participantId con alguna marca de
// integridad por revisar (no entran al lote).
export function seleccionarParaAprobarEnLote(
  cola,
  { rubrica, entregasConMarcas = new Set(), umbral = CONFIANZA_MINIMA_PARA_APROBAR_EN_LOTE, notaMinima = NOTA_MINIMA_PARA_APROBAR_EN_LOTE } = {}
) {
  return cola.filter((item) => {
    if (
      item.estadoDeCalificacion !== ESTADOS_DE_CALIFICACION.SIN_CALIFICAR ||
      item.textoPendiente ||
      !item.sugerencia?.completa ||
      (item.sugerencia.confianza ?? 0) < umbral ||
      entregasConMarcas.has(item.participantId)
    ) {
      return false;
    }
    const notaSugerida = rubrica ? calcularNotaDeRubrica(rubrica, item.sugerencia.niveles) : null;
    return notaSugerida !== null && notaSugerida >= notaMinima;
  });
}
