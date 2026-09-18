import { useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Turno hablado sin argumento escrito (docs/04). Se ofrece cuando ya no queda ningún argumento
// preparado por exponer y esta persona todavía no había tomado la palabra. El resumen es
// opcional y sirve para que el co-moderador y el mapa tengan registro de lo que se dijo.
export function IntervencionVerbal({ turnoEnCurso, participantId, publicar }) {
  const [resumen, setResumen] = useState('');
  const [enviando, setEnviando] = useState(false);

  function registrar() {
    setEnviando(true);
    publicar(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, {
      intervencionId: generarId('verbal'),
      participantId,
      turnId: turnoEnCurso.turnId,
      resumen: resumen.trim(),
    });
  }

  return (
    <section className="tarjeta-de-formulario-de-argumento">
      <p className="texto-de-ayuda">
        🎙️ Tienes la palabra. Comparte tu idea en voz alta, aunque no tengas un argumento escrito. Un
        co-moderador va a calificar lo que digas, así que apunta a dar una razón, no solo una opinión.
      </p>
      <label>
        Resumen de lo que dijiste (opcional, queda en el registro)
        <textarea value={resumen} rows={3} onChange={(evento) => setResumen(evento.target.value)} />
      </label>
      <button type="submit" disabled={enviando} onClick={registrar}>
        {enviando ? 'Registrando…' : 'Terminé de hablar'}
      </button>
    </section>
  );
}
