import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

function generarIdDePostura(etiqueta) {
  const base = etiqueta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return base || `postura_${Date.now()}`;
}

const COLORES_PARA_POSTURAS_NUEVAS = ['#0891B2', '#BE185D', '#4D7C0F', '#7C3AED', '#EA580C'];

// Solo aparece si el Programa tiene permitirPosturasNuevas (ver ControlDeFases). Un estudiante
// cuyo argumento no encaja en ninguna postura puede proponer la suya; aquí el moderador decide
// si entra al debate. Aceptarla republica el Programa con la postura agregada, así el grafo, el
// ranking y el resto de la UI la toman desde el canal como cualquier otra.
export function PanelDePosturasPropuestas({ estado, programa, identificadorDeSesion, publicar }) {
  const pendientes = Object.values(estado.posturasPropuestas).filter((propuesta) => !propuesta.decision);

  if (pendientes.length === 0) {
    return null;
  }

  function aceptar(propuesta) {
    const posturaNueva = {
      id: generarIdDePostura(propuesta.etiquetaPropuesta),
      etiqueta: propuesta.etiquetaPropuesta,
      color: COLORES_PARA_POSTURAS_NUEVAS[programa.posturas.length % COLORES_PARA_POSTURAS_NUEVAS.length],
    };

    publicar(EVENTOS.PROGRAMA_PUBLICADO, {
      programa: { ...programa, posturas: [...programa.posturas, posturaNueva] },
      identificadorDeSesion,
      origen: 'postura-aceptada',
    });
    publicar(EVENTOS.POSTURA_DECISION_MODERADOR, {
      propuestaId: propuesta.propuestaId,
      decision: 'aceptada',
      stanceId: posturaNueva.id,
    });
  }

  function rechazar(propuesta) {
    publicar(EVENTOS.POSTURA_DECISION_MODERADOR, {
      propuestaId: propuesta.propuestaId,
      decision: 'rechazada',
      stanceId: null,
    });
  }

  return (
    <section className="tarjeta-de-bids">
      <h3>Posturas propuestas por estudiantes</h3>
      <p className="texto-de-ayuda">
        Si aceptas, la postura se suma al debate y queda disponible para todos. Si la rechazas, quien la propuso
        tiene que reescribir su argumento defendiendo una de las que ya existen.
      </p>
      <ul className="lista-de-bids-pendientes">
        {pendientes.map((propuesta) => (
          <li key={propuesta.propuestaId}>
            <p>
              <strong>
                {propuesta.emoji} {propuesta.nombre}
              </strong>{' '}
              propone: <strong>{propuesta.etiquetaPropuesta}</strong>
            </p>
            <p className="texto-de-ayuda">Su argumento: “{propuesta.textoDelArgumento}”</p>
            <div className="botonera-de-bid">
              <button type="button" onClick={() => aceptar(propuesta)}>
                Aceptar postura
              </button>
              <button type="button" className="boton-cambiar-programa" onClick={() => rechazar(propuesta)}>
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
