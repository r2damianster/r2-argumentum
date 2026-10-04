// Revisión entre pares del control de lectura, sobre el estado privado del docente — ver
// docs/14-control-de-lectura.md. Funciones puras: lo que cada par envió, lo que el docente aprobó, los
// puntos de quien revisa y el resultado que se le explica.

import {
  PUNTOS_MAXIMOS_POR_REVISION,
  calcularPuntosDeUnRevisor,
  compararConLaReferencia,
  describirLaDiferencia,
} from '../revisionEntrePares/puntajeDeRevisionEntrePares.js';
import { listarAutoresQueRevisa, listarRevisoresDeUnAutor } from '../revisionEntrePares/asignarRevisionesEntrePares.js';
import { filtrarComentariosPorCriterio, filtrarNivelesValidos } from '../rubrica/rubrica.js';
import { ESTADOS_DE_CALIFICACION } from './estadoPrivadoDelDocente.js';

export const DECISIONES_SOBRE_UNA_REVISION = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  DESCARTADA: 'descartada',
};

function laSalaRegistroLaRevision(estado, revisorId, indice) {
  return Boolean(estado.lectura?.revisiones?.[revisorId]?.[indice]);
}

// Las revisiones que recibió un autor, tal como las envió cada par y con lo que decidió el docente. Una
// revisión solo cuenta si la sala la registró (llegó en la fase de revisión, de alguien que entregó).
export function construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica, autorId }) {
  const asignaciones = estadoPrivado.asignaciones ?? {};
  return listarRevisoresDeUnAutor(asignaciones, autorId)
    .map((revisorId) => {
      const indice = listarAutoresQueRevisa(asignaciones, revisorId).indexOf(autorId);
      const enviada = estadoPrivado.revisionesEnviadas[revisorId]?.[indice];
      if (!enviada || !laSalaRegistroLaRevision(estado, revisorId, indice)) {
        return null;
      }
      const decision = estadoPrivado.moderacionDeRevisiones[autorId]?.[revisorId] ?? null;
      return {
        revisorId,
        indice,
        niveles: filtrarNivelesValidos(rubrica, enviada.niveles),
        comentariosPorCriterio: filtrarComentariosPorCriterio(rubrica, enviada.comentariosPorCriterio),
        comentarioGeneral: enviada.comentarioGeneral,
        decision: decision?.estado ?? DECISIONES_SOBRE_UNA_REVISION.PENDIENTE,
        // Lo que llega al autor si se aprobó: lo que dejó el docente (editado o no).
        paraElAutor: decision
          ? {
              comentariosPorCriterio: filtrarComentariosPorCriterio(rubrica, decision.comentariosPorCriterio),
              comentarioGeneral: decision.comentarioGeneral,
            }
          : null,
      };
    })
    .filter(Boolean);
}

// Las revisiones aprobadas de un autor, listas para ir en su devolución (solo comentarios).
export function listarRevisionesAprobadasParaElAutor(args) {
  return construirRevisionesDeUnAutor(args)
    .filter((revision) => revision.decision === DECISIONES_SOBRE_UNA_REVISION.APROBADA && revision.paraElAutor)
    .map((revision) => revision.paraElAutor);
}

// Revisiones pendientes de decisión del docente, en toda la sala.
export function contarRevisionesPorAprobar({ estadoPrivado, estado, rubrica }) {
  return Object.keys(estadoPrivado.asignaciones ?? {}).reduce(
    (suma, autorId) =>
      suma +
      construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica, autorId }).filter(
        (revision) => revision.decision === DECISIONES_SOBRE_UNA_REVISION.PENDIENTE
      ).length,
    0
  );
}

// Los textos que le tocan a una persona, sin el autor. El índice es lo único que ella conoce de cada uno.
export function prepararTextosParaRevisar({ estadoPrivado, revisorId }) {
  return listarAutoresQueRevisa(estadoPrivado.asignaciones, revisorId).map((autorId, indice) => ({
    indice,
    texto: estadoPrivado.textos[autorId]?.texto ?? '',
  }));
}

// Puntos de cada revisor, comparando su revisión con la calificación final (aprobada) del docente. Una
// revisión que el docente descartó no cuenta ni como acierto ni como esfuerzo.
export function calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica, cola, puntosPorRevision = PUNTOS_MAXIMOS_POR_REVISION }) {
  const colaPorAutor = Object.fromEntries(cola.map((item) => [item.participantId, item]));
  const resultado = {};

  for (const [revisorId, autores] of Object.entries(estadoPrivado.asignaciones ?? {})) {
    const revisiones = autores.map((autorId, indice) => {
      const enviada = estadoPrivado.revisionesEnviadas[revisorId]?.[indice];
      const decision = estadoPrivado.moderacionDeRevisiones[autorId]?.[revisorId];
      const valida =
        Boolean(enviada) &&
        laSalaRegistroLaRevision(estado, revisorId, indice) &&
        decision?.estado !== DECISIONES_SOBRE_UNA_REVISION.DESCARTADA;
      const delAutor = colaPorAutor[autorId];
      const referencia = delAutor?.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA ? delAutor.calificacion.niveles : null;
      const comparacion =
        valida && referencia
          ? compararConLaReferencia({
              rubrica,
              nivelesDelRevisor: filtrarNivelesValidos(rubrica, enviada.niveles),
              nivelesDeReferencia: referencia,
            })
          : null;
      return {
        indice,
        autorId,
        valida,
        descartada: decision?.estado === DECISIONES_SOBRE_UNA_REVISION.DESCARTADA,
        cercania: comparacion?.cercania ?? null,
        comparaciones: comparacion?.comparaciones ?? [],
      };
    });
    resultado[revisorId] = { ...calcularPuntosDeUnRevisor({ revisiones, puntosPorRevision }), revisiones };
  }
  return resultado;
}

// Lo que se le explica a quien revisó, sin revelar el nivel que recibió el texto ni su nota: solo si su
// criterio coincidió con el del docente.
export function construirResultadoParaUnRevisor(puntosDelRevisor) {
  return {
    hechas: puntosDelRevisor.hechas,
    asignadas: puntosDelRevisor.asignadas,
    puntos: puntosDelRevisor.puntos,
    revisiones: puntosDelRevisor.revisiones.map((revision) => ({
      indice: revision.indice,
      estado: revision.descartada ? 'descartada' : revision.valida ? 'enviada' : 'no_enviada',
      comparaciones: revision.comparaciones.map((comparacion) => ({
        nombre: comparacion.nombre,
        frase: describirLaDiferencia(comparacion.diferenciaDeNiveles),
      })),
      sinReferencia: revision.valida && revision.comparaciones.length === 0,
    })),
  };
}

// Puntuación para el podio: la nota de la entrega aprobada más los puntos de quien revisó bien. Quien no
// tiene ninguna de las dos no entra.
export function calcularPuntuacionesDelPodio({ cola, puntosDeRevisores = {} }) {
  const notas = Object.fromEntries(
    cola
      .filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA && item.nota !== null)
      .map((item) => [item.participantId, item.nota])
  );
  const participantes = new Set([...Object.keys(notas), ...Object.keys(puntosDeRevisores)]);
  return [...participantes]
    .map((participantId) => ({
      participantId,
      puntuacion: Math.round(((notas[participantId] ?? 0) + (puntosDeRevisores[participantId]?.puntos ?? 0)) * 100) / 100,
    }))
    .filter((registro) => registro.puntuacion > 0);
}
