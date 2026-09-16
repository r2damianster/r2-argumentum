import { calcularRankingPorPostura } from '../../shared/estado/seleccionesDerivadas.js';
import { exportarSesion, descargarComoJSON } from '../../shared/estado/exportarSesion.js';

export function PantallaDeRanking({ estado, eventos, programa, motor }) {
  const ranking = calcularRankingPorPostura(estado, programa);
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));

  function manejarDescarga() {
    const sesionExportada = exportarSesion({ eventos, estado, programa });
    descargarComoJSON(sesionExportada, `r2-argumentum-${programa.programId}-${Date.now()}.json`);
  }

  return (
    <section className="tarjeta-de-ranking">
      <h3>Ranking por postura</h3>
      {Object.entries(ranking).map(([stanceId, participantes]) => (
        <div key={stanceId} className="columna-de-ranking">
          <h4 style={{ color: posturaPorId[stanceId]?.color }}>{posturaPorId[stanceId]?.etiqueta}</h4>
          <ol>
            {participantes.map((participante) => (
              <li key={participante.participantId}>
                {participante.tier === 'Sólido' ? '🥇' : participante.tier === 'Consistente' ? '🥈' : '🥉'}{' '}
                {participante.participantId} — {participante.puntajeTotal} pts ({participante.tier})
              </li>
            ))}
          </ol>
        </div>
      ))}

      {!estado.sesion.cerrada ? (
        <button type="button" onClick={motor.cerrarSesion}>
          Cerrar sesión
        </button>
      ) : (
        <button type="button" onClick={manejarDescarga}>
          Descargar sesión (.json)
        </button>
      )}
    </section>
  );
}
