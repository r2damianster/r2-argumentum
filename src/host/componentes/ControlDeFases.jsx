import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';

const ETIQUETA_DE_FASE = {
  [TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS]: 'Escritura de argumentos',
  [TIPOS_DE_FASE.CONEXION_SUGERIDA]: 'Conexión sugerida por Groq',
  [TIPOS_DE_FASE.CONEXION_LIBRE]: 'Conexión libre',
  [TIPOS_DE_FASE.CIERRE_Y_RANKING]: 'Cierre y ranking',
};

export function ControlDeFases({ estado, motor }) {
  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;
  const faseActual = estado.fase.actual;

  if (!sesionIniciada) {
    return (
      <section className="tarjeta-de-fase" style={{ textAlign: 'center', padding: '1.2rem' }}>
        <p className="texto-de-ayuda">¿Todos los participantes escanean el QR? Haz clic en iniciar cuando la clase esté lista.</p>
        <button
          type="button"
          onClick={() => motor.iniciarSesion()}
          style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '0.8rem 1.5rem', width: '100%', marginTop: '0.5rem' }}
        >
          🚀 Iniciar debate
        </button>
      </section>
    );
  }

  if (!faseActual) {
    return (
      <section className="tarjeta-de-fase">
        <p className="texto-de-ayuda">Sin fase activa.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-fase">
      <p className="texto-de-ayuda">Fase activa</p>
      <h3>
        {ETIQUETA_DE_FASE[faseActual.tipo] || faseActual.tipo}
        {faseActual.ronda ? ` · Ronda ${faseActual.ronda}` : ''}
      </h3>
      {faseActual.tipo !== TIPOS_DE_FASE.CIERRE_Y_RANKING && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {faseActual.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS && motor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="texto-de-ayuda">
                  Ruleta: {estado.turnos.ruletaPausada ? '⏸️ Pausada' : '▶️ Activa'}
                </span>
                {estado.turnos.ruletaPausada ? (
                  <button type="button" onClick={() => motor.reanudarRuleta()}>
                    ▶️ Reanudar ruleta
                  </button>
                ) : (
                  <button type="button" className="boton-cambiar-programa" onClick={() => motor.pausarRuleta()}>
                    ⏸️ Pausar ruleta
                  </button>
                )}
              </div>
            )}
            <button type="button" onClick={motor.cerrarFaseActual}>
              Cerrar fase actual
            </button>
          </div>
        )}
    </section>
  );
}
