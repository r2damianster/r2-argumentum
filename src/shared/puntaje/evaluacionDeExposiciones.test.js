import { describe, it, expect } from 'vitest';
import { calcularAjustesDeExposiciones, calcularNivelPromedioDeExposicion } from './evaluacionDeExposiciones.js';
import { resolverParametrosDePuntaje } from './perfilesDePuntaje.js';

const PARAMETROS_ESTANDAR = resolverParametrosDePuntaje({ perfilDePuntaje: 'estandar' });

// Ana expuso su argumento de posición 1, ronda 1: vale 100 en Estándar.
function estadoConExposicion(exposicion) {
  return {
    argumentos: {
      a1: { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1, viaCoModerador: false },
    },
    exposiciones: {
      a1: {
        argumentId: 'a1',
        participantId: 'ana',
        estado: 'terminada',
        calificaciones: {},
        decisionModerador: null,
        ...exposicion,
      },
    },
  };
}

function ajustesDe(exposicion, parametros = PARAMETROS_ESTANDAR) {
  return calcularAjustesDeExposiciones({ estado: estadoConExposicion(exposicion), parametros });
}

function deltaDe(ajustes, participantId, categoria) {
  return ajustes
    .filter((ajuste) => ajuste.participantId === participantId && ajuste.categoria === categoria)
    .reduce((suma, ajuste) => suma + ajuste.delta, 0);
}

describe('promedio de las calificaciones de los co-moderadores', () => {
  it('promedia los niveles: buena +1, aceptable 0, insuficiente −1', () => {
    const promedio = calcularNivelPromedioDeExposicion({
      c1: { calidad: 'buena' },
      c2: { calidad: 'aceptable' },
      c3: { calidad: 'insuficiente' },
    });

    expect(promedio).toBe(0);
  });

  it('sin calificaciones no hay promedio', () => {
    expect(calcularNivelPromedioDeExposicion({})).toBeNull();
  });
});

describe('ajuste al puntaje del expositor', () => {
  it('con dos co-moderadores que dicen «buena» duplica lo que ya valía el argumento', () => {
    const ajustes = ajustesDe({ calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } } });

    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(100);
  });

  it('se promedian: una «buena» y una «aceptable» dan la mitad', () => {
    const ajustes = ajustesDe({ calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'aceptable' } } });

    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(50);
  });

  it('«insuficiente» anula el argumento y «no está hablando» también', () => {
    const insuficiente = ajustesDe({ calificaciones: { c1: { calidad: 'insuficiente' } } });
    const sinExposicion = ajustesDe({ calificaciones: { c1: { calidad: 'sin_exposicion' } } });

    expect(deltaDe(insuficiente, 'ana', 'argumento')).toBe(-100);
    expect(deltaDe(sinExposicion, 'ana', 'argumento')).toBe(-100);
  });

  it('escala con el perfil elegido', () => {
    const parametrosLivianos = resolverParametrosDePuntaje({ perfilDePuntaje: 'liviano' });
    const ajustes = ajustesDe({ calificaciones: { c1: { calidad: 'buena' } } }, parametrosLivianos);

    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(10);
  });

  it('el descuento de ronda y de vía del argumento se respeta al ajustar', () => {
    const estado = estadoConExposicion({ calificaciones: { c1: { calidad: 'buena' } } });
    estado.argumentos.a1.ronda = 2;
    estado.argumentos.a1.viaCoModerador = true;

    const ajustes = calcularAjustesDeExposiciones({ estado, parametros: PARAMETROS_ESTANDAR });

    // 100 × 0,7 × 0,5 = 35
    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(35);
  });

  it('una exposición que no terminó no ajusta nada', () => {
    const ajustes = ajustesDe({ estado: 'interrumpida', calificaciones: { c1: { calidad: 'buena' } } });

    expect(ajustes).toEqual([]);
  });

  it('sin calificaciones ni decisión del moderador no hay ajuste', () => {
    expect(ajustesDe({})).toEqual([]);
  });
});

