import { describe, it, expect } from 'vitest';
import { calcularLayoutDelGrafo, calcularAltoDelGrafo, ALTO_DE_NODO } from './calcularLayoutDelGrafo.js';

function nodo(id) {
  return { id, position: { x: 0, y: 0 } };
}

describe('layout del mapa argumental', () => {
  it('no se cae con el mapa vacío', () => {
    expect(calcularLayoutDelGrafo([], [])).toEqual([]);
  });

  // En link.created (ver PanelDeConexionLibre.jsx) `source` es "tu argumento" — el más nuevo,
  // el que reacciona — y `target` es "se conecta con" — el argumento existente al que
  // responde. Bug real: dagre ubicaba el `source` de cada arista arriba, así que la respuesta
  // quedaba sobre el argumento original en vez de debajo.
  it('coloca la respuesta (source) por debajo del argumento al que responde (target)', () => {
    const ubicados = calcularLayoutDelGrafo(
      [nodo('original'), nodo('respuesta')],
      [{ source: 'respuesta', target: 'original' }]
    );

    const original = ubicados.find((unNodo) => unNodo.id === 'original');
    const respuesta = ubicados.find((unNodo) => unNodo.id === 'respuesta');

    expect(respuesta.position.y).toBeGreaterThan(original.position.y);
  });

  it('encadena varias respuestas en orden: cada una debajo de la anterior', () => {
    // Ana → arg1. Luis responde con arg2 (source:arg2, target:arg1). Ana responde a Luis con
    // arg3 (source:arg3, target:arg2). arg1 debe quedar arriba de todo, arg3 abajo de todo.
    const ubicados = calcularLayoutDelGrafo(
      [nodo('arg1'), nodo('arg2'), nodo('arg3')],
      [
        { source: 'arg2', target: 'arg1' },
        { source: 'arg3', target: 'arg2' },
      ]
    );

    const [arg1, arg2, arg3] = ['arg1', 'arg2', 'arg3'].map((id) => ubicados.find((n) => n.id === id));

    expect(arg1.position.y).toBeLessThan(arg2.position.y);
    expect(arg2.position.y).toBeLessThan(arg3.position.y);
  });

  it('separa los niveles lo suficiente para que dos nodos nunca se superpongan', () => {
    const ubicados = calcularLayoutDelGrafo(
      [nodo('a'), nodo('b')],
      [{ source: 'b', target: 'a' }]
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

describe('calcularAltoDelGrafo', () => {
  const nodoEn = (x, y) => ({ id: `${x}-${y}`, position: { x, y } });
  const limites = { altoMinimo: 240, altoMaximo: 560 };

  it('sin nodos usa el alto mínimo', () => {
    expect(calcularAltoDelGrafo([], 900, limites)).toBe(240);
  });

  it('con pocos argumentos se queda en el mínimo', () => {
    expect(calcularAltoDelGrafo([nodoEn(0, 0), nodoEn(260, 0)], 900, limites)).toBe(240);
  });

  it('crece con los niveles del mapa y se detiene en el máximo', () => {
    const dosNiveles = [0, 1].map((nivel) => nodoEn(0, nivel * 166));
    const doceNiveles = Array.from({ length: 12 }, (_, nivel) => nodoEn(0, nivel * 166));
    const alto = calcularAltoDelGrafo(dosNiveles, 900, limites);
    expect(alto).toBeGreaterThan(240);
    expect(alto).toBeLessThan(560);
    expect(calcularAltoDelGrafo(doceNiveles, 900, limites)).toBe(560);
  });

  it('un mapa muy ancho necesita menos alto porque se verá más chico', () => {
    const anchoYAlto = [nodoEn(0, 0), nodoEn(0, 166), nodoEn(0, 332), nodoEn(0, 498)];
    const altoAngosto = calcularAltoDelGrafo(anchoYAlto, 900, limites);
    const muyAncho = [...anchoYAlto, ...Array.from({ length: 10 }, (_, columna) => nodoEn(260 * (columna + 1), 0))];
    expect(calcularAltoDelGrafo(muyAncho, 900, limites)).toBeLessThan(altoAngosto);
  });
});
