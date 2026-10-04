import { describe, expect, it } from 'vitest';
import {
  ACIERTO_SIN_REFERENCIA,
  ORIGENES_DE_REFERENCIA,
  asignarRevisores,
  calcularCercaniaEntreNiveles,
  calcularMediana,
  calcularPuntajeDeRevisores,
  calcularPuntajeMaximoDeRevisor,
  corregirAciertoPorAzar,
  normalizarNivel,
  resolverNivelFinalDeRevision,
  resolverReferenciaDeRevision,
} from './calcularPuntajeDeRevisores.js';
import { PERFILES_DE_PUNTAJE } from '../../puntaje/perfilesDePuntaje.js';

const ESCALA = { minimo: 0, maximo: 1 };
const evaluadaPorElModerador = (nivel) => ({ decision: 'evaluada', nivel });

describe('calcularCercaniaEntreNiveles', () => {
  it('vale 1 si coinciden, 0,5 a un paso y 0 en los extremos opuestos', () => {
    expect(calcularCercaniaEntreNiveles(1, 1, ESCALA)).toBe(1);
    expect(calcularCercaniaEntreNiveles(0.5, 1, ESCALA)).toBe(0.5);
    expect(calcularCercaniaEntreNiveles(0, 1, ESCALA)).toBe(0);
  });

  it('funciona con cualquier escala', () => {
    expect(calcularCercaniaEntreNiveles(-1, 1, { minimo: -1, maximo: 1 })).toBe(0);
    expect(calcularCercaniaEntreNiveles(0, 1, { minimo: -1, maximo: 1 })).toBe(0.5);
  });

  it('rechaza una escala sin rango', () => {
    expect(() => calcularCercaniaEntreNiveles(0, 0, { minimo: 1, maximo: 1 })).toThrow();
  });
});

describe('normalizarNivel', () => {
  it('lleva la escala −1 / 0 / +1 de las exposiciones a 0 / 0,5 / 1', () => {
    const escalaDeExposiciones = { minimo: -1, maximo: 1 };
    expect(normalizarNivel(-1, escalaDeExposiciones)).toBe(0);
    expect(normalizarNivel(0, escalaDeExposiciones)).toBe(0.5);
    expect(normalizarNivel(1, escalaDeExposiciones)).toBe(1);
  });
});

describe('calcularMediana', () => {
  it('toma el valor central y promedia los dos centrales si son pares', () => {
    expect(calcularMediana([1, 0, 1])).toBe(1);
    expect(calcularMediana([0, 1])).toBe(0.5);
    expect(calcularMediana([])).toBeNull();
  });
});

describe('resolverNivelFinalDeRevision', () => {
  it('manda el moderador aunque contradiga a los co-moderadores', () => {
    const resultado = resolverNivelFinalDeRevision({
      nivelesPorRevisor: { a: 1, b: 1 },
      decisionDelModerador: evaluadaPorElModerador(0),
    });
    expect(resultado).toEqual({ nivel: 0, descartada: false, delModerador: true });
  });

  it('si el moderador no interviene rige la mayoría de los co-moderadores', () => {
    const resultado = resolverNivelFinalDeRevision({ nivelesPorRevisor: { a: 1, b: 1, c: 0 } });
    expect(resultado).toEqual({ nivel: 1, descartada: false, delModerador: false });
  });

  it('si el moderador descartó, no hay nivel', () => {
    const resultado = resolverNivelFinalDeRevision({
      nivelesPorRevisor: { a: 1 },
      decisionDelModerador: { decision: 'descartada' },
    });
    expect(resultado).toEqual({ nivel: null, descartada: true, delModerador: false });
  });

  it('sin revisiones no hay nivel y el aporte queda con su puntaje', () => {
    expect(resolverNivelFinalDeRevision({}).nivel).toBeNull();
  });
});

