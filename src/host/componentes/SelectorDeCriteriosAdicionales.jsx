import { MAXIMO_DE_CRITERIOS_ACTIVOS } from '../../shared/nucleo/criteriosAdicionales/criteriosAdicionales.js';

// Criterios adicionales que el Programa propone para lo que se escribe (ver docs/03-programa-de-debate.md).
// El moderador activa o apaga cada uno para esta sesión; quedan fijos al iniciar. Son una ayuda, no puntaje:
// la clase los ve al escribir, la IA sugiere si se cumplen y quienes moderan los consideran al decidir.
export function SelectorDeCriteriosAdicionales({ criterios, idsDeCriteriosActivos, onCambiarCriteriosActivos }) {
  if (criterios.length === 0) {
    return null;
  }
  const topeAlcanzado = idsDeCriteriosActivos.size >= MAXIMO_DE_CRITERIOS_ACTIVOS;

  function alternarCriterio(criterioId) {
    const siguientes = new Set(idsDeCriteriosActivos);
    if (siguientes.has(criterioId)) {
      siguientes.delete(criterioId);
    } else if (!topeAlcanzado) {
      siguientes.add(criterioId);
    }
    onCambiarCriteriosActivos(siguientes);
  }

  return (
    <div className="bloque-de-configuracion">
      <p className="texto-de-ayuda">
        Criterios adicionales (hasta {MAXIMO_DE_CRITERIOS_ACTIVOS}) — lo que se pide además de afirmación y razón
      </p>
      <ul className="lista-de-perfiles">
        {criterios.map((criterio) => {
          const estaActivo = idsDeCriteriosActivos.has(criterio.id);
          return (
            <li key={criterio.id}>
              <label>
                <input
                  type="checkbox"
                  checked={estaActivo}
                  disabled={!estaActivo && topeAlcanzado}
                  onChange={() => alternarCriterio(criterio.id)}
                />
                <span>
                  <strong>{criterio.etiqueta}</strong>
                  {criterio.descripcion && (
                    <>
                      <br />
                      <span className="texto-de-ayuda">{criterio.descripcion}</span>
                    </>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="texto-de-ayuda">
        La clase los verá al escribir, la IA solo sugiere si se cumplen y quienes moderan los consideran al decidir.
        No suman ni restan puntos por sí solos. Quedan fijos al iniciar el foro.
      </p>
    </div>
  );
}
