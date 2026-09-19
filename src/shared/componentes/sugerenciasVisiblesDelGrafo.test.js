import { describe, it, expect } from 'vitest';
import { elegirSugerenciasParaDibujar } from './sugerenciasVisiblesDelGrafo.js';

function sugerencia(suggestionId, sourceArgumentId, targetArgumentId, resolucion = null) {
  return { suggestionId, sourceArgumentId, targetArgumentId, tipoDeRelacion: 'refuerzo', resolucion };
}

describe('elegirSugerenciasParaDibujar', () => {
  it('deja una sola arista por par aunque dos tandas de Groq lo propongan', () => {
    const elegidas = elegirSugerenciasParaDibujar(
      [sugerencia('s1', 'a', 'b'), sugerencia('s2', 'a', 'b'), sugerencia('s3', 'a', 'c')],
      []
    );
    expect(elegidas.map((elegida) => elegida.suggestionId)).toEqual(['s1', 's3']);
  });

  it('trata igual al par en sentido contrario', () => {
    const elegidas = elegirSugerenciasParaDibujar([sugerencia('s1', 'a', 'b'), sugerencia('s2', 'b', 'a')], []);
    expect(elegidas.map((elegida) => elegida.suggestionId)).toEqual(['s1']);
  });

  it('no dibuja sugerencias ya resueltas', () => {
    const elegidas = elegirSugerenciasParaDibujar([sugerencia('s1', 'a', 'b', { aceptada: true })], []);
    expect(elegidas).toEqual([]);
  });

  it('no dibuja una sugerencia sobre un par que ya está conectado', () => {
    const conexiones = [{ linkId: 'c1', sourceArgumentId: 'b', targetArgumentId: 'a' }];
    expect(elegirSugerenciasParaDibujar([sugerencia('s1', 'a', 'b')], conexiones)).toEqual([]);
  });
});
