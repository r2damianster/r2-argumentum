import { useMemo } from 'react';
import { ReactFlow, Background, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { COLORES_SEMANTICOS_DEL_GRAFO } from '../../shared/estilos/colores.js';
import { TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';

const ANCHO_DE_COLUMNA = 260;
const ALTO_DE_NODO = 110;

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

export function GrafoDeArgumentos({ estado, programa }) {
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
        position: { x: columna * ANCHO_DE_COLUMNA, y: fila * ALTO_DE_NODO },
        data: {
          label: (
            <div>
              <strong>{argumento.participantId}</strong>
              <p>{argumento.texto.slice(0, 80)}</p>
            </div>
          ),
        },
        style: {
          border: `2px solid ${color}`,
          background: 'white',
          borderRadius: 10,
          width: 220,
          fontSize: '0.75rem',
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
  }, [estado.argumentos, estado.conexiones, estado.sugerencias, programa.posturas]);

  return (
    <section className="tarjeta-de-grafo">
      <p className="texto-de-ayuda">Mapa argumental</p>
      <div className="contenedor-de-grafo">
        <ReactFlow nodes={nodos} edges={aristas} fitView proOptions={{ hideAttribution: true }}>
          <Background />
        </ReactFlow>
      </div>
    </section>
  );
}
