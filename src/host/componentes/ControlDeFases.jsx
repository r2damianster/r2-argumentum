import { useEffect, useState } from 'react';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';

const ETIQUETA_DE_FASE = {
  [TIPOS_DE_FASE.APERTURA_SIMULTANEA]: 'Apertura simultánea (todos escriben)',
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
      {faseActual.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA ? (
        <PanelDeAperturaDelHost estado={estado} motor={motor} />
      ) : (
        faseActual.tipo !== TIPOS_DE_FASE.CIERRE_Y_RANKING && (
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
        )
      )}
    </section>
  );
}

// Máquina de rondas de la apertura obligatoria (ver docs/09 y motorDeSesion.js): aquí vive el
// arbitraje del host — dar 1 minuto más, cerrar la ronda ya, o dar/negar la segunda oportunidad
// a quienes quedaron sin argumento. No hay cierre automático por temporizador: el motor espera
// siempre una decisión humana una vez vencido el plazo (salvo que ya todos terminaron).
function PanelDeAperturaDelHost({ estado, motor }) {
  const apertura = estado.apertura;
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!apertura || apertura.cerrada) {
      return undefined;
    }
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [apertura?.ronda, apertura?.cerrada, apertura?.expiraEn]);

  if (!apertura) {
    return <p className="texto-de-ayuda">Arrancando la apertura…</p>;
  }

  if (!apertura.cerrada) {
    const segundosRestantes = Math.max(0, Math.round((apertura.expiraEn - ahora) / 1000));
    const tiempoAgotado = segundosRestantes === 0;
    return (
      <div className="panel-de-apertura-host">
        <p className="texto-de-ayuda">
          {tiempoAgotado
            ? 'Tiempo agotado.'
            : `Tiempo restante: ${segundosRestantes}s`}{' '}
          — pregunta a los estudiantes si ya todos ingresaron su argumento.
        </p>
        <button type="button" onClick={() => motor.cerrarRondaDeApertura()}>
          {tiempoAgotado ? 'Cerrar ronda ya' : 'Cerrar ronda ahora (ya terminaron)'}
        </button>
        {apertura.ronda === 1 && (
          <button type="button" onClick={motor.extenderRondaDeApertura}>
            Dar 1 minuto más
          </button>
        )}
      </div>
    );
  }

  if (apertura.esperandoSegundaOportunidad) {
    const pendientes = apertura.ultimoCierre?.pendientes ?? [];
    return (
      <div className="panel-de-apertura-host">
        <p className="texto-de-ayuda">
          Faltan {pendientes.length} participante(s) sin argumento aprobado. ¿Das otra oportunidad de 1 minuto?
        </p>
        <button type="button" onClick={motor.abrirSegundaOportunidadDeApertura}>
          Sí, dar 1 minuto más
        </button>
        <button type="button" onClick={() => motor.cerrarRondaDeApertura({ forzarFinal: true })}>
          No, continuar sin ellos
        </button>
      </div>
    );
  }

  return null;
}
