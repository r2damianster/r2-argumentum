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
  //
  // OJO con la dirección: en `link.created` (ver PanelDeConexionLibre.jsx) `source` es "tu
  // argumento" — el más nuevo, el que reacciona — y `target` es "se conecta con" — el
  // argumento ya existente al que responde. Esa es la dirección correcta para la FLECHA
  // (apunta de la reacción hacia lo que contesta), pero para el LAYOUT es al revés: quieres
  // que lo más viejo quede arriba y la respuesta abajo. Bug real reportado en prueba en vivo:
  // sin este swap, dagre ponía la respuesta más nueva arriba y el argumento original al
  // final, porque dagre ubica el origen de cada arista por encima de su destino en TB.
  const idsDeNodos = new Set(nodos.map((nodo) => nodo.id));
  for (const arista of aristas) {
    if (idsDeNodos.has(arista.source) && idsDeNodos.has(arista.target)) {
      grafo.setEdge(arista.target, arista.source);
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

const MARGEN_DEL_ENCUADRE = 60;

// El mapa arranca en una caja compacta y solo crece cuando lo que hay dentro ya no se lee a
// tamaño natural. Con 2 o 3 argumentos una caja de 560 px son 400 px de espacio en blanco; con
// 15 o 20 no alcanza, y ahí conviene usar todo el alto disponible antes de empezar a achicar.
//
// `nodosUbicados` son los nodos que devuelve calcularLayoutDelGrafo (con su `position`).
// El alto que hace falta se calcula sobre la caja que ocupan los nodos, reducida por la escala
// a la que tendría que verse para caber a lo ancho.
export function calcularAltoDelGrafo(nodosUbicados, anchoDisponible, { altoMinimo, altoMaximo }) {
  if (nodosUbicados.length === 0) {
    return altoMinimo;
  }
  const izquierda = Math.min(...nodosUbicados.map((nodo) => nodo.position.x));
  const derecha = Math.max(...nodosUbicados.map((nodo) => nodo.position.x + ANCHO_DE_NODO));
  const arriba = Math.min(...nodosUbicados.map((nodo) => nodo.position.y));
  const abajo = Math.max(...nodosUbicados.map((nodo) => nodo.position.y + ALTO_DE_NODO));

  const anchoNecesario = derecha - izquierda + 2 * MARGEN_DEL_ENCUADRE;
  const altoNecesario = abajo - arriba + 2 * MARGEN_DEL_ENCUADRE;
  const escalaPorAncho = Math.min(1, anchoDisponible / anchoNecesario);
  const altoParaVerlo = Math.round(altoNecesario * escalaPorAncho);

  return Math.min(altoMaximo, Math.max(altoMinimo, altoParaVerlo));
}