describe('resolverReferenciaDeRevision', () => {
  it('prefiere al moderador con peso 1', () => {
    const referencia = resolverReferenciaDeRevision({
      nivelesPorRevisor: { a: 1, b: 0 },
      decisionDelModerador: evaluadaPorElModerador(0.5),
    });
    expect(referencia).toEqual({ nivel: 0.5, origen: ORIGENES_DE_REFERENCIA.MODERADOR, peso: 1 });
  });

  it('sin moderador usa el consenso de los co-moderadores (la mayoría)', () => {
    const referencia = resolverReferenciaDeRevision({ nivelesPorRevisor: { a: 0, b: 1, c: 1 } });
    expect(referencia).toEqual({ nivel: 1, origen: ORIGENES_DE_REFERENCIA.CONSENSO, peso: 0.6 });
  });

  it('un único co-moderador sin moderador no tiene referencia', () => {
    const referencia = resolverReferenciaDeRevision({ nivelesPorRevisor: { a: 1 } });
    expect(referencia.origen).toBeNull();
    expect(referencia.nivel).toBeNull();
  });

  it('si el moderador descartó no hay referencia fiable', () => {
    const referencia = resolverReferenciaDeRevision({
      nivelesPorRevisor: { a: 1, b: 1 },
      decisionDelModerador: { decision: 'descartada' },
    });
    expect(referencia).toEqual({ nivel: null, origen: ORIGENES_DE_REFERENCIA.DESCARTADA, peso: 0 });
  });
});

describe('corregirAciertoPorAzar', () => {
  it('votar al azar (cercanía 0,5) no suma, y la coincidencia total suma todo', () => {
    expect(corregirAciertoPorAzar(0.5)).toBe(0);
    expect(corregirAciertoPorAzar(1)).toBe(1);
    expect(corregirAciertoPorAzar(0.75)).toBe(0.5);
  });

  it('nunca es negativo', () => {
    expect(corregirAciertoPorAzar(0.1)).toBe(0);
  });
});

describe('calcularPuntajeMaximoDeRevisor', () => {
  it('es la suma de las posiciones del perfil y escala con él', () => {
    expect(calcularPuntajeMaximoDeRevisor(PERFILES_DE_PUNTAJE.liviano)).toBe(21);
    expect(calcularPuntajeMaximoDeRevisor(PERFILES_DE_PUNTAJE.estandar)).toBe(210);
    expect(calcularPuntajeMaximoDeRevisor(PERFILES_DE_PUNTAJE.estricto)).toBe(2100);
  });
});

