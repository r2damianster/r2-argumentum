import { obtenerBidsPendientesDeDecision } from '../../shared/estado/seleccionesDerivadas.js';

export function PanelDeDecisionDeBids({ estado, motor }) {
  const bidsPendientes = obtenerBidsPendientesDeDecision(estado);

  if (bidsPendientes.length === 0) {
    return null;
  }

  return (
    <section className="tarjeta-de-bids">
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
