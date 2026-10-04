import { describe, expect, it } from 'vitest';
import {
  MODOS_DE_CO_MODERACION,
  calcularCantidadDeCoModeradores,
  calcularCantidadSegunElPrograma,
  normalizarModeracion,
  calcularMaximoDeCoModeradoresPosible,
  resolverModoDeCoModeracion,
  sortearCoModeradores,
  validarDesignacionManual,
} from './calcularCoModeradores.js';

describe('calcularCantidadDeCoModeradores', () => {
  it('con 3 debatientes no hay co-moderadores como regla', () => {
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 3 })).toBe(0);
  });

  it('el modo reglamentario no se activa por debajo del mínimo de participantes', () => {
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 5 })).toBe(0);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 6 })).toBe(1);
  });

  it('el modo reglamentario usa ceil(10 %) a partir del mínimo', () => {
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 10 })).toBe(1);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 11 })).toBe(2);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 30 })).toBe(3);
  });

  it('respeta el tope máximo del Programa', () => {
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 60, topeMaximo: 4 })).toBe(4);
  });

  it('el modo sin co-moderadores devuelve cero siempre', () => {
    expect(
      calcularCantidadDeCoModeradores({ totalDeParticipantes: 40, modo: MODOS_DE_CO_MODERACION.NINGUNO })
    ).toBe(0);
  });

  it('el número fijo se respeta mientras queden al menos 3 debatientes', () => {
    const modo = MODOS_DE_CO_MODERACION.FIJO;
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 12, modo, numeroFijo: 2 })).toBe(2);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 4, modo, numeroFijo: 3 })).toBe(1);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 3, modo, numeroFijo: 2 })).toBe(0);
  });

  it('un número fijo vacío o negativo no produce co-moderadores', () => {
    const modo = MODOS_DE_CO_MODERACION.FIJO;
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 12, modo, numeroFijo: null })).toBe(0);
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 12, modo, numeroFijo: -2 })).toBe(0);
  });

  it('una sala vacía no tiene co-moderadores', () => {
    expect(calcularCantidadDeCoModeradores({ totalDeParticipantes: 0 })).toBe(0);
  });
});

describe('calcularMaximoDeCoModeradoresPosible', () => {
  it('deja siempre 3 personas debatiendo', () => {
    expect(calcularMaximoDeCoModeradoresPosible(3)).toBe(0);
    expect(calcularMaximoDeCoModeradoresPosible(10)).toBe(7);
  });
});

describe('resolverModoDeCoModeracion', () => {
  it('sin configuración usa el modo reglamentario', () => {
    expect(resolverModoDeCoModeracion({})).toBe(MODOS_DE_CO_MODERACION.REGLAMENTARIO);
    expect(resolverModoDeCoModeracion(null)).toBe(MODOS_DE_CO_MODERACION.REGLAMENTARIO);
  });

  it('ignora un modo desconocido', () => {
    expect(resolverModoDeCoModeracion({ moderacion: { modo: 'inventado' } })).toBe(
      MODOS_DE_CO_MODERACION.REGLAMENTARIO
    );
  });

  it('respeta un modo válido', () => {
    expect(resolverModoDeCoModeracion({ moderacion: { modo: 'ninguno' } })).toBe(MODOS_DE_CO_MODERACION.NINGUNO);
  });
});

describe('sortearCoModeradores', () => {
  const idsElegibles = ['a', 'b', 'c', 'd', 'e'];

  it('devuelve la cantidad pedida sin repetir a nadie', () => {
    const sorteados = sortearCoModeradores(idsElegibles, 3);
    expect(sorteados).toHaveLength(3);
    expect(new Set(sorteados).size).toBe(3);
    sorteados.forEach((idSorteado) => expect(idsElegibles).toContain(idSorteado));
  });

  it('no modifica la lista original', () => {
    const copia = [...idsElegibles];
    sortearCoModeradores(idsElegibles, 2);
    expect(idsElegibles).toEqual(copia);
  });

  it('es determinista con un generador aleatorio fijo', () => {
    const siempreCero = () => 0;
    expect(sortearCoModeradores(idsElegibles, 2, siempreCero)).toEqual(sortearCoModeradores(idsElegibles, 2, siempreCero));
  });

  it('con cantidad cero devuelve una lista vacía', () => {
    expect(sortearCoModeradores(idsElegibles, 0)).toEqual([]);
  });
});

describe('validarDesignacionManual', () => {
  const idsElegibles = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('acepta a quienes ya ingresaron', () => {
    const resultado = validarDesignacionManual({
      idsElegidos: ['a', 'b'],
      idsElegibles,
      totalDeParticipantes: 6,
    });
    expect(resultado.idsValidos).toEqual(['a', 'b']);
    expect(resultado.idsRechazados).toEqual([]);
  });

  it('rechaza a quien no está en la sala y a los repetidos', () => {
    const resultado = validarDesignacionManual({
      idsElegidos: ['a', 'zzz', 'a'],
      idsElegibles,
      totalDeParticipantes: 6,
    });
    expect(resultado.idsValidos).toEqual(['a']);
    expect(resultado.idsRechazados).toEqual(['zzz', 'a']);
  });

  it('no deja pasar del máximo que conserva 3 debatientes', () => {
    const resultado = validarDesignacionManual({
      idsElegidos: ['a', 'b', 'c', 'd', 'e'],
      idsElegibles,
      totalDeParticipantes: 6,
    });
    expect(resultado.idsValidos).toEqual(['a', 'b', 'c']);
    expect(resultado.superaElMaximo).toBe(true);
    expect(resultado.maximoPosible).toBe(3);
  });
});

describe('normalizarModeracion', () => {
  it('sin configuración usa el modo reglamentario y ningún número fijo', () => {
    expect(normalizarModeracion(undefined)).toEqual({ modo: 'reglamentario', numeroFijo: null });
  });

  it('descarta un número fijo inválido', () => {
    expect(normalizarModeracion({ modo: 'fijo', numeroFijo: 'abc' }).numeroFijo).toBeNull();
    expect(normalizarModeracion({ modo: 'fijo', numeroFijo: 0 }).numeroFijo).toBeNull();
    expect(normalizarModeracion({ modo: 'fijo', numeroFijo: '2' }).numeroFijo).toBe(2);
  });
});

describe('calcularCantidadSegunElPrograma', () => {
  it('un Programa sin moderación aplica la regla reglamentaria', () => {
    expect(calcularCantidadSegunElPrograma({}, 3)).toBe(0);
    expect(calcularCantidadSegunElPrograma({}, 12)).toBe(2);
  });

  it('respeta el modo y el número fijo del Programa', () => {
    expect(calcularCantidadSegunElPrograma({ moderacion: { modo: 'ninguno' } }, 30)).toBe(0);
    expect(calcularCantidadSegunElPrograma({ moderacion: { modo: 'fijo', numeroFijo: 4 } }, 30)).toBe(4);
  });

  it('respeta el tope máximo y el mínimo propios del Programa', () => {
    expect(calcularCantidadSegunElPrograma({ topeMaximoCoModeradores: 2 }, 60)).toBe(2);
    expect(calcularCantidadSegunElPrograma({ moderacion: { minimoParaCoModerar: 10 } }, 8)).toBe(0);
  });
});