describe('decisión del moderador', () => {
  it('si el moderador evalúa, su nivel manda sobre el promedio de los co-moderadores', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } },
      decisionModerador: { decision: 'evaluada', calidad: 'insuficiente' },
    });

    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(-100);
  });

  it('si el moderador evalúa sin que nadie más haya calificado, igual ajusta', () => {
    const ajustes = ajustesDe({ decisionModerador: { decision: 'evaluada', calidad: 'buena' } });

    expect(deltaDe(ajustes, 'ana', 'argumento')).toBe(100);
  });

  it('si el moderador descarta las calificaciones no hay ajuste ni puntaje de revisión', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } },
      decisionModerador: { decision: 'descartada', calidad: null },
    });

    expect(ajustes).toEqual([]);
  });
});

describe('puntaje de los co-moderadores por su acierto', () => {
  // Estándar: puntaje máximo de un revisor = 100 + 80 + 30 = 210; con una sola exposición revisada
  // el esfuerzo es 1/7, así que el acierto total vale 30 puntos (ver nucleo/revision).
  const PUNTOS_CON_ACIERTO_TOTAL_Y_UNA_REVISION = 30;

  it('quien coincide con el moderador puntúa y quien opina lo opuesto no suma', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'insuficiente' } },
      decisionModerador: { decision: 'evaluada', calidad: 'buena' },
    });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(PUNTOS_CON_ACIERTO_TOTAL_Y_UNA_REVISION);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(0);
  });

  it('quedar a un paso del moderador equivale al azar: no suma por encima del azar', () => {
    const cercaDelModerador = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' } },
      decisionModerador: { decision: 'evaluada', calidad: 'aceptable' },
    });

    // Cercanía 0,5 = lo que se logra al azar: no hay mérito sobre el azar.
    expect(deltaDe(cercaDelModerador, 'c1', 'co_moderacion')).toBe(0);
  });

  it('sin moderador rige el consenso: quien coincide con la mayoría puntúa', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' }, c3: { calidad: 'insuficiente' } },
    });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(PUNTOS_CON_ACIERTO_TOTAL_Y_UNA_REVISION);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(PUNTOS_CON_ACIERTO_TOTAL_Y_UNA_REVISION);
    expect(deltaDe(ajustes, 'c3', 'co_moderacion')).toBe(0);
  });

  it('la referencia es el moderador aunque los co-moderadores coincidan entre sí', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } },
      decisionModerador: { decision: 'evaluada', calidad: 'insuficiente' },
    });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(0);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(0);
  });

  it('un solo co-moderador sin moderador igual recibe reconocimiento por su esfuerzo', () => {
    const ajustes = ajustesDe({ calificaciones: { c1: { calidad: 'buena' } } });

    // Sin referencia el acierto es neutro (0,5): la mitad de lo que valdría acertar del todo.
    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(PUNTOS_CON_ACIERTO_TOTAL_Y_UNA_REVISION / 2);
  });
});

describe('votos de bids en el puntaje de los co-moderadores', () => {
  function ajustesDeBids(bids) {
    return calcularAjustesDeExposiciones({
      estado: { exposiciones: {}, argumentos: {}, bids },
      parametros: PARAMETROS_ESTANDAR,
    });
  }

  it('votar como decidió el moderador puntúa al cierre, no al resolverse el bid', () => {
    const ajustes = ajustesDeBids({
      b1: { bidId: 'b1', decisionFinal: 'aprobado', votos: { c1: 'aprueba', c2: 'rechaza' } },
    });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(30);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(0);
  });

  it('los bids sin decisión final del moderador no entran en el cálculo', () => {
    const ajustes = ajustesDeBids({ b1: { bidId: 'b1', decisionFinal: null, votos: { c1: 'aprueba' } } });

    expect(ajustes).toEqual([]);
  });

  it('exposiciones y bids se suman en un mismo porcentaje de acierto y de esfuerzo', () => {
    const ajustes = calcularAjustesDeExposiciones({
      estado: {
        argumentos: { a1: { argumentId: 'a1', posicionEnRonda: 1, ronda: 1 } },
        exposiciones: {
          a1: {
            argumentId: 'a1',
            participantId: 'ana',
            estado: 'terminada',
            calificaciones: { c1: { calidad: 'buena' } },
            decisionModerador: { decision: 'evaluada', calidad: 'buena' },
          },
        },
        bids: { b1: { bidId: 'b1', decisionFinal: 'aprobado', votos: { c1: 'aprueba' } } },
      },
      parametros: PARAMETROS_ESTANDAR,
    });

    // 2 revisiones con acierto total → esfuerzo 2/7 → 210 × 2/7 = 60
    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(60);
  });
});
