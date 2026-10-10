import { criteriosActivosDelPrograma } from '../../nucleo/criteriosAdicionales/criteriosAdicionales.js';

// Lista los criterios adicionales activos de la sesión. Sin criterios activos no muestra nada.
// `encabezado` cambia según quién mira: quien escribe («Se espera además») o quien revisa («Al decidir, considera»).
export function GuiaDeCriteriosAdicionales({ programa, encabezado }) {
  const criterios = criteriosActivosDelPrograma(programa);
  if (criterios.length === 0) {
    return null;
  }
  return (
    <div className="guia-de-criterios-adicionales">
      <p className="texto-de-ayuda">
        <strong>{encabezado}</strong>
      </p>
      <ul>
        {criterios.map((criterio) => (
          <li key={criterio.id}>
            {criterio.etiqueta}
            {criterio.descripcion ? <span className="texto-de-ayuda"> — {criterio.descripcion}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
