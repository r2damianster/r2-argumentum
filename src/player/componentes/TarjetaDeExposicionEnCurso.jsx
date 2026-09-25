import { useAtencionDelTurno } from '../useAtencionDelTurno.js';

// Lo que ve quien tiene la palabra y ya tiene su argumento en el mapa: defenderlo en voz alta y
// pulsar «Ya lo expuse». Es la acción que cierra el turno, así que va fija abajo y con énfasis.
export function TarjetaDeExposicionEnCurso({ textoDelArgumento, alTerminar }) {
  const referencia = useAtencionDelTurno(true, '🎙️ Estás exponiendo — pulsa «Ya lo expuse»');

  return (
    <section className="tarjeta-de-accion-del-turno" ref={referencia} role="alert">
      <p className="etiqueta-de-accion-del-turno">🎙️ Tienes la palabra</p>
      <p className="texto-de-ayuda">
        Defiende en voz alta tu argumento, que ya está en el mapa; los co-moderadores califican cómo lo
        expones. Cuando termines, pulsa el botón verde.
      </p>
      <blockquote className="cita-de-argumento">{textoDelArgumento}</blockquote>
      {/* Barra fija al borde inferior: se ve aunque la persona haya hecho scroll (docs/12). */}
      <div className="barra-de-accion-fija">
        <div className="barra-de-accion-fija__encabezado">
          <span>🎙️ Estás exponiendo</span>
        </div>
        <button type="button" className="boton-accion-principal" onClick={alTerminar}>
          Ya lo expuse
        </button>
      </div>
    </section>
  );
}
