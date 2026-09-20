import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, MarkerType, Position, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { factorDeCompensacionActual } from '../navegador/compensarZoomDelNavegador.js';
import { COLORES_SEMANTICOS_DEL_GRAFO } from '../estilos/colores.js';
import { TIPOS_DE_RELACION } from '../eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../estado/seleccionesDerivadas.js';
import {
  calcularLayoutDelGrafo,
  calcularAltoDelGrafo,
  ANCHO_DE_NODO,
  ALTO_DE_NODO,
} from './calcularLayoutDelGrafo.js';
import { elegirSugerenciasParaDibujar } from './sugerenciasVisiblesDelGrafo.js';

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

// React Flow calcula por dónde entra y sale cada arista midiendo los conectores en el DOM.
// Si el grafo se monta dentro de un contenedor sin caja (pestaña oculta, iframe sin alto,
// sección todavía plegada), esa medición devuelve 0 y la librería descarta TODAS las aristas
// aunque los nodos sigan dibujados y bien ubicados — exactamente el síntoma reportado en
// prueba en vivo: nodos en su lugar, cero aristas. Declarar los conectores a mano hace que la
// geometría no dependa de la medición: los nodos tienen tamaño fijo y conocido.
const CONECTORES_DEL_NODO = [
  { id: null, type: 'target', position: Position.Top, x: ANCHO_DE_NODO / 2, y: 0 },
  { id: null, type: 'source', position: Position.Bottom, x: ANCHO_DE_NODO / 2, y: ALTO_DE_NODO },
];

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

// Ancho real de la caja del mapa (para saber a qué escala se vería el layout).
function usarAnchoDe(referencia) {
  const [ancho, setAncho] = useState(900);

  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.round(entrada.contentRect.width)));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [referencia]);

  return ancho;
}

// Límites del alto del mapa. En pantalla normal el mapa sale compacto y crece con el debate; en
// proyección se le deja hasta el 62 % del alto de la ventana para que se lea desde el fondo.
function limitesDeAlto(modoProyeccion) {
  if (modoProyeccion) {
    return { altoMinimo: 300, altoMaximo: Math.max(360, Math.round((window.innerHeight / factorDeCompensacionActual()) * 0.62)) };
  }
  return { altoMinimo: 240, altoMaximo: window.innerWidth >= 900 ? 560 : 420 };
}

// La caja del mapa se dimensiona para ver los nodos a tamaño natural (ver calcularAltoDelGrafo),
// así que al encuadrar no se debe ampliar por encima de 1: con pocos nodos el encuadre llegaba a
// 1,27 y el último nodo quedaba cortado contra el borde, y el botón ⛶ repetía el mismo encuadre
// (reporte de prueba en vivo). Un solo ajuste para el encuadre inicial, el botón y el reencuadre.
const AJUSTE_DEL_ENCUADRE = { padding: 0.15, maxZoom: 1 };

