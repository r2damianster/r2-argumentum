import { describe, it, expect } from 'vitest';
import { esClientIdValido } from './_clienteIdValido.js';

describe('esClientIdValido', () => {
  it('acepta los identificadores que genera la aplicación', () => {
    expect(esClientIdValido('host')).toBe(true);
    expect(esClientIdValido('participante-1790201720128-k3j9x2')).toBe(true);
  });

  it('rechaza vacío, símbolos, espacios y textos demasiado largos', () => {
    expect(esClientIdValido('')).toBe(false);
    expect(esClientIdValido('a b')).toBe(false);
    expect(esClientIdValido('<script>')).toBe(false);
    expect(esClientIdValido('a'.repeat(65))).toBe(false);
  });

  it('rechaza valores que no son texto (p. ej. ?clientId=a&clientId=b llega como arreglo)', () => {
    expect(esClientIdValido(['a', 'b'])).toBe(false);
    expect(esClientIdValido(undefined)).toBe(false);
  });
});
