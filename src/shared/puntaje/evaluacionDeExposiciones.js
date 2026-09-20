// Puntaje de la exposición oral de un argumento ya publicado — ver docs/05-reglas-de-puntaje.md.
//
// El argumento puntúa apenas Groq lo aprueba (fórmula única de posición × ronda × vía). Después,
// al exponerlo, los co-moderadores lo califican y el moderador puede evaluarlo o descartar sus
// calificaciones. Esas calificaciones AJUSTAN el puntaje, y ese ajuste se calcula una sola vez, al
// cerrar la sesión, cuando el moderador ya pudo revisar todo. Es una función pura: recibe el
// estado y devuelve los cambios de puntaje que hay que publicar.

import { CALIDADES_DE_EXPOSICION, DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION } from '../eventos/nombresDeEventos.js';
import { calcularPuntajeDeArgumento, calcularBonosDeCoModerador } from './formulaDePuntaje.js';

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

export function calcularAjustesDeExposiciones({ estado, parametros }) {
  const bonos = calcularBonosDeCoModerador(parametros);
  const ajustes = [];

  for (const exposicion of Object.values(estado.exposiciones ?? {})) {
    // Una exposición interrumpida o que seguía en curso al cerrar no llegó a completarse.
    const argumento = estado.argumentos[exposicion.argumentId];
    if (exposicion.estado !== 'terminada' || !argumento) {
      continue;
    }

    const { descartada, nivel, delModerador } = resolverNivelDeExposicion(exposicion);
    // Si el moderador descartó las calificaciones no hay ajuste ni bonos: sin referencia fiable,
    // nadie puede quedar como consistente o inconsistente.
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

    const nivelesPorCoModerador = Object.entries(exposicion.calificaciones ?? {})
      .map(([coModeradorId, calificacion]) => [coModeradorId, nivelDeCalidadDeExposicion(calificacion.calidad)])
      .filter(([, nivelDelCoModerador]) => nivelDelCoModerador !== null);

    for (const [coModeradorId, nivelDelCoModerador] of nivelesPorCoModerador) {
      const nivelDelModerador = delModerador ? nivel : null;
      if (nivelDelModerador !== null && nivelDelCoModerador === nivelDelModerador) {
        ajustes.push({
          participantId: coModeradorId,
          delta: bonos.VOTO_DE_BID_COINCIDENTE,
          categoria: 'co_moderacion',
          motivo: 'Su calificación de una exposición coincidió con la del moderador',
        });
      }
      const coincideConOtroCoModerador = nivelesPorCoModerador.some(
        ([otroCoModeradorId, nivelDelOtro]) =>
          otroCoModeradorId !== coModeradorId && nivelDelOtro === nivelDelCoModerador
      );
      if (coincideConOtroCoModerador) {
        ajustes.push({
          participantId: coModeradorId,
          delta: bonos.CONSISTENCIA_EN_REVISION_CRUZADA,
          categoria: 'co_moderacion',
          motivo: 'Su calificación de una exposición coincidió con la de otro co-moderador',
        });
      }
    }
  }

  return ajustes;
}
