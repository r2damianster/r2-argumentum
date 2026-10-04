import { describe, expect, it } from 'vitest';
import { contarParrafos, dividirEnParrafos, resumirTexto } from './contarTexto.js';

describe('contarTexto', () => {
  it('cuenta párrafos separados por un salto de línea simple o por líneas en blanco', () => {
    expect(contarParrafos('uno\ndos\n\n\ntres')).toBe(3);
    expect(contarParrafos('uno\r\ndos')).toBe(2);
  });

  it('ignora líneas vacías o con solo espacios', () => {
    expect(dividirEnParrafos('  \n\nhola mundo  \n   \n')).toEqual(['hola mundo']);
    expect(contarParrafos('')).toBe(0);
    expect(contarParrafos(null)).toBe(0);
  });

  it('resume palabras y párrafos', () => {
    expect(resumirTexto('La lectura propone una tesis.\nLa evidencia la sostiene bien.')).toEqual({
      palabras: 10,
      parrafos: 2,
    });
  });
});
