import { calcularAvisosParaElModerador, GRAVEDAD } from '../../shared/instrucciones/calcularAvisos.js';
import { calcularAvisosDelForo } from '../../shared/instrucciones/calcularAvisosDelForo.js';
import { resolverActividadDelPrograma } from '../../actividades/registroDeActividades.js';
import { ID_FORO_ESCRITO } from '../../actividades/foroEscrito/definicion.js';

// Avisos automáticos para que el docente no tenga que vigilar cinco paneles a la vez: quién no
// preparó argumento, quién no ha hablado todavía, qué queda sin revisar.
export function PanelDeAvisos({ estado, presencia, motor }) {
  // Cada actividad tiene sus propios avisos: en el foro no hay ruleta ni turnos.
  const esForo = resolverActividadDelPrograma(estado.programa).id === ID_FORO_ESCRITO;
  const avisos = esForo ? calcularAvisosDelForo(estado, presencia) : calcularAvisosParaElModerador(estado, presencia);

  if (avisos.length === 0) {
    return null;
  }

  return (
    <section className="tarjeta-de-avisos">
      <h3>Atención</h3>
      <ul className="lista-de-avisos">
        {avisos.map((aviso) => (
          <li key={aviso.id} className={aviso.gravedad === GRAVEDAD.ALTA ? 'aviso-alto' : ''}>
            <strong>{aviso.texto}</strong>
            <p className="texto-de-ayuda">{aviso.detalle}</p>
            {aviso.id === 'desbalance-extremo-posturas' && motor?.reasignarRolplayEquilibrado && (
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="boton-cambiar-programa"
                  onClick={() => motor.reasignarRolplayEquilibrado()}
                >
                  🎲 Reasignar a Rolplay (balancear 50/50)
                </button>
              </div>
            )}
            {aviso.id === 'tiempo-final' && motor?.extenderTiempo && (
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" className="boton-cambiar-programa" onClick={() => motor.extenderTiempo()}>
                  ➕ Extender 5 minutos
                </button>
              </div>
            )}
            {aviso.id === 'ruleta-pausada' && motor && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => motor.reanudarRuleta()}
                >
                  ▶️ Reanudar ruleta
                </button>
                <button
                  type="button"
                  className="boton-cambiar-programa"
                  onClick={() => motor.cerrarFaseActual()}
                >
                  ⏩ Cerrar fase actual
                </button>
              </div>
            )}
            {aviso.id === 'bucle-turnos-casi-pausado' && motor && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="boton-cambiar-programa"
                  onClick={() => motor.pausarRuleta()}
                >
                  ⏸️ Pausar ruleta
                </button>
                <button
                  type="button"
                  className="boton-cambiar-programa"
                  onClick={() => motor.cerrarFaseActual()}
                >
                  ⏩ Cerrar fase actual
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
