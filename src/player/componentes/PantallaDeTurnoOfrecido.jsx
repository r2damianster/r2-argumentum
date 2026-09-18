import { useEffect, useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

export function PantallaDeTurnoOfrecido({ oferta, estado, participantId, publicar }) {
  const [segundosRestantes, setSegundosRestantes] = useState(
    Math.max(0, Math.round((oferta.expiraEn - Date.now()) / 1000))
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setSegundosRestantes(Math.max(0, Math.round((oferta.expiraEn - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(intervalo);
  }, [oferta.expiraEn]);

  function aceptar() {
    publicar(EVENTOS.TURNO_ACEPTADO, { turnId: oferta.turnId, participantId });
  }

  function rechazar() {
    const totalRechazosDelParticipante = (estado.participantes[participantId]?.rechazosAcumulados ?? 0) + 1;
    publicar(EVENTOS.TURNO_RECHAZADO, { turnId: oferta.turnId, participantId, totalRechazosDelParticipante });
  }

  return (
    <section className="tarjeta-de-turno-ofrecido">
      <p className="texto-de-ayuda">🎙️ ¡Es tu turno de hablar!</p>
      <p className="cuenta-regresiva">{segundosRestantes}s</p>
      <p className="texto-de-ayuda">Acepta para escribir un argumento nuevo, o rechaza si todavía no estás listo.</p>
      <div className="botonera-de-turno">
        <button type="button" onClick={aceptar}>
          Aceptar y hablar
        </button>
        <button type="button" className="boton-cambiar-programa" onClick={rechazar}>
          Rechazar
        </button>
      </div>
    </section>
  );
}
