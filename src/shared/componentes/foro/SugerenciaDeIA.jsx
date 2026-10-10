import {
  describirCompletitud,
  describirFalacias,
} from '../../nucleo/sugerenciaDeIA/etiquetasDeSugerencia.js';

// Lo que la IA SUGIERE sobre un aporte: completitud, posibles falacias y criterios adicionales. No es una nota: lo ven quien
// escribió (para mejorar), los co-moderadores y el moderador (para decidir). Los compañeros no lo ven.
export function SugerenciaDeIA({ sugerencia, conComentario = true }) {
  if (!sugerencia) {
    return null;
  }
  const completitud = describirCompletitud(sugerencia);
  const falacias = describirFalacias(sugerencia);
  const criterios = sugerencia.criterios ?? [];
  if (!completitud && falacias.length === 0 && criterios.length === 0 && !sugerencia.comentario) {
    return null;
  }

  return (
    <div className="sugerencia-de-ia">
      <p className="etiqueta-de-sugerencia">🤖 Sugerencia de la IA</p>
      {completitud && (
        <span className={`chip-de-completitud chip-de-completitud--${sugerencia.completitud}`}>{completitud}</span>
      )}
      {criterios.length > 0 && (
        <ul className="lista-de-criterios-sugeridos">
          {criterios.map((criterio) => (
            <li key={criterio.id}>
              <span className={`chip-de-criterio chip-de-criterio--${criterio.cumple ? 'cumple' : 'no_cumple'}`}>
                {criterio.cumple ? '✔' : '✖'} {criterio.etiqueta}
              </span>
            </li>
          ))}
        </ul>
      )}
      {falacias.length > 0 && (
        <ul className="lista-de-falacias">
          {falacias.map((falacia, indice) => (
            <li key={`${falacia.tipo}-${indice}`}>
              <strong>Posible falacia: {falacia.etiqueta}.</strong> «{falacia.fragmento}»
              {falacia.explicacion ? ` — ${falacia.explicacion}` : ''}
            </li>
          ))}
        </ul>
      )}
      {conComentario && sugerencia.comentario && <p className="texto-de-ayuda">{sugerencia.comentario}</p>}
    </div>
  );
}
