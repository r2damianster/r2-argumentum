import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';

// El moderador no tiene por qué esperar a que el Programa llegue solo a "Cierre y ranking": a
// veces se acaba la clase antes. Aquí puede ver el ranking hasta el momento sin afectar el
// debate, o cerrarlo ya (lo que congela turnos, bids y puntaje).
export function AccionesDeCierre({ estado, presencia, motor, rankingParcialVisible, onAlternarRankingParcial }) {
  const faseActual = estado.fase.actual;
  if (estado.sesion.cerrada || faseActual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING) {
    return null;
  }

  const participantesSinIntervenir = Object.values(estado.participantes).filter(
    (participante) =>
      participante.ingresoConfirmado && participante.rol !== 'co_moderador' && participante.intervenciones === 0
  ).length;

  function cerrarDebateAhora() {
    const aviso = participantesSinIntervenir > 0
      ? `Todavía ${participantesSinIntervenir} participante(s) no han tomado la palabra. `
      : '';
    const confirmado = window.confirm(
      `${aviso}Vas a cerrar el debate ahora: se detienen los turnos, los bids y el puntaje, y el ranking queda como está. Esto no se puede deshacer. ¿Cerrar el debate?`
    );
    if (confirmado) {
      motor.cerrarSesion();
    }
  }

  const turnoEnCurso = estado.turnos.turnoEnCurso;

  function terminarTurno() {
    const confirmado = window.confirm(
      `Vas a dar por terminado el turno de ${nombreDeParticipante(presencia, turnoEnCurso.participantId)}. Sirve cuando cerró la pestaña o no puede continuar; conserva su argumento preparado y la ruleta sigue. ¿Terminar el turno?`
    );
    if (confirmado) {
      motor.terminarTurnoEnCurso();
    }
  }

  return (
    <section className="tarjeta-de-fase">
      <p className="texto-de-ayuda">Ranking y cierre</p>
      {turnoEnCurso && (
        <div className="acciones-del-ranking">
          <button type="button" onClick={terminarTurno}>
            ⏭️ Terminar el turno de {nombreDeParticipante(presencia, turnoEnCurso.participantId)}
          </button>
        </div>
      )}
      <div className="acciones-del-ranking">
        <button type="button" onClick={onAlternarRankingParcial}>
          {rankingParcialVisible ? '🙈 Ocultar ranking parcial' : '📊 Ver ranking parcial'}
        </button>
        <button type="button" onClick={cerrarDebateAhora}>
          ⏹️ Cerrar el debate ahora
        </button>
      </div>
      <p className="texto-de-ayuda">
        El ranking parcial es solo para ti: no cambia nada del debate. Desde ahí también puedes bajar el PDF o el
        JSON de lo que va hasta ahora.
      </p>
    </section>
  );
}
