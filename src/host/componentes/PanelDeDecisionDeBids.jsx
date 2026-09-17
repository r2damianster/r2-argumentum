import { obtenerBidsAbiertos, obtenerBidsPendientesDeDecision } from '../../shared/estado/seleccionesDerivadas.js';

export function PanelDeDecisionDeBids({ estado, motor }) {
  const bidsPendientes = obtenerBidsPendientesDeDecision(estado);
  const bidsAbiertos = obtenerBidsAbiertos(estado);
  const turnosConBidsAbiertos = [...new Set(bidsAbiertos.map((bid) => bid.turnoPrincipalId))];

  if (bidsPendientes.length === 0 && turnosConBidsAbiertos.length === 0) {
    return null;
  }

  return (
    <section className="tarjeta-de-bids">
      {turnosConBidsAbiertos.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Bids todavía en votación ({bidsAbiertos.length}) — se cierran solos cuando todos los
            co-moderadores voten, o podés cortarlo ahora:
          </p>
          {turnosConBidsAbiertos.map((turnoPrincipalId) => (
            <button
              key={turnoPrincipalId}
              type="button"
              className="boton-cambiar-programa"
              onClick={() => motor.cerrarTopicoDeBids(turnoPrincipalId)}
            >
              Cerrar tópico de bids ahora
            </button>
          ))}
        </div>
      )}
      <p className="texto-de-ayuda">Bids esperando veredicto del moderador</p>
      <ul className="lista-de-bids-pendientes">
        {bidsPendientes.map((bid) => {
          const argumentoObjetivo = estado.argumentos[bid.argumentoObjetivoId];
          const aprueban = Object.values(bid.votos).filter((voto) => voto === 'aprueba').length;
          const rechazan = Object.values(bid.votos).filter((voto) => voto === 'rechaza').length;
          return (
            <li key={bid.bidId}>
              <p className="texto-de-ayuda">
                {bid.tipoDeBid === 'desmontar' ? 'Desmontar' : 'Fortalecer'} → "{argumentoObjetivo?.texto?.slice(0, 60)}…"
              </p>
              <p>{bid.texto}</p>
              <p className="texto-de-ayuda">
                ✅ {aprueban} · ❌ {rechazan}
              </p>
              <div className="botonera-de-bid">
                <button type="button" onClick={() => motor.decidirBid(bid.bidId, 'aprobado')}>
                  Aprobar
                </button>
                <button type="button" onClick={() => motor.decidirBid(bid.bidId, 'rechazado')}>
                  Rechazar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
