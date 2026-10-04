import { nombreDeParticipante } from '../../estado/seleccionesDerivadas.js';
import { contarReaccionesDeUnAporte, reaccionDeParticipante } from '../../nucleo/reacciones/contarReacciones.js';
import { ReaccionesDelAporte } from './ReaccionesDelAporte.jsx';
import { SugerenciaDeIA } from './SugerenciaDeIA.jsx';

const ETIQUETA_DE_TIPO = {
  nuevo: 'Post',
  contraargumento: 'Contraargumento',
  refuerzo: 'Refuerzo',
  dilema: 'Dilema',
  pregunta: 'Pregunta',
  concesion: 'Concesión',
};

// Sangría máxima: más allá de 3 niveles las réplicas se leen mal en un celular de 320 px.
const NIVEL_MAXIMO_DE_SANGRIA = 3;

// Un aporte con sus réplicas. Las acciones propias de cada pantalla (responder, ocultar, revisar)
// llegan por `renderAcciones`, así la lista sirve igual para el participante, el co-moderador y el
// moderador.
function TarjetaDeAporte({ hilo, nivel, contexto }) {
  const { estado, presencia, programa, participantId, renderAcciones, onReaccionar, mostrarSinDebatir, verSugerenciasDeIA } =
    contexto;
  const { aporte } = hilo;
  const postura = programa.posturas.find((candidata) => candidata.id === aporte.stanceId);
  const esPostRaiz = nivel === 0;
  const estaSinDebatir = esPostRaiz && mostrarSinDebatir && hilo.totalDeRespuestas === 0;
  const esMio = aporte.participantId === participantId;
  const puedeReaccionar = Boolean(onReaccionar) && !esMio && !aporte.oculto;

  return (
    <li className={`aporte-del-foro ${aporte.oculto ? 'aporte-del-foro--oculto' : ''}`} id={`aporte-${aporte.argumentId}`}>
      <article>
        <header className="encabezado-del-aporte">
          <strong>{nombreDeParticipante(presencia, aporte.participantId)}</strong>
          {postura && (
            <span className="chip-de-postura" style={{ color: postura.color }}>
              {postura.etiqueta}
            </span>
          )}
          <span className="tipo-del-aporte">{ETIQUETA_DE_TIPO[aporte.tipoDeclarado] ?? 'Aporte'}</span>
          {estaSinDebatir && <span className="etiqueta-sin-debatir">Sin debatir</span>}
          {aporte.oculto && <span className="etiqueta-oculto">Oculto</span>}
        </header>
        <p className="texto-del-aporte">{aporte.texto}</p>
        {/* La sugerencia de la IA la ven quien escribió y quienes moderan; los compañeros no. */}
        {(verSugerenciasDeIA || esMio) && <SugerenciaDeIA sugerencia={aporte.sugerenciaDeIA} />}
        <ReaccionesDelAporte
          conteo={contarReaccionesDeUnAporte(estado, aporte.argumentId)}
          miReaccion={reaccionDeParticipante(estado, aporte.argumentId, participantId)}
          puedeReaccionar={puedeReaccionar}
          onReaccionar={(tipo) => onReaccionar(aporte.argumentId, tipo)}
        />
        {renderAcciones && <div className="acciones-del-aporte">{renderAcciones(aporte, hilo)}</div>}
      </article>
      {hilo.respuestas.length > 0 && (
        <ul className={`lista-de-respuestas ${nivel >= NIVEL_MAXIMO_DE_SANGRIA ? 'lista-de-respuestas--plana' : ''}`}>
          {hilo.respuestas.map((respuesta) => (
            <TarjetaDeAporte key={respuesta.aporte.argumentId} hilo={respuesta} nivel={nivel + 1} contexto={contexto} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ListaDeHilos({
  hilos,
  estado,
  presencia,
  programa,
  participantId = null,
  renderAcciones = null,
  onReaccionar = null,
  mostrarSinDebatir = true,
  verSugerenciasDeIA = false,
  mensajeVacio = 'Todavía no hay posts.',
}) {
  if (hilos.length === 0) {
    return <p className="texto-de-ayuda">{mensajeVacio}</p>;
  }
  const contexto = {
    estado,
    presencia,
    programa,
    participantId,
    renderAcciones,
    onReaccionar,
    mostrarSinDebatir,
    verSugerenciasDeIA,
  };
  return (
    <ul className="lista-de-hilos">
      {hilos.map((hilo) => (
        <TarjetaDeAporte key={hilo.aporte.argumentId} hilo={hilo} nivel={0} contexto={contexto} />
      ))}
    </ul>
  );
}
