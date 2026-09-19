import { describe, it, expect } from 'vitest';
import { IDIOMA_POR_DEFECTO, resolverIdiomaDelDebate } from './idiomaDelDebate.js';

describe('resolverIdiomaDelDebate', () => {
  it('usa español cuando el Programa no define idioma', () => {
    expect(resolverIdiomaDelDebate({})).toBe(IDIOMA_POR_DEFECTO);
    expect(resolverIdiomaDelDebate(null)).toBe('es');
    expect(resolverIdiomaDelDebate(undefined)).toBe('es');
  });

  it('respeta el inglés cuando el Programa lo pide', () => {
    expect(resolverIdiomaDelDebate({ idioma: 'en' })).toBe('en');
  });

  it('cae a español con un idioma desconocido', () => {
    expect(resolverIdiomaDelDebate({ idioma: 'fr' })).toBe('es');
  });
});
