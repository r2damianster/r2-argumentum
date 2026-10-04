import { describe, expect, it } from 'vitest';
import { MINIMO_DE_PALABRAS_DE_UN_APORTE, contarPalabras } from './contarPalabras.js';

describe('contarPalabras', () => {
  it('cuenta palabras con tildes y ñ', () => {
    expect(contarPalabras('La educación española enseña')).toBe(4);
  });

  it('ignora signos de puntuación y espacios repetidos', () => {
    expect(contarPalabras('  Sí,   porque... ¿no? ')).toBe(3);
  });

  it('cuenta números como palabras', () => {
    expect(contarPalabras('En 2026 hubo 3 casos')).toBe(5);
  });

  it('un texto vacío o nulo tiene cero palabras', () => {
    expect(contarPalabras('')).toBe(0);
    expect(contarPalabras(null)).toBe(0);
  });

  it('el mínimo de un aporte coincide con el del filtro del servidor', () => {
    expect(MINIMO_DE_PALABRAS_DE_UN_APORTE).toBe(5);
  });
});