// Compartido entre host (proyección en vivo) y player (vista propia).
export function GrafoDeArgumentos({ estado, programa, presencia, modoProyeccion = false }) {
  const vistaCompacta = usarVistaCompacta();
  const contenedorRef = useRef(null);
  const anchoDelContenedor = usarAnchoDe(contenedorRef);

  const { nodos, aristas } = useMemo(() => {
    const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);

    const nodosSinUbicar = argumentos.map((argumento) => {
      const color = colorDelArgumento(argumento);
      return {
        id: argumento.argumentId,
        position: { x: 0, y: 0 },
        width: ANCHO_DE_NODO,
        height: ALTO_DE_NODO,
        handles: CONECTORES_DEL_NODO,
        data: {
          color,
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
      type: 'smoothstep',
      style: { stroke: COLORES_SEMANTICOS_DEL_GRAFO[conexion.tipoDeRelacion] || '#94a3b8' },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    const aristasDeSugerencias = elegirSugerenciasParaDibujar(
      Object.values(estado.sugerencias),
      Object.values(estado.conexiones)
    ).map((sugerencia) => ({
      id: sugerencia.suggestionId,
      source: sugerencia.sourceArgumentId,
      target: sugerencia.targetArgumentId,
      label: `${sugerencia.tipoDeRelacion} (sugerido)`,
      type: 'smoothstep',
      style: { stroke: '#94a3b8', strokeDasharray: '4 4' },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    // Una sugerencia de Groq puede nombrar un argumento que no existe (inventa ids), y una
    // conexión puede apuntar a un argumento que todavía no llegó por el canal. Esas aristas
    // colgadas no se pueden dibujar: se descartan aquí, igual que en el layout.
    const idsDeNodos = new Set(nodosSinUbicar.map((nodo) => nodo.id));
    const todasLasAristas = [...aristasDeConexiones, ...aristasDeSugerencias].filter(
      (arista) => idsDeNodos.has(arista.source) && idsDeNodos.has(arista.target)
    );
    return { nodos: calcularLayoutDelGrafo(nodosSinUbicar, todasLasAristas), aristas: todasLasAristas };
  }, [estado.argumentos, estado.conexiones, estado.sugerencias, presencia]);

  if (vistaCompacta) {
    return <ListaDeArgumentosPorPostura estado={estado} programa={programa} presencia={presencia} />;
  }

  const altoDelGrafo = calcularAltoDelGrafo(nodos, anchoDelContenedor, limitesDeAlto(modoProyeccion));

  return (
    <section className="tarjeta-de-grafo">
      <p className="texto-de-ayuda">Mapa argumental</p>
      <LeyendaDeTipos />
      {/* El alto va inline porque depende de cuántos argumentos hay: compacto al empezar y más
          alto a medida que el mapa deja de caber (ver calcularAltoDelGrafo). */}
      <div className="contenedor-de-grafo" ref={contenedorRef} style={{ height: altoDelGrafo }}>
        {/* zoomOnScroll/panOnScroll en false: sin esto, pasar el mouse por el grafo para bajar
            la página lo zoomeaba sin querer. El zoom deliberado es con los botones o pellizco. */}
        <ReactFlow
          nodes={nodos}
          edges={aristas}
          fitView
          fitViewOptions={AJUSTE_DEL_ENCUADRE}
          minZoom={0.2}
          maxZoom={1.5}
          zoomOnScroll={false}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          {/* El botón ⛶ usa el mismo encuadre que el inicial: por defecto React Flow usaría otro
              (más padding y sin tope de ampliación) y dejaba el mapa distinto al de la carga. */}
          <Controls showInteractive={false} fitViewOptions={AJUSTE_DEL_ENCUADRE} />
          {/* El minimapa solo aporta cuando hay bastante mapa; en una caja chica estorba. */}
          {nodos.length >= 6 && <MiniMap pannable zoomable />}
          {nodos.length >= 6 && (
            <MiniMap pannable zoomable nodeColor={(nodo) => nodo.data?.color || '#64748b'} />
          )}
          <ReencuadrarAlCrecerElMapa
            cantidadDeNodos={nodos.length}
            altoDelContenedor={altoDelGrafo}
            anchoDelContenedor={anchoDelContenedor}
          />
        </ReactFlow>
      </div>
    </section>
  );
}

// `fitView` del prop solo encuadra al montar. Cuando se publica un argumento nuevo con el
// mapa ya abierto, el nodo aparecía cortado contra el borde (reportado en prueba en vivo).
// Este ayudante vuelve a encuadrar cada vez que el mapa crece o que la caja cambia de tamaño (alto
// o ancho): un encuadre calculado contra una caja que después se midió distinta deja nodos
// cortados contra el borde (prueba del 19 de septiembre: un nodo 115 px fuera del mapa).
function ReencuadrarAlCrecerElMapa({ cantidadDeNodos, altoDelContenedor, anchoDelContenedor }) {
  const { fitView } = useReactFlow();
  const cantidadPrevia = useRef(cantidadDeNodos);
  const altoPrevio = useRef(altoDelContenedor);
  const anchoPrevio = useRef(anchoDelContenedor);

  useEffect(() => {
    const crecioElMapa = cantidadDeNodos > cantidadPrevia.current;
    const cambioElTamano =
      altoDelContenedor !== altoPrevio.current || anchoDelContenedor !== anchoPrevio.current;
    cantidadPrevia.current = cantidadDeNodos;
    altoPrevio.current = altoDelContenedor;
    anchoPrevio.current = anchoDelContenedor;
    if (!crecioElMapa && !cambioElTamano) {
      return undefined;
    }
    // Si cambió el tamaño de la caja, se espera al siguiente cuadro: React Flow tiene que medir
    // el contenedor nuevo antes de poder encuadrar contra él.
    const cuadro = requestAnimationFrame(() => fitView({ duration: 300, ...AJUSTE_DEL_ENCUADRE }));
    return () => cancelAnimationFrame(cuadro);
    const t1 = setTimeout(
      () => fitView({ duration: 0, ...AJUSTE_DEL_ENCUADRE }),
      cambioElTamano ? 120 : 60
    );
    const t2 = setTimeout(
      () => fitView({ duration: 200, ...AJUSTE_DEL_ENCUADRE }),
      cambioElTamano ? 350 : 250
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cantidadDeNodos, altoDelContenedor, anchoDelContenedor, fitView]);

  return null;
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
