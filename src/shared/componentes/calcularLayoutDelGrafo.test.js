import { describe, it, expect } from 'vitest';
import { calcularLayoutDelGrafo, ALTO_DE_NODO } from './calcularLayoutDelGrafo.js';

function nodo(id) {
  return { id, position: { x: 0, y: 0 } };
}

describe('layout del mapa argumental', () => {
  it('no se cae con el mapa vacío', () => {
    expect(calcularLayoutDelGrafo([], [])).toEqual([]);
  });

  it('coloca a quien responde por debajo del argumento al que responde', () => {
    const ubicados = calcularLayoutDelGrafo(
      [nodo('original'), nodo('respuesta')],
      [{ source: 'original', target: 'respuesta' }]
    );

    const original = ubicados.find((unNodo) => unNodo.id === 'original');
    const respuesta = ubicados.find((unNodo) => unNodo.id === 'respuesta');

    expect(respuesta.position.y).toBeGreaterThan(original.position.y);
  });

  it('separa los niveles lo suficiente para que dos nodos nunca se superpongan', () => {
    const ubicados = calcularLayoutDelGrafo(
      [nodo('a'), nodo('b')],
      [{ source: 'a', target: 'b' }]
    );

    const [a, b] = ['a', 'b'].map((id) => ubicados.find((unNodo) => unNodo.id === id));

    expect(Math.abs(b.position.y - a.position.y)).toBeGreaterThanOrEqual(ALTO_DE_NODO);
  });

  it('ignora aristas que apuntan a un argumento que todavía no llegó por el canal', () => {
    // Una sugerencia de Groq puede referirse a un argumento que este cliente aún no recibió.
    const ubicados = calcularLayoutDelGrafo([nodo('a')], [{ source: 'a', target: 'inexistente' }]);

    expect(ubicados).toHaveLength(1);
    expect(Number.isFinite(ubicados[0].position.x)).toBe(true);
  });

  it('ubica también los argumentos sueltos, sin dejarlos sin posición', () => {
    const ubicados = calcularLayoutDelGrafo([nodo('suelto1'), nodo('suelto2')], []);

    for (const unNodo of ubicados) {
      expect(Number.isFinite(unNodo.position.x)).toBe(true);
      expect(Number.isFinite(unNodo.position.y)).toBe(true);
    }
  });

  it('no encima dos argumentos sueltos en la misma coordenada', () => {
    const ubicados = calcularLayoutDelGrafo([nodo('a'), nodo('b'), nodo('c')], []);
    const coordenadas = ubicados.map((unNodo) => `${unNodo.position.x},${unNodo.position.y}`);

    expect(new Set(coordenadas).size).toBe(3);
  });
});
