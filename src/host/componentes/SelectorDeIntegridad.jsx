import { NIVELES_DE_INTEGRIDAD } from '../../shared/nucleo/integridad/nivelesDeIntegridad.js';

// Integridad académica de lo que se escribe en la sesión (ver docs/13-foro-escrito-y-nucleo-reutilizable.md).
// Apagada por defecto: no se registra nada. Es de todas las actividades donde se escribe.
export function SelectorDeIntegridad({ integridad, onCambiarIntegridad }) {
  function elegirNivel(nivel) {
    onCambiarIntegridad({ ...integridad, nivel });
  }

  return (
    <div className="bloque-de-configuracion">
      <p className="texto-de-ayuda">Integridad de lo que se escribe</p>
      <ul className="lista-de-perfiles">
        <li>
          <label>
            <input
              type="radio"
              name="nivel-de-integridad"
              checked={integridad.nivel === NIVELES_DE_INTEGRIDAD.NINGUNA}
              onChange={() => elegirNivel(NIVELES_DE_INTEGRIDAD.NINGUNA)}
            />
            <span>
              <strong>Sin evaluación (por defecto)</strong>
              <br />
              <span className="texto-de-ayuda">No se registra nada.</span>
            </span>
          </label>
        </li>
        <li>
          <label>
            <input
              type="radio"
              name="nivel-de-integridad"
              checked={integridad.nivel === NIVELES_DE_INTEGRIDAD.ADVERTENCIAS}
              onChange={() => elegirNivel(NIVELES_DE_INTEGRIDAD.ADVERTENCIAS)}
            />
            <span>
              <strong>🛡️ Con advertencias</strong>
              <br />
              <span className="texto-de-ayuda">
                Se registran señales (texto pegado, arrastrado, velocidad inusual…). Quien escribe ve «el moderador verá
                esta marca» antes de enviar y puede reescribir. Solo tú ves las marcas. Son una advertencia, no una prueba.
              </span>
            </span>
          </label>
        </li>
        <li>
          <label>
            <input
              type="radio"
              name="nivel-de-integridad"
              checked={integridad.nivel === NIVELES_DE_INTEGRIDAD.RESTRICTIVA}
              onChange={() => elegirNivel(NIVELES_DE_INTEGRIDAD.RESTRICTIVA)}
            />
            <span>
              <strong>🔒 Restrictiva</strong>
              <br />
              <span className="texto-de-ayuda">
                Además de registrar, se bloquea pegar y arrastrar texto. Para actividades con peso en la nota. Los intentos
                quedan registrados.
              </span>
            </span>
          </label>
        </li>
      </ul>
      {integridad.nivel !== NIVELES_DE_INTEGRIDAD.NINGUNA && (
        <p className="texto-de-ayuda">
          Al ingresar, la clase verá un aviso de que se registran señales de integridad. Si usas estos datos en una
          investigación, inclúyelo en tu protocolo de ética.
        </p>
      )}
    </div>
  );
}
