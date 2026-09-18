import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { COLORES_SEMANTICOS_DEL_GRAFO } from '../estilos/colores.js';
import { TIPOS_DE_RELACION } from '../eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../estado/seleccionesDerivadas.js';

const ANCHO_DE_COLUMNA = 260;
const ANCHO_DE_NODO = 220;
const ALTO_DE_NODO = 90;
// Espacio vertical entre filas de la misma columna — debe ser mayor que ALTO_DE_NODO
// para que dos nodos consecutivos nunca se superpongan (bug real: con solo 110px de
// espaciado y texto que ocupa más alto que eso, los nodos quedaban apilados/ilegibles).
const ESPACIADO_VERTICAL = 150;

// TIPOS_DE_RELACION.NUEVO ('nuevo') no tiene clave propia en la paleta semántica
// (docs/08-identidad-visual.md la llama "argumentoOriginal") — se traduce acá.
const CLAVE_DE_COLOR_POR_TIPO = {
  [TIPOS_DE_RELACION.NUEVO]: 'argumentoOriginal',
};

function colorDelArgumento(argumento) {
  const tipo = argumento.validacion?.tipoFinal || argumento.tipoDeclarado;
  const claveDeColor = CLAVE_DE_COLOR_POR_TIPO[tipo] || tipo;
  return COLORES_SEMANTICOS_DEL_GRAFO[claveDeColor] || COLORES_SEMANTICOS_DEL_GRAFO.pregunta;
}

// Compartido entre host (proyección en vivo) y player (vista propia) — ver docs/06-pendientes.md.
export function GrafoDeArgumentos({ estado, programa, presencia }) {
  const { nodos, aristas } = useMemo(() => {
    const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);
    const indiceDeColumnaPorStance = new Map(programa.posturas.map((postura, indice) => [postura.id, indice]));
    const contadorPorColumna = new Map();

    const nodos = argumentos.map((argumento) => {
      const columna = indiceDeColumnaPorStance.get(argumento.stanceId) ?? programa.posturas.length;
      const fila = contadorPorColumna.get(columna) ?? 0;
      contadorPorColumna.set(columna, fila + 1);
      const color = colorDelArgumento(argumento);

      return {
        id: argumento.argumentId,
        position: { x: columna * ANCHO_DE_COLUMNA, y: fila * ESPACIADO_VERTICAL },
        width: ANCHO_DE_NODO,
        height: ALTO_DE_NODO,
        data: {
          label: (
            <div>
              <strong>{nombreDeParticipante(presencia, argumento.participantId)}</strong>
              <p>{argumento.texto.slice(0, 60)}</p>
            </div>
          ),
        },
        style: {
          border: `2px solid ${color}`,
          background: 'white',
          borderRadius: 10,
          width: ANCHO_DE_NODO,
          height: ALTO_DE_NODO,
          fontSize: '0.7rem',
          overflow: 'hidden',
        },
      };
    });

    const aristasDeConexiones = Object.values(estado.conexiones).map((conexion) => ({
      id: conexion.linkId,
      source: conexion.sourceArgumentId,
      target: conexion.targetArgumentId,
      label: conexion.tipoDeRelacion,
      style: { stroke: COLORES_SEMANTICOS_DEL_GRAFO[conexion.tipoDeRelacion] || '#94a3b8' },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    const aristasDeSugerencias = Object.values(estado.sugerencias)
      .filter((sugerencia) => !sugerencia.resolucion)
      .map((sugerencia) => ({
        id: sugerencia.suggestionId,
        source: sugerencia.sourceArgumentId,
        target: sugerencia.targetArgumentId,
        label: `${sugerencia.tipoDeRelacion} (sugerido)`,
        style: { stroke: '#94a3b8', strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed },
      }));

    return { nodos, aristas: [...aristasDeConexiones, ...aristasDeSugerencias] };
  }, [estado.argumentos, estado.conexiones, estado.sugerencias, programa.posturas, presencia]);

  return (
    <section className="tarjeta-de-grafo">
      <p className="texto-de-ayuda">Mapa argumental</p>
      <div className="contenedor-de-grafo">
        {/* zoomOnScroll/panOnScroll en false: sin esto, pasar el mouse por el grafo para
            bajar la página lo zoomeaba sin querer (bug reportado: "el zoom es difícil de
            manejar"). El zoom deliberado ahora es con los botones de <Controls/> o pellizco
            táctil (zoomOnPinch queda en su default true). */}
        <ReactFlow
          nodes={nodos}
          edges={aristas}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          zoomOnScroll={false}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
