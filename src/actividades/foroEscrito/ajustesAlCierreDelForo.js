// Puntaje de los aportes del foro al cerrar la sesión — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Función pura: recibe el estado y devuelve los cambios de puntaje que el motor publica, una sola vez,
// antes de `session.closed`. Hasta ese momento el marcador es provisional.
//
//   - Cada aporte acreditó su puntaje al publicarse (puntajeProvisionalDelAporte).
//   - La revisión humana lo ajusta: el moderador manda; si no intervino, rige la mayoría de los
//     co-moderadores; si nadie lo revisó, cuenta completo. Un aporte oculto no cuenta.
//   - Los co-moderadores puntúan por su porcentaje de acierto sobre el azar (nucleo/revision).

import {
  calcularAjusteDeAportePorRevision,
  calcularPuntajeDeAporte,
  ESCALA_DE_REVISION_DE_APORTE,
  ETIQUETA_DE_NIVEL_DE_REVISION,
  NIVELES_DE_REVISION_DE_APORTE,
  resolverLimitesDeAportesPuntuados,
} from '../../shared/puntaje/puntajeDeAportes.js';
import { calcularOrdinalDelTipo } from '../../shared/nucleo/conciencia/calcularMetricasDeParticipacion.js';
import {
  calcularPuntajeDeRevisores,
  calcularPuntajeMaximoDeRevisor,
  resolverNivelFinalDeRevision,
} from '../../shared/nucleo/revision/calcularPuntajeDeRevisores.js';
import { describirPuntajeDeRevisor } from '../../shared/puntaje/evaluacionDeExposiciones.js';

// Lo que vale un aporte al publicarse: según el lugar que ocupa entre los de su tipo (post o
// réplica) y los topes del Programa. 0 si se pasó de los topes.
export function puntajeProvisionalDelAporte(estado, aporte, parametros) {
  const { esReplica, ordinalDelTipo } = calcularOrdinalDelTipo(estado, aporte);
  const puntaje = calcularPuntajeDeAporte(
    { esReplica, ordinalDelTipo },
    parametros,
    resolverLimitesDeAportesPuntuados(estado.programa)
  );
  return { puntaje, esReplica, ordinalDelTipo };
}

// Qué se revisó, en la forma genérica del núcleo. Los aportes ocultos no se revisan: ya no cuentan.
export function armarRevisionesDeAportes(estado) {
  return Object.entries(estado.revisiones ?? {})
    .filter(([argumentId]) => estado.argumentos[argumentId] && !estado.argumentos[argumentId].oculto)
    .map(([argumentId, revision]) => ({
      elementoId: argumentId,
      nivelesPorRevisor: revision.niveles ?? {},
      decisionDelModerador: revision.decisionModerador ?? null,
    }));
}

// El nivel con el que se queda un aporte al cerrar y por qué. Un aporte oculto no cuenta; si no, rige el
// moderador o, sin él, la mayoría de los co-moderadores; sin revisión, cuenta completo (nivel null).
export function resolverNivelFinalDelAporte(estado, aporte) {
  if (aporte.oculto) {
    return {
      nivel: NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA,
      origen: 'oculto',
      motivo: 'Aporte oculto por la moderación: no cuenta',
    };
  }
  const revision = estado.revisiones?.[aporte.argumentId];
  const resolucion = resolverNivelFinalDeRevision({
    nivelesPorRevisor: revision?.niveles ?? {},
    decisionDelModerador: revision?.decisionModerador ?? null,
  });
  if (resolucion.nivel === null) {
    return { nivel: null, origen: resolucion.descartada ? 'descartada' : 'sin_revision', motivo: '' };
  }
  const origen = resolucion.delModerador ? 'moderador' : 'mayoria';
  return {
    nivel: resolucion.nivel,
    origen,
    motivo: `Revisión del aporte: ${ETIQUETA_DE_NIVEL_DE_REVISION[resolucion.nivel]?.toLowerCase() ?? ''} (${
      resolucion.delModerador ? 'decidió el moderador' : 'mayoría de co-moderadores'
    })`,
  };
}

export function calcularAjustesAlCierreDelForo({ estado, parametros }) {
  const ajustes = [];

  for (const aporte of Object.values(estado.argumentos ?? {})) {
    const { puntaje } = puntajeProvisionalDelAporte(estado, aporte, parametros);
    if (puntaje <= 0) {
      continue;
    }

    const { nivel, motivo } = resolverNivelFinalDelAporte(estado, aporte);
    const delta = calcularAjusteDeAportePorRevision({ puntajeProvisional: puntaje, nivelFinal: nivel });
    if (delta !== 0) {
      ajustes.push({ participantId: aporte.participantId, delta, categoria: 'argumento', motivo });
    }
  }

  const puntajeDeLosRevisores = calcularPuntajeDeRevisores({
    revisiones: armarRevisionesDeAportes(estado),
    escala: ESCALA_DE_REVISION_DE_APORTE,
    puntajeMaximo: calcularPuntajeMaximoDeRevisor(parametros),
  });
  for (const revisor of puntajeDeLosRevisores) {
    if (revisor.puntos > 0) {
      ajustes.push({
        participantId: revisor.revisorId,
        delta: revisor.puntos,
        categoria: 'co_moderacion',
        motivo: describirPuntajeDeRevisor(revisor),
      });
    }
  }

  return ajustes;
}
