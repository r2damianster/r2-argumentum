import { calcularRankingPorPostura } from '../../shared/estado/seleccionesDerivadas.js';
import { exportarSesion, descargarComoJSON } from '../../shared/estado/exportarSesion.js';
import { imprimirInformeComoPDF } from '../imprimirInforme.js';

export function PantallaDeRanking({ estado, eventos, programa, presencia, motor, onNuevoDebate }) {
  const ranking = calcularRankingPorPostura(estado, programa, presencia);
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));
  const sesionCerrada = estado.sesion.cerrada;

  function manejarDescargaDeJSON() {
    const sesionExportada = exportarSesion({ eventos, estado, programa, presencia });
    const sufijo = sesionCerrada ? '' : '-parcial';
    descargarComoJSON(sesionExportada, `r2-argumentum-${programa.programId}${sufijo}-${Date.now()}.json`);
  }

  function manejarNuevoDebate() {
    const confirmado = window.confirm(
      'Vas a salir de este informe y volver a la lista de Programas. Si todavía no descargaste el JSON o el PDF, hazlo antes: al salir no hay forma de recuperarlo desde aquí. ¿Continuar?'
    );
    if (confirmado) {
      onNuevoDebate();
    }
  }

  return (
    <section className="tarjeta-de-ranking" id="ranking-del-debate">
      <h3>{sesionCerrada ? 'Ranking final' : 'Ranking parcial (el debate sigue en curso)'}</h3>
      {Object.entries(ranking).map(([stanceId, participantes]) => (
        <div key={stanceId} className="columna-de-ranking">
          <h4 style={{ color: posturaPorId[stanceId]?.color }}>{posturaPorId[stanceId]?.etiqueta}</h4>
          <ol>
            {participantes.map((participante) => (
              <li key={participante.participantId}>
                {participante.tier === 'Sólido' ? '🥇' : participante.tier === 'Consistente' ? '🥈' : '🥉'}{' '}
                {participante.emoji} {participante.nombre} — {participante.puntajeTotal} pts ({participante.tier})
              </li>
            ))}
          </ol>
        </div>
      ))}

      <div className="acciones-del-ranking">
        {!sesionCerrada && (
          <button type="button" onClick={motor.cerrarSesion}>
            Cerrar debate
          </button>
        )}
        <button type="button" onClick={() => imprimirInformeComoPDF(programa.titulo)}>
          📄 Descargar informe (PDF)
        </button>
        <button type="button" onClick={manejarDescargaDeJSON}>
          💾 Descargar sesión (.json)
        </button>
        {sesionCerrada && (
          <button type="button" onClick={manejarNuevoDebate}>
            ➕ Iniciar un debate nuevo
          </button>
        )}
      </div>
      <p className="texto-de-ayuda">
        El PDF se genera con el diálogo de impresión del navegador: elige «Guardar como PDF» como destino. El
        JSON conserva el registro completo de eventos.
      </p>
    </section>
  );
}
