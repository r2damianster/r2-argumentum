// Lo propio del foro para el informe final (JSON y PDF) — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
// Función pura: arma, a partir del estado, todo lo que el moderador necesita para evaluar el foro.

import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import { calcularMetricasDeParticipacion } from '../../shared/nucleo/conciencia/calcularMetricasDeParticipacion.js';
import {
  contarReaccionesDeUnAporte,
  contarConvencimientoCruzado,
  resumirReaccionesDelForo,
} from '../../shared/nucleo/reacciones/contarReacciones.js';
import { describirEvaluacionDeCoModeradores } from '../../shared/nucleo/informe/evaluacionDeCoModeradores.js';
import { resumirRevisionDeUnAporte } from '../../shared/nucleo/revision/colaDeRevision.js';
import {
  calcularAjusteDeAportePorRevision,
  ESCALA_DE_REVISION_DE_APORTE,
  ETIQUETA_DE_NIVEL_DE_REVISION,
} from '../../shared/puntaje/puntajeDeAportes.js';
import {
  armarRevisionesDeAportes,
  puntajeProvisionalDelAporte,
  resolverNivelFinalDelAporte,
} from './ajustesAlCierreDelForo.js';

// Qué dijo la IA en conjunto, SIN señalar a nadie: las etiquetas de falacia no se muestran contra
// nombres en el informe general (no es una nota ni una acusación).
export function resumirSugerenciasDeLaIA(aportes) {
  const conSugerencia = aportes.filter((aporte) => aporte.sugerenciaDeIA);
  const contar = (completitud) => conSugerencia.filter((aporte) => aporte.sugerenciaDeIA.completitud === completitud).length;
  return {
    aportesConSugerencia: conSugerencia.length,
    aportesSinSugerencia: aportes.length - conSugerencia.length,
    completos: contar('completo'),
    incompletos: contar('incompleto'),
    sinRazon: contar('sin_razon'),
    conPosiblesFalacias: conSugerencia.filter((aporte) => (aporte.sugerenciaDeIA.falacias ?? []).length > 0).length,
  };
}

export function construirResumenDelForo({ estado, parametros, presencia = [] }) {
  const aportes = Object.values(estado.argumentos ?? {}).sort(
    (aporteA, aporteB) => (aporteA.timestamp ?? 0) - (aporteB.timestamp ?? 0)
  );

  const revisionDeAportes = aportes.map((aporte) => {
    const { puntaje, esReplica, ordinalDelTipo } = puntajeProvisionalDelAporte(estado, aporte, parametros);
    const { nivel, origen } = resolverNivelFinalDelAporte(estado, aporte);
    const resumen = resumirRevisionDeUnAporte(estado, aporte.argumentId);
    return {
      argumentId: aporte.argumentId,
      autor: nombreDeParticipante(presencia, aporte.participantId),
      participantId: aporte.participantId,
      stanceId: aporte.stanceId ?? null,
      tipoDeclarado: aporte.tipoDeclarado,
      respondeA: aporte.argumentoObjetivoId ?? null,
      texto: aporte.texto,
      esReplica,
      ordinalDelTipo,
      oculto: Boolean(aporte.oculto),
      puntajeAlPublicar: puntaje,
      sugerenciaDeIA: aporte.sugerenciaDeIA ?? null,
      votosDeCoModeradores: resumen.votos,
      decisionDelModerador: resumen.decisionModerador,
      nivelFinal: nivel,
      etiquetaDelNivelFinal: nivel === null ? 'Sin revisión: cuenta completo' : ETIQUETA_DE_NIVEL_DE_REVISION[nivel],
      origenDelNivelFinal: origen,
      ajusteAplicado: puntaje > 0 ? calcularAjusteDeAportePorRevision({ puntajeProvisional: puntaje, nivelFinal: nivel }) : 0,
      reacciones: contarReaccionesDeUnAporte(estado, aporte.argumentId),
      convencimientoCruzado: contarConvencimientoCruzado(estado, aporte.argumentId),
    };
  });

  return {
    metricasDeParticipacion: calcularMetricasDeParticipacion(estado),
    reacciones: resumirReaccionesDelForo(estado),
    resumenDeSugerenciasDeLaIA: resumirSugerenciasDeLaIA(aportes),
    evaluacionDeCoModeradores: describirEvaluacionDeCoModeradores({
      revisiones: armarRevisionesDeAportes(estado),
      escala: ESCALA_DE_REVISION_DE_APORTE,
      parametros,
      presencia,
    }),
    revisionDeAportes,
  };
}
