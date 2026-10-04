import {
  describirCompletitud,
  describirFalacias,
} from '../../nucleo/sugerenciaDeIA/etiquetasDeSugerencia.js';

// Lo que la IA SUGIERE sobre un aporte: completitud y posibles falacias. No es una nota: lo ven quien
// escribió (para mejorar), los co-moderadores y el moderador (para decidir). Los compañeros no lo ven.
export function SugerenciaDeIA({ sugerencia, conComentario = true }) {
  if (!sugerencia) {
    return null;
  }
  const completitud = describirCompletitud(sugerencia);
  const falacias = describirFalacias(sugerencia);
  if (!completitud && falacias.length === 0 && !sugerencia.comentario) {
    return null;
  }

  return (
    <div className="sugerencia-de-ia">
      <p className="etiqueta-de-sugerencia">🤖 Sugerencia de la IA</p>
      {completitud && (
        <span className={`chip-de-completitud chip-de-completitud--${sugerencia.completitud}`}>{completitud}</span>
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
