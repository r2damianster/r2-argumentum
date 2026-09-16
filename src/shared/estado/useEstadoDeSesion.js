// Hook compartido por host y player: conecta al canal de Ably de la sesión,
// reconstruye el estado completo desde el historial (event sourcing puro,
// ver docs/09-modelo-de-eventos.md) y expone una función para publicar eventos nuevos.

import { useEffect, useRef, useState } from 'react';
import { obtenerClienteAbly, obtenerCanalDeDebate } from '../ably/clienteAbly.js';
import { estadoInicial, reducirEventos } from './reducirEventos.js';

// datosDePresencia: null para el host (no es un participante, solo observa presence),
// o { nombre, emoji } para player/co-moderador (entra a presence con ese payload).
export function useEstadoDeSesion({ clientId, sessionId, datosDePresencia = null }) {
  const [estado, setEstado] = useState(estadoInicial());
  const [eventos, setEventos] = useState([]);
  const [presencia, setPresencia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const canalRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    const idsProcesados = new Set();
    let backfillCompleto = false;
    const colaDeMensajesEnVivo = [];

    const cliente = obtenerClienteAbly(clientId);
    const canal = obtenerCanalDeDebate('sala', sessionId);
    canalRef.current = canal;

    function procesarMensaje(mensaje) {
      if (idsProcesados.has(mensaje.id)) {
        return;
      }
      idsProcesados.add(mensaje.id);
      setEventos((eventosPrevios) => [...eventosPrevios, { name: mensaje.name, data: mensaje.data, timestamp: mensaje.timestamp, clientId: mensaje.clientId }]);
      setEstado((estadoPrevio) => reducirEventos(estadoPrevio, { name: mensaje.name, data: mensaje.data }));
    }

    function manejarMensajeEnVivo(mensaje) {
      if (!backfillCompleto) {
        colaDeMensajesEnVivo.push(mensaje);
        return;
      }
      procesarMensaje(mensaje);
    }

    function manejarPresencia(mensajeDePresencia) {
      const participantId = mensajeDePresencia.clientId;
      setPresencia((presenciaPrevia) => {
        if (mensajeDePresencia.action === 'leave' || mensajeDePresencia.action === 'absent') {
          return presenciaPrevia.filter((presente) => presente.participantId !== participantId);
        }
        const datos = mensajeDePresencia.data || {};
        const entrada = { participantId, nombre: datos.nombre, emoji: datos.emoji };
        const sinElParticipante = presenciaPrevia.filter((presente) => presente.participantId !== participantId);
        return [...sinElParticipante, entrada];
      });
    }

    async function conectar() {
      await canal.attach();
      canal.subscribe(manejarMensajeEnVivo);

      let pagina = await canal.history({ untilAttach: true, direction: 'forwards' });
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (const mensaje of pagina.items) {
          procesarMensaje(mensaje);
        }
        if (!pagina.hasNext()) {
          break;
        }
        pagina = await pagina.next();
      }

      backfillCompleto = true;
      for (const mensaje of colaDeMensajesEnVivo) {
        procesarMensaje(mensaje);
      }

      const miembrosActuales = await canal.presence.get();
      if (!cancelado) {
        setPresencia(
          miembrosActuales.map((miembro) => ({
            participantId: miembro.clientId,
            nombre: miembro.data?.nombre,
            emoji: miembro.data?.emoji,
          }))
        );
      }
      canal.presence.subscribe(manejarPresencia);

      if (datosDePresencia) {
        await canal.presence.enter(datosDePresencia);
      }

      if (!cancelado) {
        setCargando(false);
      }
    }

    conectar();

    return () => {
      cancelado = true;
      canal.presence.unsubscribe(manejarPresencia);
      canal.unsubscribe(manejarMensajeEnVivo);
      if (datosDePresencia) {
        canal.presence.leave().catch(() => {});
      }
    };
  }, [clientId, sessionId]);

  function publicar(nombreDeEvento, payload) {
    if (!canalRef.current) {
      return Promise.resolve();
    }
    return canalRef.current.publish(nombreDeEvento, { timestamp: Date.now(), ...payload });
  }

  return { estado, eventos, presencia, publicar, cargando };
}
