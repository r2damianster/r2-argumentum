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

  it('si el moderador descarta las calificaciones no hay ajuste ni bonos', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } },
      decisionModerador: { decision: 'descartada', calidad: null },
    });

    expect(ajustes).toEqual([]);
  });
});

describe('consistencia de los co-moderadores', () => {
  it('quien coincide con el moderador cobra el bono de coincidencia', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'insuficiente' } },
      decisionModerador: { decision: 'evaluada', calidad: 'buena' },
    });

    // Estándar: los bonos escalan ×10 (VOTO_DE_BID_COINCIDENTE = 5 → 50).
    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(50);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(0);
  });

  it('con dos co-moderadores que coinciden entre sí cobran el bono de revisión cruzada', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' }, c3: { calidad: 'insuficiente' } },
    });

    // CONSISTENCIA_EN_REVISION_CRUZADA = 3 → 30 en Estándar; sin moderador, solo cuenta este.
    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(30);
    expect(deltaDe(ajustes, 'c2', 'co_moderacion')).toBe(30);
    expect(deltaDe(ajustes, 'c3', 'co_moderacion')).toBe(0);
  });

  it('coincidir con el moderador y con otro co-moderador suma los dos bonos', () => {
    const ajustes = ajustesDe({
      calificaciones: { c1: { calidad: 'buena' }, c2: { calidad: 'buena' } },
      decisionModerador: { decision: 'evaluada', calidad: 'buena' },
    });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(80);
  });

  it('un solo co-moderador sin moderador no puede coincidir con nadie', () => {
    const ajustes = ajustesDe({ calificaciones: { c1: { calidad: 'buena' } } });

    expect(deltaDe(ajustes, 'c1', 'co_moderacion')).toBe(0);
  });
});