describe('calcularPuntajeDeRevisores', () => {
  const puntajeMaximo = 210;

  function revisar(revisiones, opciones = {}) {
    return calcularPuntajeDeRevisores({ revisiones, escala: ESCALA, puntajeMaximo, ...opciones });
  }

  it('el ejemplo del plan: 8 revisadas, 6 con referencia, cercanías 1,1,1,0.5,1,0 → 105 puntos', () => {
    const cercaniasDeLaReferencia = [1, 1, 1, 0.5, 1, 0];
    // El nivel de Marta es siempre 1; el del moderador se elige para que la cercanía sea la deseada.
    const nivelDelModeradorPorCercania = { 1: 1, 0.5: 0.5, 0: 0 };
    const revisionesConReferencia = cercaniasDeLaReferencia.map((cercania, indice) => ({
      elementoId: `con-referencia-${indice}`,
      nivelesPorRevisor: { marta: 1 },
      decisionDelModerador: evaluadaPorElModerador(nivelDelModeradorPorCercania[cercania]),
    }));
    const revisionesSinReferencia = [0, 1].map((indice) => ({
      elementoId: `sin-referencia-${indice}`,
      nivelesPorRevisor: { marta: 1 },
      decisionDelModerador: null,
    }));

    const [resultadoDeMarta] = revisar([...revisionesConReferencia, ...revisionesSinReferencia]);

    expect(resultadoDeMarta.revisadas).toBe(8);
    expect(resultadoDeMarta.conReferencia).toBe(6);
    expect(resultadoDeMarta.cercaniaPromedio).toBeCloseTo(0.75);
    expect(resultadoDeMarta.acierto).toBeCloseTo(0.5);
    expect(resultadoDeMarta.esfuerzo).toBe(1);
    expect(resultadoDeMarta.puntos).toBe(105);
  });

  it('coincidir siempre con el consenso, con poco esfuerzo, da 120 como en el plan', () => {
    const revisiones = [0, 1, 2, 3].map((indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { luis: 1, ana: 1 },
      decisionDelModerador: null,
    }));
    const resultados = revisar(revisiones);
    const resultadoDeLuis = resultados.find((resultado) => resultado.revisorId === 'luis');
    expect(resultadoDeLuis.acierto).toBe(1);
    expect(resultadoDeLuis.esfuerzo).toBeCloseTo(4 / 7);
    expect(resultadoDeLuis.puntos).toBe(120);
  });

  it('sin moderador que evalúe los co-moderadores igual puntúan, por consenso entre ellos', () => {
    const revisiones = Array.from({ length: 7 }, (_, indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { luis: 1, ana: 1 },
      decisionDelModerador: null,
    }));
    const resultados = revisar(revisiones);
    expect(resultados.every((resultado) => resultado.puntos === puntajeMaximo)).toBe(true);
  });

  it('votar siempre lo contrario de la referencia no suma puntos', () => {
    const revisiones = Array.from({ length: 7 }, (_, indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { contrario: 0 },
      decisionDelModerador: evaluadaPorElModerador(1),
    }));
    const [resultado] = revisar(revisiones);
    expect(resultado.acierto).toBe(0);
    expect(resultado.puntos).toBe(0);
  });

  it('votar al azar no suma: cercanía media de 0,5 da acierto 0', () => {
    const revisiones = [0, 1].map((indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { azar: indice === 0 ? 1 : 0 },
      decisionDelModerador: evaluadaPorElModerador(0.5),
    }));
    const [resultado] = revisar(revisiones);
    expect(resultado.cercaniaPromedio).toBe(0.5);
    expect(resultado.puntos).toBe(0);
  });

  it('con un único co-moderador y sin moderador se reconoce el esfuerzo con acierto neutro', () => {
    const revisiones = Array.from({ length: 7 }, (_, indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { solo: 1 },
      decisionDelModerador: null,
    }));
    const [resultado] = revisar(revisiones);
    expect(resultado.conReferencia).toBe(0);
    expect(resultado.acierto).toBe(ACIERTO_SIN_REFERENCIA);
    expect(resultado.puntos).toBe(105);
  });

  it('si el moderador descarta las revisiones de un aporte, ese aporte no cuenta ni como acierto ni como esfuerzo', () => {
    const resultados = revisar([
      { elementoId: 'a', nivelesPorRevisor: { solo: 1 }, decisionDelModerador: { decision: 'descartada' } },
    ]);
    expect(resultados).toEqual([]);
  });

  it('la referencia del moderador pesa más que el consenso al promediar', () => {
    const [resultado] = revisar([
      // Con el moderador (peso 1): coincide → cercanía 1
      { elementoId: 'a', nivelesPorRevisor: { luis: 1 }, decisionDelModerador: evaluadaPorElModerador(1) },
      // Solo con consenso (peso 0,6): la mediana de 1 y 0 es 0,5 → cercanía 0,5
      { elementoId: 'b', nivelesPorRevisor: { luis: 1, ana: 0 }, decisionDelModerador: null },
    ]).filter((resultado) => resultado.revisorId === 'luis');
    expect(resultado.cercaniaPromedio).toBeCloseTo((1 + 0.6 * 0.5) / 1.6);
  });

  it('el número de revisiones objetivo es configurable', () => {
    const revisiones = Array.from({ length: 2 }, (_, indice) => ({
      elementoId: `aporte-${indice}`,
      nivelesPorRevisor: { luis: 1, ana: 1 },
      decisionDelModerador: null,
    }));
    const resultados = revisar(revisiones, { revisionesObjetivo: 2 });
    expect(resultados.every((resultado) => resultado.puntos === puntajeMaximo)).toBe(true);
  });

  it('sin revisiones no devuelve a nadie', () => {
    expect(revisar([])).toEqual([]);
  });
});

describe('asignarRevisores', () => {
  const coModeradores = ['co-3', 'co-1', 'co-2'];

  it('devuelve la cantidad pedida sin repetir a nadie', () => {
    const asignados = asignarRevisores('aporte-1', coModeradores, 2);
    expect(asignados).toHaveLength(2);
    expect(new Set(asignados).size).toBe(2);
  });

  it('es estable: el mismo aporte siempre cae en los mismos revisores, sin importar el orden de la lista', () => {
    const primera = asignarRevisores('aporte-77', coModeradores, 2);
    const segunda = asignarRevisores('aporte-77', [...coModeradores].reverse(), 2);
    expect(segunda).toEqual(primera);
  });

  it('reparte el trabajo entre todos los co-moderadores', () => {
    const conteo = {};
    for (let indice = 0; indice < 300; indice += 1) {
      for (const revisorId of asignarRevisores(`aporte-${indice}`, coModeradores, 1)) {
        conteo[revisorId] = (conteo[revisorId] ?? 0) + 1;
      }
    }
    for (const revisorId of coModeradores) {
      expect(conteo[revisorId]).toBeGreaterThan(50);
    }
  });

  it('con menos co-moderadores que la cantidad pedida los asigna a todos', () => {
    expect(asignarRevisores('aporte-1', ['solo'], 2)).toEqual(['solo']);
  });

  it('sin co-moderadores no asigna a nadie', () => {
    expect(asignarRevisores('aporte-1', [], 2)).toEqual([]);
  });
});
