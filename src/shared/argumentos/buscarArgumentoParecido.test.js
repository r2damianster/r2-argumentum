import { describe, it, expect } from 'vitest';
import { buscarArgumentoParecido, calcularSimilitud } from './buscarArgumentoParecido.js';

const argumentoExistente = {
  argumentId: 'a1',
  participantId: 'ana',
  texto: 'El mercado libre reduce los precios porque obliga a las empresas a competir entre sí.',
};

describe('buscarArgumentoParecido', () => {
  it('detecta una copia con cambios menores', () => {
    const copia = 'El mercado libre reduce precios porque las empresas tienen que competir.';
    const resultado = buscarArgumentoParecido(copia, [argumentoExistente]);
    expect(resultado?.argumento.argumentId).toBe('a1');
  });

  it('detecta el mismo texto sin tildes ni mayúsculas', () => {
    const resultado = buscarArgumentoParecido(
      'el mercado libre reduce los precios porque obliga a las empresas a competir entre si',
      [argumentoExistente]
    );
    expect(resultado).not.toBeNull();
  });

  it('no marca como parecido un argumento distinto sobre el mismo tema', () => {
    const distinto = 'Sin regulación estatal los trabajadores quedan expuestos a salarios de subsistencia.';
    expect(buscarArgumentoParecido(distinto, [argumentoExistente])).toBeNull();
  });

  it('elige el más parecido cuando hay varios', () => {
    const otro = { argumentId: 'a2', participantId: 'luis', texto: 'El Estado debe regular los precios de la canasta básica.' };
    const copia = 'El mercado libre reduce los precios porque obliga a las empresas a competir.';
    expect(buscarArgumentoParecido(copia, [otro, argumentoExistente])?.argumento.argumentId).toBe('a1');
  });

  it('no avisa con textos de menos de 5 palabras con contenido, aunque estén dentro de uno largo', () => {
    // Reporte de prueba en vivo: con 3 palabras el aviso saltaba contra un argumento largo.
    expect(buscarArgumentoParecido('mercado libre precios', [argumentoExistente])).toBeNull();
    expect(buscarArgumentoParecido('mercado libre reduce precios', [argumentoExistente])).toBeNull();
  });

  it('sí avisa cuando el texto tiene 5 palabras con contenido y está contenido en el existente', () => {
    const resultado = buscarArgumentoParecido('mercado libre reduce precios competir', [argumentoExistente]);
    expect(resultado?.argumento.argumentId).toBe('a1');
  });

  it('no falla con listas vacías ni textos muy cortos', () => {
    expect(buscarArgumentoParecido('hola mundo', [])).toBeNull();
    expect(calcularSimilitud('sí', 'sí')).toBe(0);
  });
});
