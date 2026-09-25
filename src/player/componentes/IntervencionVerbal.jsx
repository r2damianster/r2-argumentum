import { useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { useAtencionDelTurno } from '../useAtencionDelTurno.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Turno hablado sin argumento escrito (docs/04). Se ofrece cuando ya no queda ningún argumento
// preparado por exponer y esta persona todavía no había tomado la palabra. El resumen es
// opcional y sirve para que el co-moderador y el mapa tengan registro de lo que se dijo.
export function IntervencionVerbal({ turnoEnCurso, participantId, publicar }) {
  const [resumen, setResumen] = useState('');
  const [enviando, setEnviando] = useState(false);
  const referenciaDeLaTarjeta = useAtencionDelTurno(true, '🎙️ Tienes la palabra — pulsa «Terminé de hablar»');

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
    <section className="tarjeta-de-accion-del-turno" ref={referenciaDeLaTarjeta} role="alert">
      <p className="etiqueta-de-accion-del-turno">🎙️ Tienes la palabra</p>
      <p className="texto-de-ayuda">
        Comparte tu idea en voz alta, aunque no tengas un argumento escrito. Un
        co-moderador va a calificar lo que digas, así que apunta a dar una razón, no solo una opinión.
      </p>
      <label>
        Resumen de lo que dijiste (opcional, queda en el registro)
        <textarea value={resumen} rows={3} onChange={(evento) => setResumen(evento.target.value)} />
      </label>
      {/* Barra fija al borde inferior: se ve aunque la persona haya hecho scroll (docs/12). */}
      <div className="barra-de-accion-fija">
        <div className="barra-de-accion-fija__encabezado">
          <span>🎙️ Estás hablando</span>
        </div>
        <button type="submit" className="boton-accion-principal" disabled={enviando} onClick={registrar}>
          {enviando ? 'Registrando…' : 'Terminé de hablar'}
        </button>
      </div>
    </section>
  );
}
