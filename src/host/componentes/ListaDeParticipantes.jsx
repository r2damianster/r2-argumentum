import { combinarParticipantesConPresencia } from '../../shared/estado/seleccionesDerivadas.js';

export function ListaDeParticipantes({ estado, presencia, programa }) {
  const participantes = combinarParticipantesConPresencia(estado, presencia);
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));

  return (
    <section className="tarjeta-de-participantes">
      <p className="texto-de-ayuda">Participantes ({participantes.length})</p>
      <ul className="lista-de-participantes">
        {participantes.map((participante) => {
          const postura = participante.stanceId ? posturaPorId[participante.stanceId] : null;
          return (
            <li key={participante.participantId}>
              <span className="emoji-de-participante">{participante.emoji}</span>
              <span className="nombre-de-participante">{participante.nombre}</span>
              {participante.rol === 'co_moderador' && <span className="chip-de-rol">Co-moderador</span>}
              {postura && (
                <span className="chip-de-postura" style={{ color: postura.color }}>
                  {postura.etiqueta}
                </span>
              )}
              <span className="puntaje-de-participante">{participante.puntajeTotal} pts</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
