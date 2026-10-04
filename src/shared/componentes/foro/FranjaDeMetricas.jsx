import { calcularMetricasDeParticipacion } from '../../nucleo/conciencia/calcularMetricasDeParticipacion.js';

function redondear(numero) {
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(1);
}

// Qué tanto se está debatiendo de verdad: no solo cuántos posts hay, sino si se están respondiendo.
export function FranjaDeMetricas({ estado }) {
  const metricas = calcularMetricasDeParticipacion(estado);
  return (
    <ul className="franja-de-metricas" aria-label="Participación del grupo">
      <li>
        <strong>{metricas.totalDePosts}</strong>
        <span>posts</span>
      </li>
      <li>
        <strong>{metricas.totalDeReplicas}</strong>
        <span>réplicas</span>
      </li>
      <li>
        <strong>{redondear(metricas.postsPorDebatiente)}</strong>
        <span>posts por persona</span>
      </li>
      <li>
        <strong>{redondear(metricas.replicasPorPost)}</strong>
        <span>réplicas por post</span>
      </li>
      <li className={metricas.postsSinDebatir > 0 ? 'metrica-con-pendiente' : ''}>
        <strong>{metricas.porcentajeDePostsSinDebatir}%</strong>
        <span>sin debatir</span>
      </li>
      <li className={metricas.debatientesSinIntervenir > 0 ? 'metrica-con-pendiente' : ''}>
        <strong>{metricas.debatientesSinIntervenir}</strong>
        <span>sin intervenir</span>
      </li>
    </ul>
  );
}
