import { useState } from 'react';
import { EVENTOS, TIPOS_DE_BID } from '../../shared/eventos/nombresDeEventos.js';
import { obtenerArgumentosDelTurnoEnCurso } from '../estadoDelParticipante.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PanelDeBid({ estado, participantId, turnoEnCurso, publicar }) {
  const [tipoDeBid, setTipoDeBid] = useState(TIPOS_DE_BID.DESMONTAR);
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState('');
  const [texto, setTexto] = useState('');

  const argumentosDelTurno = obtenerArgumentosDelTurnoEnCurso(estado);
  const bidsDeEsteTurno = Object.values(estado.bids).filter(
    (bid) => bid.turnoPrincipalId === turnoEnCurso.turnId
  );

  function manejarEnvio(evento) {
    evento.preventDefault();
    if (!texto.trim() || !argumentoObjetivoId) {
      return;
    }
    publicar(EVENTOS.BID_ENVIADO, {
      bidId: generarId('bid'),
      participantId,
      tipoDeBid,
      argumentoObjetivoId,
      texto,
      ronda: estado.fase.actual?.ronda ?? 1,
      turnoPrincipalId: turnoEnCurso.turnId,
    });
    setTexto('');
    setArgumentoObjetivoId('');
  }

  return (
    <section className="tarjeta-de-bid">
      <p className="texto-de-ayuda">
        {estado.participantes[turnoEnCurso.participantId] ? 'Alguien' : ''} tiene el turno — puedes lanzar una
        intervención
      </p>

      {bidsDeEsteTurno.length > 0 && (
        <ul className="lista-de-bids-en-curso">
          {bidsDeEsteTurno.map((bid) => {
            const aprueban = Object.values(bid.votos).filter((voto) => voto === 'aprueba').length;
            const rechazan = Object.values(bid.votos).filter((voto) => voto === 'rechaza').length;
            return (
              <li key={bid.bidId}>
                {bid.tipoDeBid === TIPOS_DE_BID.DESMONTAR ? '💥 Desmontar' : '💪 Fortalecer'}: "{bid.texto.slice(0, 40)}…" — ✅{' '}
                {aprueban} ❌ {rechazan}
              </li>
            );
          })}
        </ul>
      )}

      {argumentosDelTurno.length > 0 && (
        <form onSubmit={manejarEnvio}>
          <label>
            Tipo de bid
            <select value={tipoDeBid} onChange={(evento) => setTipoDeBid(evento.target.value)}>
              <option value={TIPOS_DE_BID.DESMONTAR}>Desmontar</option>
              <option value={TIPOS_DE_BID.FORTALECER}>Fortalecer</option>
            </select>
          </label>
          <label>
            Argumento objetivo
            <select value={argumentoObjetivoId} onChange={(evento) => setArgumentoObjetivoId(evento.target.value)}>
              <option value="">Elige uno…</option>
              {argumentosDelTurno.map((argumento) => (
                <option key={argumento.argumentId} value={argumento.argumentId}>
                  {argumento.texto.slice(0, 50)}…
                </option>
              ))}
            </select>
          </label>
          <label>
            Tu intervención (es el texto final si se aprueba)
            <textarea value={texto} onChange={(evento) => setTexto(evento.target.value)} rows={3} />
          </label>
          <button type="submit">Lanzar bid</button>
        </form>
      )}
    </section>
  );
}
