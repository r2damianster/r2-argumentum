// Primer paso de la consola del host: elegir QUÉ actividad se va a hacer, antes de elegir el
// Programa (ver docs/13-foro-escrito-y-nucleo-reutilizable.md). Las tarjetas salen del registro de
// actividades: una actividad nueva aparece aquí sin tocar este componente.

export function SelectorDeActividad({ actividades, onElegirActividad }) {
  return (
    <section className="tarjeta-de-programa">
      <h2>¿Qué actividad vas a hacer?</h2>
      <p className="texto-de-ayuda">
        La actividad define cómo participa la clase. Después eliges el Programa (tema, posturas y reglas).
      </p>
      <ul className="opciones-de-actividad">
        {actividades.map((actividad) => (
          <li key={actividad.id}>
            <button type="button" className="opcion-de-actividad" onClick={() => onElegirActividad(actividad.id)}>
              <span className="opcion-de-actividad-icono" aria-hidden="true">
                {actividad.icono}
              </span>
              <span className="opcion-de-actividad-nombre">{actividad.etiqueta}</span>
              <span className="opcion-de-actividad-descripcion">{actividad.descripcion}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
