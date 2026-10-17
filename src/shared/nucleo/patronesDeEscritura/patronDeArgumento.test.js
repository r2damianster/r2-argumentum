import { describe, expect, it } from 'vitest';
import {
  MODOS_DEL_PATRON,
  PATRON_POR_DEFECTO,
  avisoDeLongitudDelPatron,
  normalizarPatronDeArgumento,
  patronDeArgumentoActivo,
  patronesElegibles,
} from './patronDeArgumento.js';

describe('normalizarPatronDeArgumento', () => {
  it('sin dato queda apagado', () => {
    expect(normalizarPatronDeArgumento(undefined)).toEqual({ modo: MODOS_DEL_PATRON.NINGUNO, estructura: PATRON_POR_DEFECTO });
    expect(normalizarPatronDeArgumento({})).toEqual({ modo: MODOS_DEL_PATRON.NINGUNO, estructura: PATRON_POR_DEFECTO });
  });

  it('un modo o un patrón desconocido no rompe la sesión', () => {
    expect(normalizarPatronDeArgumento({ modo: 'inventado', estructura: 'toulmin' }).modo).toBe(MODOS_DEL_PATRON.NINGUNO);
    expect(normalizarPatronDeArgumento({ modo: 'con_retroalimentacion', estructura: 'inventado' }).estructura).toBe(PATRON_POR_DEFECTO);
  });

  it('la escritura libre no es un patrón elegible', () => {
    expect(patronesElegibles().map((patron) => patron.id)).toEqual(['peel', 'spre', 'prep', 'cer', 'toulmin']);
    expect(normalizarPatronDeArgumento({ modo: 'con_retroalimentacion', estructura: 'libre' }).estructura).toBe(PATRON_POR_DEFECTO);
  });
});

describe('patronDeArgumentoActivo', () => {
  it('devuelve null con el patrón apagado', () => {
    expect(patronDeArgumentoActivo({})).toBeNull();
    expect(patronDeArgumentoActivo({ patronDeArgumento: { modo: 'ninguno', estructura: 'cer' } })).toBeNull();
  });

  it('con retroalimentación, la IA le habla a quien escribe', () => {
    const patron = patronDeArgumentoActivo({ patronDeArgumento: { modo: 'con_retroalimentacion', estructura: 'cer' } });
    expect(patron.daRetroalimentacion).toBe(true);
    expect(patron.estructura.partes.map((parte) => parte.nombre)).toEqual(['Afirmación', 'Evidencia', 'Razonamiento']);
  });

  it('sin retroalimentación, la IA no le habla a quien escribe', () => {
    const patron = patronDeArgumentoActivo({ patronDeArgumento: { modo: 'sin_retroalimentacion', estructura: 'toulmin' } }, 'en');
    expect(patron.daRetroalimentacion).toBe(false);
    expect(patron.estructura.partes).toHaveLength(6);
    expect(patron.estructura.partes[4].nombre).toBe('Qualifier');
  });
});

describe('avisoDeLongitudDelPatron', () => {
  it('avisa en los patrones de párrafo y en los de cinco partes o más', () => {
    expect(avisoDeLongitudDelPatron('peel')).toMatch(/párrafo/);
    expect(avisoDeLongitudDelPatron('spre')).toMatch(/párrafo/);
    expect(avisoDeLongitudDelPatron('toulmin')).toMatch(/6 partes/);
  });

  it('no avisa en los patrones cortos', () => {
    expect(avisoDeLongitudDelPatron('cer')).toBe('');
    expect(avisoDeLongitudDelPatron('prep')).toBe('');
  });
});
