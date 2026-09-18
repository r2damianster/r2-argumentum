import dagre from '@dagrejs/dagre';

// Layout del mapa argumental.
//
// Antes los nodos se ubicaban en una grilla ingenua: columna por postura, fila por orden de
// llegada. Con pocas conexiones se leía bien, pero apenas aparecían aristas cruzaban toda la
// pantalla y el mapa se volvía ilegible — reportado dos veces por el usuario.
//
// Ahora el orden lo dicta la ESTRUCTURA del debate: dagre acomoda cada argumento debajo de
// aquel al que responde, así una cadena de contraargumentos se lee de arriba hacia abajo. Los
// argumentos sueltos (sin conexiones) se agrupan aparte, por postura, para que no floten.

export const ANCHO_DE_NODO = 220;
export const ALTO_DE_NODO = 96;

const SEPARACION_ENTRE_NIVELES = 70;
const SEPARACION_ENTRE_HERMANOS = 40;

export function calcularLayoutDelGrafo(nodos, aristas) {
  if (nodos.length === 0) {
    return nodos;
  }

  const grafo = new dagre.graphlib.Graph();
  grafo.setDefaultEdgeLabel(() => ({}));
  grafo.setGraph({
    rankdir: 'TB',
    ranksep: SEPARACION_ENTRE_NIVELES,
    nodesep: SEPARACION_ENTRE_HERMANOS,
    marginx: 20,
    marginy: 20,
  });

  for (const nodo of nodos) {
    grafo.setNode(nodo.id, { width: ANCHO_DE_NODO, height: ALTO_DE_NODO });
  }

  // Solo las aristas entre nodos existentes: una sugerencia de Groq puede apuntar a un
  // argumento que todavía no llegó por el canal, y dagre falla si el nodo no existe.
  const idsDeNodos = new Set(nodos.map((nodo) => nodo.id));
  for (const arista of aristas) {
    if (idsDeNodos.has(arista.source) && idsDeNodos.has(arista.target)) {
      grafo.setEdge(arista.source, arista.target);
    }
  }

  dagre.layout(grafo);

  return nodos.map((nodo) => {
    const posicionada = grafo.node(nodo.id);
    return {
      ...nodo,
      // dagre da el centro del nodo; React Flow espera la esquina superior izquierda.
      position: {
        x: posicionada.x - ANCHO_DE_NODO / 2,
        y: posicionada.y - ALTO_DE_NODO / 2,
      },
    };
  });
}
