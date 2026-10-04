// Puntaje de la exposición oral de un argumento ya publicado — ver docs/05-reglas-de-puntaje.md.
//
// El argumento puntúa apenas Groq lo aprueba (fórmula única de posición × ronda × vía). Después,
// al exponerlo, los co-moderadores lo califican y el moderador puede evaluarlo o descartar sus
// calificaciones. Esas calificaciones AJUSTAN el puntaje, y ese ajuste se calcula una sola vez, al
// cerrar la sesión, cuando el moderador ya pudo revisar todo. Es una función pura: recibe el
// estado y devuelve los cambios de puntaje que hay que publicar.

import { CALIDADES_DE_EXPOSICION, DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION } from '../eventos/nombresDeEventos.js';
import { calcularPuntajeDeArgumento } from './formulaDePuntaje.js';
import {
  DECISIONES_DEL_MODERADOR_SOBRE_REVISION,
  calcularPuntajeDeRevisores,
  calcularPuntajeMaximoDeRevisor,
  normalizarNivel,
} from '../nucleo/revision/calcularPuntajeDeRevisores.js';

// Las exposiciones califican en −1 / 0 / +1; la revisión del núcleo trabaja en 0 a 1.
const ESCALA_DE_EXPOSICION = { minimo: -1, maximo: 1 };
const ESCALA_DE_REVISION = { minimo: 0, maximo: 1 };

// Misma escala que el turno hablado: «buena» duplica lo que ya valía el argumento (+base),
// «aceptable» lo deja igual e «insuficiente» lo anula (−base). No haber hablado cuenta como lo peor.
const NIVEL_POR_CALIDAD = {
  [CALIDADES_DE_EXPOSICION.BUENA]: 1,
  [CALIDADES_DE_EXPOSICION.ACEPTABLE]: 0,
  [CALIDADES_DE_EXPOSICION.INSUFICIENTE]: -1,
  [CALIDADES_DE_EXPOSICION.SIN_EXPOSICION]: -1,
};

export function nivelDeCalidadDeExposicion(calidad) {
  return NIVEL_POR_CALIDAD[calidad] ?? null;
}

// Promedio de los niveles de las calificaciones de los co-moderadores, o null si no hay ninguna.
export function calcularNivelPromedioDeExposicion(calificaciones) {
  const niveles = Object.values(calificaciones ?? {})
    .map((calificacion) => nivelDeCalidadDeExposicion(calificacion.calidad))
    .filter((nivel) => nivel !== null);
  if (niveles.length === 0) {
    return null;
  }
  return niveles.reduce((suma, nivel) => suma + nivel, 0) / niveles.length;
}

// Nivel que rige una exposición: el del moderador si la evaluó (autoritativo), ninguno si descartó
// las calificaciones, y el promedio de los co-moderadores si no intervino.
export function resolverNivelDeExposicion(exposicion) {
  const decision = exposicion.decisionModerador;
  if (decision?.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.DESCARTADA) {
    return { descartada: true, nivel: null, delModerador: false };
  }
  if (decision?.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.EVALUADA) {
    return { descartada: false, nivel: nivelDeCalidadDeExposicion(decision.calidad), delModerador: true };
  }
  return {
    descartada: false,
    nivel: calcularNivelPromedioDeExposicion(exposicion.calificaciones),
    delModerador: false,
  };
}

function nivelNormalizadoDeCalidad(calidad) {
  const nivel = nivelDeCalidadDeExposicion(calidad);
  return nivel === null ? null : normalizarNivel(nivel, ESCALA_DE_EXPOSICION, ESCALA_DE_REVISION);
}

