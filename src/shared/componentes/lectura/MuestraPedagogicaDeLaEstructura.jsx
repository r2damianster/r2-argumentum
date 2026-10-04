import { resolverDistribucion, resolverEstructuraDelPrograma } from '../../nucleo/escritura/estructurasDeEscritura.js';
import { DISTRIBUCIONES_DE_ESTRUCTURA } from '../../nucleo/escritura/estructurasDeEscritura.js';

// Una muestra pedagógica de la estructura de escritura: en qué consiste, sus partes y un ejemplo resuelto
// parte por parte (con otro tema, para no dar la respuesta de la consigna). La ve el docente al configurar y
// en la sala de espera, y la clase antes de entrar (docs/14-control-de-lectura.md). Con una estructura propia
// del Programa se muestran sus partes; con escritura libre, solo una orientación.
export function MuestraPedagogicaDeLaEstructura({ programa, idioma = 'es', conEjemplo = true, titulo = null }) {
  const estructura = resolverEstructuraDelPrograma(programa, idioma);
  const desarrollada = resolverDistribucion(programa) === DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA;

  if (!estructura.queEs && estructura.esLibre) {
    return null;
  }

  return (
    <section className="muestra-pedagogica">
      <p className="etiqueta-de-la-consigna">{titulo ?? `¿Qué es ${estructura.nombre}?`}</p>
      {estructura.queEs && <p>{estructura.queEs}</p>}

      {!estructura.esLibre && (
        <ol className="partes-de-la-estructura">
          {estructura.partes.map((parte, indice) => (
            <li key={`${parte.nombre}-${indice}`}>
              <strong>{parte.nombre}</strong>
              {parte.descripcion && <span className="texto-de-ayuda"> — {parte.descripcion}</span>}
            </li>
          ))}
        </ol>
      )}

      {conEjemplo && estructura.ejemplo && (
        <div className="ejemplo-de-la-estructura">
          <p className="texto-de-ayuda">
            <strong>Ejemplo</strong> ({desarrollada ? 'una parte por párrafo' : 'todo en un párrafo, una parte por oración'}; otro tema, solo
            para ver la forma):
          </p>
          {desarrollada ? (
            estructura.ejemplo.map((oracion, indice) => (
              <p key={indice} className="parrafo-de-ejemplo">
                <span className="etiqueta-de-la-parte">{estructura.partes[indice].nombre}</span> {oracion}
              </p>
            ))
          ) : (
            <p className="parrafo-de-ejemplo">
              {estructura.ejemplo.map((oracion, indice) => (
                <span key={indice} className="oracion-de-ejemplo">
                  <span className="etiqueta-de-la-parte">{estructura.partes[indice].nombre}</span> {oracion}{' '}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
