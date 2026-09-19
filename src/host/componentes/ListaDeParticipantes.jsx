import { combinarParticipantesConPresencia } from '../../shared/estado/seleccionesDerivadas.js';

const MEDALLA_POR_POSICION = ['🥇', '🥈', '🥉'];

export function ListaDeParticipantes({ estado, presencia, programa }) {
  const participantes = combinarParticipantesConPresencia(estado, presencia);
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));
  const ordenados = [...participantes].sort((a, b) => b.puntajeTotal - a.puntajeTotal);

  // Oyentes: entraron a la sala pero no confirmaron su argumento de ingreso. Van al final y sin
  // medalla, porque no compiten — ver reglasDeIngreso.js.
  const confirmados = ordenados.filter((participante) => participante.ingresoConfirmado);
  const enEspera = ordenados.filter((participante) => !participante.ingresoConfirmado);

  return (
    <section className="tarjeta-de-participantes">
      <p className="texto-de-ayuda">
        Marcador en vivo ({confirmados.length} en el debate
        {enEspera.length > 0 ? `, ${enEspera.length} sin confirmar ingreso` : ''})
      </p>
      <ul className="lista-de-participantes">
        {confirmados.map((participante, indice) => {
          const postura = participante.stanceId ? posturaPorId[participante.stanceId] : null;
          return (
            <li key={participante.participantId}>
              <span className="medalla-de-posicion">{MEDALLA_POR_POSICION[indice] ?? `${indice + 1}º`}</span>
              <span className="emoji-de-participante">{participante.emoji}</span>
              <span className="nombre-de-participante">{participante.nombre}</span>
              {!participante.conectado && <span className="chip-de-rol">Sin conexión</span>}
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

      {enEspera.length > 0 && (
        <>
          <p className="texto-de-ayuda">Todavía escribiendo su argumento de ingreso</p>
          <ul className="lista-de-participantes">
            {enEspera.map((participante) => (
              <li key={participante.participantId}>
                <span className="medalla-de-posicion">⏳</span>
                <span className="emoji-de-participante">{participante.emoji}</span>
                <span className="nombre-de-participante">{participante.nombre}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
