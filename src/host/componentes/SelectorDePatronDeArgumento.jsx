import {
  DESCRIPCION_DEL_MODO_DEL_PATRON,
  ETIQUETA_DEL_MODO_DEL_PATRON,
  MODOS_DEL_PATRON,
  avisoDeLongitudDelPatron,
  patronesElegibles,
} from '../../shared/nucleo/patronesDeEscritura/patronDeArgumento.js';
import { MuestraPedagogicaDeLaEstructura } from '../../shared/componentes/lectura/MuestraPedagogicaDeLaEstructura.jsx';

const MODOS_CON_PATRON = [MODOS_DEL_PATRON.CON_RETROALIMENTACION, MODOS_DEL_PATRON.SIN_RETROALIMENTACION];

// Patrón de escritura que se espera en los argumentos (PEEL, SPRE, PREP, CER, Toulmin).
// Apagado por defecto. Es una ayuda, no puntaje: el argumento pasa igual aunque no lo siga.
export function SelectorDePatronDeArgumento({ patronDeArgumento, idioma, onCambiarPatronDeArgumento }) {
  const estaActivo = patronDeArgumento.modo !== MODOS_DEL_PATRON.NINGUNO;
  const aviso = avisoDeLongitudDelPatron(patronDeArgumento.estructura);

  function alternarPatron(evento) {
    onCambiarPatronDeArgumento({
      ...patronDeArgumento,
      modo: evento.target.checked ? MODOS_DEL_PATRON.CON_RETROALIMENTACION : MODOS_DEL_PATRON.NINGUNO,
    });
  }

  return (
    <div className="bloque-de-configuracion">
      <label className="casilla-de-falta">
        <input type="checkbox" checked={estaActivo} onChange={alternarPatron} />
        Pedir un patrón de escritura en los argumentos
      </label>
      <p className="texto-de-ayuda">
        Apagado por defecto. Quien escribe ve las partes del patrón y la IA solo sugiere si las usó: nunca bloquea el
        envío ni suma o resta puntos.
      </p>

      {estaActivo && (
        <>
          <label>
            Patrón
            <select
              value={patronDeArgumento.estructura}
              onChange={(evento) => onCambiarPatronDeArgumento({ ...patronDeArgumento, estructura: evento.target.value })}
            >
              {patronesElegibles().map((patron) => (
                <option key={patron.id} value={patron.id}>
                  {patron.nombre.es} ({patron.partes.length} partes)
                </option>
              ))}
            </select>
          </label>
          {aviso && <p className="texto-de-ayuda">⚠️ {aviso}</p>}

          <ul className="lista-de-perfiles">
            {MODOS_CON_PATRON.map((modo) => (
              <li key={modo}>
                <label>
                  <input
                    type="radio"
                    name="modo-del-patron-de-argumento"
                    checked={patronDeArgumento.modo === modo}
                    onChange={() => onCambiarPatronDeArgumento({ ...patronDeArgumento, modo })}
                  />
                  <span>
                    <strong>{ETIQUETA_DEL_MODO_DEL_PATRON[modo]}</strong>
                    <br />
                    <span className="texto-de-ayuda">{DESCRIPCION_DEL_MODO_DEL_PATRON[modo]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <MuestraPedagogicaDeLaEstructura programa={{ estructura: patronDeArgumento.estructura }} idioma={idioma} />
        </>
      )}
    </div>
  );
}
