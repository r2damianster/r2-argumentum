// Hook compartido por host y player: conecta al canal de Ably de la sesión,
// reconstruye el estado completo desde el historial (event sourcing puro,
// ver docs/09-modelo-de-eventos.md) y expone una función para publicar eventos nuevos.

import { useEffect, useRef, useState } from 'react';
import { obtenerClienteAbly, obtenerCanalDeDebate } from '../ably/clienteAbly.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { estadoInicial, reducirEventos } from './reducirEventos.js';

// El canal de Ably se llama solo con el código de sala de 4 dígitos, que se puede repetir
// entre debates. Sin este filtro, el historial trae también los eventos de sesiones previas
// que usaron el mismo código: nodos fantasma en el grafo, comod.selected apuntando a gente
// que ya no está, puntajes heredados. Bug real, reportado en prueba con 3 participantes.
//
// Cada sesión marca sus `programa.publicado` con un identificadorDeSesion propio (el host lo
// republica al elegir posturas, por eso puede haber más de uno por sesión). Se toma el
// identificador del último y se descarta todo lo anterior a su primera aparición.
function mensajesDeLaSesionVigente(mensajesEnOrdenCronologico) {
  const publicacionesDePrograma = mensajesEnOrdenCronologico.filter(
    (mensaje) => mensaje.name === EVENTOS.PROGRAMA_PUBLICADO
  );
  if (publicacionesDePrograma.length === 0) {
    return mensajesEnOrdenCronologico;
  }

  const identificadorVigente = publicacionesDePrograma[publicacionesDePrograma.length - 1].data?.identificadorDeSesion;
  const indiceDeInicio = identificadorVigente
    ? mensajesEnOrdenCronologico.findIndex(
        (mensaje) =>
          mensaje.name === EVENTOS.PROGRAMA_PUBLICADO &&
          mensaje.data?.identificadorDeSesion === identificadorVigente
      )
    : // Sesión publicada por una versión anterior, sin identificador: el mejor corte posible
      // es el último programa.publicado del historial.
      mensajesEnOrdenCronologico.lastIndexOf(publicacionesDePrograma[publicacionesDePrograma.length - 1]);

  return indiceDeInicio > 0 ? mensajesEnOrdenCronologico.slice(indiceDeInicio) : mensajesEnOrdenCronologico;
}

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
        const entradaPrevia = presenciaPrevia.find((presente) => presente.participantId === participantId);
        const sinElParticipante = presenciaPrevia.filter((presente) => presente.participantId !== participantId);

        // Nunca se borra del roster, solo se marca desconectado — bug real confirmado en
        // prueba con 11 participantes: al desconectarse un momento, el nombre desaparecía
        // de presencia y el grafo/ranking mostraban el ID técnico en su lugar en todos los
        // demás clientes hasta que volvía a entrar. El nombre debe sobrevivir a un blip.
        if (mensajeDePresencia.action === 'leave' || mensajeDePresencia.action === 'absent') {
          if (!entradaPrevia) {
            return presenciaPrevia;
          }
          return [...sinElParticipante, { ...entradaPrevia, conectado: false }];
        }

        const datos = mensajeDePresencia.data || {};
        const entrada = {
          participantId,
          nombre: datos.nombre ?? entradaPrevia?.nombre,
          emoji: datos.emoji ?? entradaPrevia?.emoji,
          conectado: true,
        };
        return [...sinElParticipante, entrada];
      });
    }

    async function conectar() {
      await canal.attach();
      canal.subscribe(manejarMensajeEnVivo);

      // Ably solo permite untilAttach con la dirección por defecto (backwards, más reciente
      // primero) — se junta todo y se invierte al final para procesar en orden cronológico.
      let pagina = await canal.history({ untilAttach: true });
      const mensajesDelHistorial = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        mensajesDelHistorial.push(...pagina.items);
        if (!pagina.hasNext()) {
          break;
        }
        pagina = await pagina.next();
      }
      mensajesDelHistorial.reverse();
      for (const mensaje of mensajesDeLaSesionVigente(mensajesDelHistorial)) {
        procesarMensaje(mensaje);
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
            conectado: true,
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

    conectar().catch((error) => {
      console.error('[r2-argumentum] error conectando a la sesión', error);
    });

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
