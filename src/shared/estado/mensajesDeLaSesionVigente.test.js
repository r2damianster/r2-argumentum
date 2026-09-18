import { describe, it, expect } from 'vitest';
import { mensajesDeLaSesionVigente } from './useEstadoDeSesion.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

function programa(identificadorDeSesion) {
  return { name: EVENTOS.PROGRAMA_PUBLICADO, data: { identificadorDeSesion } };
}

function argumento(argumentId) {
  return { name: EVENTOS.ARGUMENTO_PUBLICADO, data: { argumentId } };
}

describe('mensajesDeLaSesionVigente', () => {
  it('descarta los eventos de un debate anterior que usó el mismo código de sala', () => {
    const historial = [
      programa('sesion-vieja'),
      argumento('viejo-1'),
      argumento('viejo-2'),
      programa('sesion-nueva'),
      argumento('nuevo-1'),
    ];

    const resultado = mensajesDeLaSesionVigente(historial);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].data.identificadorDeSesion).toBe('sesion-nueva');
    expect(resultado[1].data.argumentId).toBe('nuevo-1');
  });

  it('conserva la sesión completa cuando el host republica el Programa al elegir posturas', () => {
    // El host publica programa.publicado dos veces en la misma sesión: al montar la consola
    // y otra vez al confirmar las posturas. Cortar en el último perdería los eventos del medio.
    const historial = [
      programa('sesion-unica'),
      argumento('a1'),
      programa('sesion-unica'),
      argumento('a2'),
    ];

    const resultado = mensajesDeLaSesionVigente(historial);

    expect(resultado).toHaveLength(4);
    expect(resultado[1].data.argumentId).toBe('a1');
  });

  it('no descarta nada si el canal nunca tuvo un Programa publicado', () => {
    const historial = [argumento('huerfano')];

    expect(mensajesDeLaSesionVigente(historial)).toHaveLength(1);
  });

  it('cae al último Programa publicado si los eventos son de una versión sin identificador', () => {
    const historial = [
      { name: EVENTOS.PROGRAMA_PUBLICADO, data: {} },
      argumento('viejo'),
      { name: EVENTOS.PROGRAMA_PUBLICADO, data: {} },
      argumento('nuevo'),
    ];

    const resultado = mensajesDeLaSesionVigente(historial);

    expect(resultado).toHaveLength(2);
    expect(resultado[1].data.argumentId).toBe('nuevo');
  });
});
