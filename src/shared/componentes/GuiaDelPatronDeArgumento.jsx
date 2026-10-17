import { patronDeArgumentoActivo } from '../nucleo/patronesDeEscritura/patronDeArgumento.js';
import { resolverIdiomaDelDebate } from '../programa/idiomaDelDebate.js';

// Recordatorio del patrón de escritura que pidió el moderador, para quien escribe un argumento.
// Sin patrón activo no muestra nada. Es una ayuda: el argumento pasa igual aunque no lo siga.
export function GuiaDelPatronDeArgumento({ programa }) {
  const patron = patronDeArgumentoActivo(programa, resolverIdiomaDelDebate(programa));
  if (!patron) {
    return null;
  }
  const { estructura, daRetroalimentacion } = patron;
  const nombresDeLasPartes = estructura.partes.map((parte) => parte.nombre).join(' → ');
  return (
    <div className="guia-del-patron-de-argumento">
      <p className="texto-de-ayuda">
        <strong>Patrón pedido: {estructura.nombre}</strong> — {nombresDeLasPartes}
      </p>
      <details>
        <summary className="texto-de-ayuda">¿Qué va en cada parte?</summary>
        <ol className="partes-de-la-estructura">
          {estructura.partes.map((parte, indice) => (
            <li key={`${parte.nombre}-${indice}`}>
              <strong>{parte.nombre}</strong>
              {parte.descripcion && <span className="texto-de-ayuda"> — {parte.descripcion}</span>}
            </li>
          ))}
        </ol>
        {estructura.ejemplo && (
          <p className="parrafo-de-ejemplo">
            {estructura.ejemplo.map((oracion, indice) => (
              <span key={indice} className="oracion-de-ejemplo">
                <span className="etiqueta-de-la-parte">{estructura.partes[indice].nombre}</span> {oracion}{' '}
              </span>
            ))}
          </p>
        )}
      </details>
      <p className="texto-de-ayuda">
        {daRetroalimentacion
          ? 'La IA te sugerirá qué parte falta; tú decides si la agregas.'
          : 'Úsalo como guía. Esta vez no recibirás sugerencias sobre el patrón.'}
      </p>
    </div>
  );
}