// Traduce lo que el debate hablado revisa (calificar exposiciones y votar bids) a la forma genérica
// del núcleo de revisión: un elemento con los niveles de cada co-moderador y la decisión del moderador.
export function armarRevisionesDeCoModeradores(estado) {
  const revisionesDeExposiciones = Object.values(estado.exposiciones ?? {})
    .filter((exposicion) => exposicion.estado === 'terminada' && estado.argumentos[exposicion.argumentId])
    .map((exposicion) => {
      const nivelesPorRevisor = {};
      for (const [coModeradorId, calificacion] of Object.entries(exposicion.calificaciones ?? {})) {
        const nivel = nivelNormalizadoDeCalidad(calificacion.calidad);
        if (nivel !== null) {
          nivelesPorRevisor[coModeradorId] = nivel;
        }
      }
      const decision = exposicion.decisionModerador;
      let decisionDelModerador = null;
      if (decision?.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.DESCARTADA) {
        decisionDelModerador = { decision: DECISIONES_DEL_MODERADOR_SOBRE_REVISION.DESCARTADA };
      } else if (decision?.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.EVALUADA) {
        decisionDelModerador = {
          decision: DECISIONES_DEL_MODERADOR_SOBRE_REVISION.EVALUADA,
          nivel: nivelNormalizadoDeCalidad(decision.calidad),
        };
      }
      return { elementoId: `exposicion:${exposicion.argumentId}`, nivelesPorRevisor, decisionDelModerador };
    });

  // Un bid se vota «aprueba» (1) o «rechaza» (0) y el moderador siempre tiene la última palabra.
  const revisionesDeBids = Object.values(estado.bids ?? {})
    .filter((bid) => bid.decisionFinal)
    .map((bid) => ({
      elementoId: `bid:${bid.bidId}`,
      nivelesPorRevisor: Object.fromEntries(
        Object.entries(bid.votos ?? {}).map(([coModeradorId, voto]) => [coModeradorId, voto === 'aprueba' ? 1 : 0])
      ),
      decisionDelModerador: {
        decision: DECISIONES_DEL_MODERADOR_SOBRE_REVISION.EVALUADA,
        nivel: bid.decisionFinal === 'aprobado' ? 1 : 0,
      },
    }));

  return [...revisionesDeExposiciones, ...revisionesDeBids];
}

export function calcularAjustesDeExposiciones({ estado, parametros }) {
  const ajustes = [];

  for (const exposicion of Object.values(estado.exposiciones ?? {})) {
    // Una exposición interrumpida o que seguía en curso al cerrar no llegó a completarse.
    const argumento = estado.argumentos[exposicion.argumentId];
    if (exposicion.estado !== 'terminada' || !argumento) {
      continue;
    }

    const { descartada, nivel, delModerador } = resolverNivelDeExposicion(exposicion);
    // Si el moderador descartó las calificaciones, o nadie calificó, el expositor no tiene ajuste.
    if (descartada || nivel === null) {
      continue;
    }

    const puntajeBase = calcularPuntajeDeArgumento(
      {
        posicionEnRonda: argumento.posicionEnRonda,
        ronda: argumento.ronda,
        viaCoModerador: argumento.viaCoModerador,
      },
      parametros
    );
    const ajuste = Math.round(nivel * puntajeBase);
    if (ajuste !== 0) {
      ajustes.push({
        participantId: exposicion.participantId,
        delta: ajuste,
        categoria: 'argumento',
        motivo: delModerador
          ? 'Exposición evaluada por el moderador'
          : 'Exposición calificada por los co-moderadores (promedio)',
      });
    }
  }

  // Los co-moderadores puntúan por su porcentaje de acierto sobre el azar y por cuánto revisaron,
  // no por coincidir exacta y puntualmente (ver nucleo/revision y docs/05). Si el moderador no
  // evaluó, rige el consenso entre ellos, así que igual puntúan.
  const puntajeDeLosRevisores = calcularPuntajeDeRevisores({
    revisiones: armarRevisionesDeCoModeradores(estado),
    escala: ESCALA_DE_REVISION,
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

export function describirPuntajeDeRevisor(revisor) {
  const porcentajeDeAcierto = Math.round(revisor.acierto * 100);
  return revisor.conReferencia > 0
    ? `Calidad de sus revisiones: ${porcentajeDeAcierto} % de acierto sobre el azar en ${revisor.conReferencia} de ${revisor.revisadas} casos`
    : `Revisó ${revisor.revisadas} caso(s) sin referencia contra la cual medir su acierto`;
}
