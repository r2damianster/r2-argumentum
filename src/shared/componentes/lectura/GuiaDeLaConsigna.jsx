import { resolverIdiomaDelDebate } from '../../programa/idiomaDelDebate.js';
import {
  describirLaEstructuraPedida,
  resolverEstructuraDelPrograma,
} from '../../nucleo/escritura/estructurasDeEscritura.js';

// La consigna del control de lectura y la guía de la estructura pedida: lo que ve quien escribe y lo
// que proyecta el docente. No muestra nada de la rúbrica ni de las claves de la lectura.
export function GuiaDeLaConsigna({ programa, conPartes = true }) {
  const idioma = resolverIdiomaDelDebate(programa);
  const estructura = resolverEstructuraDelPrograma(programa, idioma);

  return (
    <section className="guia-de-la-consigna">
      <p className="etiqueta-de-la-consigna">Consigna</p>
      <p className="texto-de-la-consigna">{programa.consigna}</p>
      <p className="texto-de-ayuda">{describirLaEstructuraPedida(programa, idioma)}</p>
      {conPartes && !estructura.esLibre && (
        <ol className="partes-de-la-estructura">
          {estructura.partes.map((parte, indice) => (
            <li key={`${parte.nombre}-${indice}`}>
              <strong>{parte.nombre}</strong>
              {parte.descripcion && <span className="texto-de-ayuda"> — {parte.descripcion}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
