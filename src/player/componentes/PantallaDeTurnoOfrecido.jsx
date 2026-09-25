import { useAtencionDelTurno } from '../useAtencionDelTurno.js';
import { useEffect, useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import {
  calcularPenalidadPorRechazoDeTurno,
  resolverParametrosDePuntaje,
} from '../../shared/puntaje/formulaDePuntaje.js';

// El turno nunca es una invitación a ponerse a escribir: o vienes a defender un argumento que
// ya preparaste (modo "argumento"), o es un turno hablado sin argumento escrito porque ya no
// queda nada preparado por exponer y todavía no tomaste la palabra (modo "verbal"). Ver docs/04.
export function PantallaDeTurnoOfrecido({ oferta, estado, programa, participantId, publicar }) {
  const [segundosRestantes, setSegundosRestantes] = useState(
    Math.max(0, Math.round((oferta.expiraEn - Date.now()) / 1000))
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setSegundosRestantes(Math.max(0, Math.round((oferta.expiraEn - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(intervalo);
  }, [oferta.expiraEn]);

  const tieneArgumentoPendiente = Boolean(estado.participantes[participantId]?.argumentoPendienteId);
  const [retenida, setRetenida] = useState(false);

  useEffect(() => {
    if (oferta.modo === 'verbal' && tieneArgumentoPendiente) {
      setRetenida(true);
      const timeoutId = setTimeout(() => setRetenida(false), 1500);
      return () => clearTimeout(timeoutId);
    }
    setRetenida(false);
    return undefined;
  }, [oferta.turnId, oferta.modo, tieneArgumentoPendiente]);

  const referenciaDeLaTarjeta = useAtencionDelTurno(!retenida, '🎙️ ¡Es tu turno! Acepta o rechaza');

  const esVerbal = oferta.modo === 'verbal';
  const penalidad = calcularPenalidadPorRechazoDeTurno(resolverParametrosDePuntaje(programa));

  if (retenida) {
    return null;
  }

  function aceptar() {
    publicar(EVENTOS.TURNO_ACEPTADO, { turnId: oferta.turnId, participantId });
  }

  function rechazar() {
    const totalRechazosDelParticipante = (estado.participantes[participantId]?.rechazosAcumulados ?? 0) + 1;
    publicar(EVENTOS.TURNO_RECHAZADO, { turnId: oferta.turnId, participantId, totalRechazosDelParticipante });
  }

  return (
    <section
      className="tarjeta-de-turno-ofrecido tarjeta-de-accion-del-turno"
      ref={referenciaDeLaTarjeta}
      role="alert"
    >
      <p className="etiqueta-de-accion-del-turno">🎙️ ¡Es tu turno de hablar!</p>
      {esVerbal ? (
        <p className="texto-de-ayuda">
          No queda ningún argumento escrito por exponer y todavía no has tomado la palabra. Puedes intervenir
          hablando, sin argumento escrito: vale menos puntos y un co-moderador califica lo que digas.
        </p>
      ) : (
        <p className="texto-de-ayuda">
          Acepta para exponer en voz alta tu argumento, que ya está en el mapa y ya te dio puntos. Los
          co-moderadores califican cómo lo expones: exponerlo bien puede sumarte más. No tienes que escribir nada
          ahora.
        </p>
      )}
      <p className="texto-de-ayuda">
        {esVerbal
          ? `Si rechazas, pierdes ${Math.abs(penalidad)} puntos.`
          : `Si rechazas, pierdes ${Math.abs(penalidad)} puntos de los que ya ganaste con ese argumento.`}
      </p>
      {/* Barra fija al borde inferior: se ve aunque la persona haya hecho scroll (docs/12). */}
      <div className="barra-de-accion-fija">
        <div className="barra-de-accion-fija__encabezado">
          <span>🎙️ ¡Tu turno!</span>
          <span className={`cuenta-regresiva-en-barra${segundosRestantes <= 5 ? ' cuenta-regresiva--urgente' : ''}`}>
            {segundosRestantes}s
          </span>
        </div>
        <button type="button" className="boton-accion-principal" onClick={aceptar}>
          {esVerbal ? 'Aceptar e intervenir' : 'Aceptar y defender mi argumento'}
        </button>
        <button type="button" className="boton-accion-rechazo" onClick={rechazar}>
          Rechazar ({penalidad} pts)
        </button>
      </div>
    </section>
  );
}
