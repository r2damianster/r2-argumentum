import {
  MINIMO_DE_DEBATIENTES,
  MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR,
  MODOS_DE_CO_MODERACION,
} from '../../shared/nucleo/coModeracion/calcularCoModeradores.js';

// Cómo se reparte la co-moderación en esta sesión (ver docs/13-foro-escrito-y-nucleo-reutilizable.md).
// Es de todas las actividades: el debate hablado y el foro escrito lo usan igual.
export function SelectorDeModeracion({ moderacion, onCambiarModeracion }) {
  function elegirModo(modo) {
    onCambiarModeracion({ ...moderacion, modo });
  }

  return (
    <div className="bloque-de-configuracion">
      <p className="texto-de-ayuda">Co-moderadores</p>
      <ul className="lista-de-perfiles">
        <li>
          <label>
            <input
              type="radio"
              name="modo-de-co-moderacion"
              checked={moderacion.modo === MODOS_DE_CO_MODERACION.REGLAMENTARIO}
              onChange={() => elegirModo(MODOS_DE_CO_MODERACION.REGLAMENTARIO)}
            />
            <span>
              <strong>📏 Reglamentario (por defecto)</strong>
              <br />
              <span className="texto-de-ayuda">
                Un co-moderador por cada 10 participantes, redondeando hacia arriba. Con menos de{' '}
                {MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR} participantes no hay co-moderadores.
              </span>
            </span>
          </label>
        </li>
        <li>
          <label>
            <input
              type="radio"
              name="modo-de-co-moderacion"
              checked={moderacion.modo === MODOS_DE_CO_MODERACION.FIJO}
              onChange={() => elegirModo(MODOS_DE_CO_MODERACION.FIJO)}
            />
            <span>
              <strong>🔢 Número fijo</strong>
              <br />
              <span className="texto-de-ayuda">
                Tú decides cuántos. La sala siempre conserva al menos {MINIMO_DE_DEBATIENTES} personas debatiendo.
              </span>
            </span>
          </label>
          {moderacion.modo === MODOS_DE_CO_MODERACION.FIJO && (
            <label className="campo-de-numero-fijo">
              Cantidad de co-moderadores
              <input
                type="number"
                min="1"
                max="20"
                inputMode="numeric"
                value={moderacion.numeroFijo ?? ''}
                onChange={(evento) =>
                  onCambiarModeracion({
                    ...moderacion,
                    numeroFijo: evento.target.value === '' ? null : Number(evento.target.value),
                  })
                }
              />
            </label>
          )}
        </li>
        <li>
          <label>
            <input
              type="radio"
              name="modo-de-co-moderacion"
              checked={moderacion.modo === MODOS_DE_CO_MODERACION.NINGUNO}
              onChange={() => elegirModo(MODOS_DE_CO_MODERACION.NINGUNO)}
            />
            <span>
              <strong>🙋 Sin co-moderadores</strong>
              <br />
              <span className="texto-de-ayuda">
                Todo lo decides tú. Revisar lo que hacen los participantes es opcional.
              </span>
            </span>
          </label>
        </li>
      </ul>
      <p className="texto-de-ayuda">
        Los designas en la sala de espera, cuando ya hayan ingresado: por sorteo o eligiéndolos tú.
      </p>
    </div>
  );
}
