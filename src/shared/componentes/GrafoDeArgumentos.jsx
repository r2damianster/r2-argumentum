import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { COLORES_SEMANTICOS_DEL_GRAFO } from '../estilos/colores.js';
import { TIPOS_DE_RELACION } from '../eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../estado/seleccionesDerivadas.js';
import { calcularLayoutDelGrafo, ANCHO_DE_NODO, ALTO_DE_NODO } from './calcularLayoutDelGrafo.js';

// TIPOS_DE_RELACION.NUEVO ('nuevo') no tiene clave propia en la paleta semántica
// (docs/08-identidad-visual.md la llama "argumentoOriginal") — se traduce aquí.
const CLAVE_DE_COLOR_POR_TIPO = {
  [TIPOS_DE_RELACION.NUEVO]: 'argumentoOriginal',
};

const ETIQUETA_DE_TIPO = {
  nuevo: 'Argumento nuevo',
  contraargumento: 'Contraargumento',
  refuerzo: 'Refuerzo',
  dilema: 'Dilema',
  pregunta: 'Pregunta',
  concesion: 'Concesión',
};

function colorDelArgumento(argumento) {
  const tipo = argumento.validacion?.tipoFinal || argumento.tipoDeclarado;
  const claveDeColor = CLAVE_DE_COLOR_POR_TIPO[tipo] || tipo;
  return COLORES_SEMANTICOS_DEL_GRAFO[claveDeColor] || COLORES_SEMANTICOS_DEL_GRAFO.pregunta;
}

// Un grafo de nodos en 360px de ancho no se lee por más zoom que se le ponga: en celular
// vertical se cambia por una lista agrupada por postura, con las conexiones como referencias
// cruzadas (docs/07). Se decide por ancho de ventana, no por user-agent.
function usarVistaCompacta() {
  const [compacta, setCompacta] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 599px)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 599px)');
    function alCambiar(evento) {
      setCompacta(evento.matches);
    }
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return compacta;
}

// Compartido entre host (proyección en vivo) y player (vista propia).
export function GrafoDeArgumentos({ estado, programa, presencia }) {
  const vistaCompacta = usarVistaCompacta();

  const { nodos, aristas } = useMemo(() => {
    const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);

    const nodosSinUbicar = argumentos.map((argumento) => {
      const color = colorDelArgumento(argumento);
      return {
        id: argumento.argumentId,
        position: { x: 0, y: 0 },
        width: ANCHO_DE_NODO,
        height: ALTO_DE_NODO,
        data: {
          label: (
            <div>
              <strong>{nombreDeParticipante(presencia, argumento.participantId)}</strong>
              <p>{argumento.texto.slice(0, 80)}</p>
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

    const todasLasAristas = [...aristasDeConexiones, ...aristasDeSugerencias];
    return { nodos: calcularLayoutDelGrafo(nodosSinUbicar, todasLasAristas), aristas: todasLasAristas };
  }, [estado.argumentos, estado.conexiones, estado.sugerencias, presencia]);

  if (vistaCompacta) {
    return <ListaDeArgumentosPorPostura estado={estado} programa={programa} presencia={presencia} />;
  }

  return (
    <section className="tarjeta-de-grafo">
      <p className="texto-de-ayuda">Mapa argumental</p>
      <LeyendaDeTipos />
      <div className="contenedor-de-grafo">
        {/* zoomOnScroll/panOnScroll en false: sin esto, pasar el mouse por el grafo para bajar
            la página lo zoomeaba sin querer. El zoom deliberado es con los botones o pellizco. */}
        <ReactFlow
          nodes={nodos}
          edges={aristas}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
          zoomOnScroll={false}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </section>
  );
}

function LeyendaDeTipos() {
  return (
    <ul className="leyenda-del-grafo">
      {Object.entries(ETIQUETA_DE_TIPO).map(([tipo, etiqueta]) => {
        const color =
          COLORES_SEMANTICOS_DEL_GRAFO[CLAVE_DE_COLOR_POR_TIPO[tipo] || tipo] ||
          COLORES_SEMANTICOS_DEL_GRAFO.pregunta;
        return (
          <li key={tipo}>
            <span className="punto-de-leyenda" style={{ background: color }} />
            {etiqueta}
          </li>
        );
      })}
    </ul>
  );
}

// Celular vertical: el mismo contenido como lista, agrupado por postura. Las conexiones se
// muestran como referencias ("responde a X") en vez de aristas.
function ListaDeArgumentosPorPostura({ estado, programa, presencia }) {
  const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);
  const textoPorId = Object.fromEntries(argumentos.map((argumento) => [argumento.argumentId, argumento.texto]));

  const conexionPorOrigen = {};
  for (const conexion of Object.values(estado.conexiones)) {
    conexionPorOrigen[conexion.sourceArgumentId] = conexion;
  }

  return (
    <section className="tarjeta-de-grafo">
      <p className="texto-de-ayuda">Mapa argumental</p>
      {programa.posturas.map((postura) => {
        const deEstaPostura = argumentos.filter((argumento) => argumento.stanceId === postura.id);
        if (deEstaPostura.length === 0) {
          return null;
        }
        return (
          <div key={postura.id} className="grupo-de-argumentos">
            <h4 style={{ color: postura.color }}>{postura.etiqueta}</h4>
            <ul className="lista-de-argumentos">
              {deEstaPostura.map((argumento) => {
                const conexion = conexionPorOrigen[argumento.argumentId];
                return (
                  <li key={argumento.argumentId} style={{ borderLeftColor: colorDelArgumento(argumento) }}>
                    <strong>{nombreDeParticipante(presencia, argumento.participantId)}</strong>
                    <p>{argumento.texto}</p>
                    {conexion && (
                      <p className="texto-de-ayuda">
                        ↳ {conexion.tipoDeRelacion} de: “{(textoPorId[conexion.targetArgumentId] ?? '').slice(0, 60)}…”
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {argumentos.length === 0 && <p className="texto-de-ayuda">Todavía no hay argumentos en el mapa.</p>}
    </section>
  );
}
