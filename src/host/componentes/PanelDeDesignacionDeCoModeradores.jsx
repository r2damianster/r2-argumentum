import { useState } from 'react';
import {
  MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR,
  MODOS_DE_CO_MODERACION,
  calcularCantidadSegunElPrograma,
  calcularMaximoDeCoModeradoresPosible,
  normalizarModeracion,
} from '../../shared/nucleo/coModeracion/calcularCoModeradores.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';

const ORIGENES_DE_DESIGNACION_DEL_MODERADOR = ['sorteo_del_moderador', 'manual'];

// Sala de espera: el moderador designa a los co-moderadores cuando ya ingresó la gente, por sorteo
// o a mano. Si no designa a nadie, el sorteo se hace solo al iniciar según el modo elegido.
export function PanelDeDesignacionDeCoModeradores({ estado, presencia, programa, motor }) {
  const [eligiendoAMano, setEligiendoAMano] = useState(false);
  const [idsMarcados, setIdsMarcados] = useState(() => new Set());
  const [aviso, setAviso] = useState('');

  const { modo } = normalizarModeracion(programa.moderacion);
  const elegibles = presencia
    .filter((presente) => presente.conectado !== false)
    .map((presente) => presente.participantId)
    .filter((participantId) => estado.participantes[participantId]?.ingresoConfirmado);
  const cantidadQueCorresponde = calcularCantidadSegunElPrograma(programa, elegibles.length);
  const maximoPosible = calcularMaximoDeCoModeradoresPosible(elegibles.length);

  const designacion = estado.coModeradores;
  const hayDesignacionDelModerador =
    ORIGENES_DE_DESIGNACION_DEL_MODERADOR.includes(designacion?.origen) && designacion.participantIds.length > 0;

  function sortear() {
    setAviso('');
    setEligiendoAMano(false);
    motor.designarCoModeradores({ modo: 'sorteo' });
  }

  function alternarMarca(participantId) {
    setIdsMarcados((marcados) => {
      const siguientes = new Set(marcados);
      if (siguientes.has(participantId)) {
        siguientes.delete(participantId);
      } else {
        siguientes.add(participantId);
      }
      return siguientes;
    });
  }

  function confirmarSeleccionManual() {
    const validacion = motor.designarCoModeradores({ modo: 'manual', idsElegidos: [...idsMarcados] });
    if (validacion?.superaElMaximo) {
      setAviso(
        `Se designaron ${validacion.idsValidos.length}: es el máximo que deja a la sala con al menos 3 personas debatiendo.`
      );
    } else {
      setAviso('');
    }
    setEligiendoAMano(false);
  }

  function quitarDesignacion() {
    setAviso('');
    motor.quitarDesignacionDeCoModeradores();
  }

  if (modo === MODOS_DE_CO_MODERACION.NINGUNO) {
    return (
      <section className="tarjeta-de-designacion">
        <h4>Co-moderadores</h4>
        <p className="texto-de-ayuda">
          Elegiste no tener co-moderadores: todas las decisiones de revisión son tuyas y revisar es opcional.
        </p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-designacion">
      <h4>Co-moderadores</h4>
      <p className="texto-de-ayuda">
        {elegibles.length === 0
          ? 'Todavía no ha ingresado nadie con su argumento.'
          : cantidadQueCorresponde > 0
            ? `Con ${elegibles.length} persona(s) en la sala, con este modo corresponden ${cantidadQueCorresponde} co-moderador(es).`
            : modo === MODOS_DE_CO_MODERACION.REGLAMENTARIO
              ? `Con ${elegibles.length} persona(s) no hay co-moderadores: se necesitan al menos ${MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR}.`
              : 'Con el número fijo elegido y las personas que hay no queda lugar para co-moderadores.'}
      </p>

      {hayDesignacionDelModerador && (
        <p className="mensaje-de-exito">
          ✅ Designados: {designacion.participantIds.map((id) => nombreDeParticipante(presencia, id)).join(', ')}.
        </p>
      )}
      {!hayDesignacionDelModerador && elegibles.length > 0 && (
        <p className="texto-de-ayuda">
          Si no designas a nadie, se sortean automáticamente al pulsar «Iniciar».
        </p>
      )}
      {aviso && <p className="texto-de-ayuda">{aviso}</p>}

      <div className="botonera-de-bid">
        <button type="button" className="boton-secundario" disabled={cantidadQueCorresponde === 0} onClick={sortear}>
          🎲 Sortear ahora
        </button>
        <button
          type="button"
          className="boton-secundario"
          disabled={maximoPosible === 0}
          onClick={() => setEligiendoAMano((eligiendo) => !eligiendo)}
        >
          ✋ Elegir yo
        </button>
        {hayDesignacionDelModerador && (
          <button type="button" className="boton-secundario" onClick={quitarDesignacion}>
            ↩️ Quitar designación
          </button>
        )}
      </div>

      {eligiendoAMano && (
        <div className="selector-de-co-moderadores">
          <p className="texto-de-ayuda">Marca a quienes serán co-moderadores (máximo {maximoPosible}):</p>
          <ul className="lista-de-posturas-seleccionables">
            {elegibles.map((participantId) => (
              <li key={participantId}>
                <label>
                  <input
                    type="checkbox"
                    checked={idsMarcados.has(participantId)}
                    onChange={() => alternarMarca(participantId)}
                  />
                  <span>{nombreDeParticipante(presencia, participantId)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="boton-exito" onClick={confirmarSeleccionManual}>
            Designar a los marcados
          </button>
        </div>
      )}
    </section>
  );
}
