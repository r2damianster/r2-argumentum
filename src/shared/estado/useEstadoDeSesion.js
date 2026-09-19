// Hook compartido por host y player: conecta al canal de Ably de la sesión,
// reconstruye el estado completo desde el historial (event sourcing puro,
// ver docs/09-modelo-de-eventos.md) y expone una función para publicar eventos nuevos.

import { useEffect, useRef, useState } from 'react';
import { obtenerClienteAbly, obtenerCanalDeDebate } from '../ably/clienteAbly.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { borrarInstantanea, guardarInstantanea, leerInstantanea } from './instantaneaLocal.js';

// El canal de Ably se llama solo con el código de sala de 4 dígitos, que se puede repetir
// entre debates. Sin este filtro, el historial trae también los eventos de sesiones previas
// que usaron el mismo código: nodos fantasma en el grafo, comod.selected apuntando a gente
// que ya no está, puntajes heredados. Bug real, reportado en prueba con 3 participantes.
//
// Cada sesión marca sus `programa.publicado` con un identificadorDeSesion propio (el host lo
// republica al elegir posturas, por eso puede haber más de uno por sesión). Se toma el
// identificador del último y se descarta todo lo anterior a su primera aparición.
export function mensajesDeLaSesionVigente(mensajesEnOrdenCronologico) {
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

export const ESTADOS_DE_CONEXION = {
  CONECTANDO: 'conectando',
  EN_LINEA: 'en_linea',
  RECONECTANDO: 'reconectando',
  RECUPERANDO: 'recuperando',
};

const MILISEGUNDOS_ENTRE_GUARDADOS = 1000;

// datosDePresencia: null para el host (no es un participante, solo observa presence),
// o { nombre, emoji } para player/co-moderador (entra a presence con ese payload).
export function useEstadoDeSesion({ clientId, sessionId, datosDePresencia = null }) {
  // Se arranca de la copia local si la hay: un F5 o una pestaña cerrada por accidente ya no
  // dependen de que el historial de Ably siga vivo (ver instantaneaLocal.js).
  const [instantaneaDeArranque] = useState(() => leerInstantanea(sessionId));
  const [estado, setEstado] = useState(() => instantaneaDeArranque?.estado ?? estadoInicial());
  const [eventos, setEventos] = useState(() => instantaneaDeArranque?.eventos ?? []);
  const [presencia, setPresencia] = useState([]);
  const [cargando, setCargando] = useState(true);
  // `huecoEnElHistorial` se pega una vez que aparece: significa que hubo eventos que este
  // cliente no vio y que ya no se pueden recuperar (Ably retiene el historial unos minutos).
  const [conexion, setConexion] = useState({
    estado: ESTADOS_DE_CONEXION.CONECTANDO,
    huecoEnElHistorial: false,
  });
  const canalRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    const idsProcesados = new Set(instantaneaDeArranque?.idsProcesados ?? []);
    const colaDeMensajesEnVivo = [];
    let recuperandoHistorial = true;
    let ultimoTimestampProcesado = instantaneaDeArranque?.ultimoTimestampProcesado ?? 0;
    let inicioDeLaSesionVigente = instantaneaDeArranque?.inicioDeLaSesionVigente ?? 0;
    let laConexionSeCayo = false;

    // Espejos locales de lo que ya se aplicó: sirven para guardar la copia local sin tener que
    // leer el estado de React desde dentro del efecto.
    let estadoLocal = instantaneaDeArranque?.estado ?? estadoInicial();
    let eventosLocales = instantaneaDeArranque?.eventos ?? [];
    let guardadoPendiente = null;

    function guardarCopiaLocal() {
      guardadoPendiente = null;
      guardarInstantanea(sessionId, {
        estado: estadoLocal,
        eventos: eventosLocales,
        idsProcesados: [...idsProcesados],
        ultimoTimestampProcesado,
        inicioDeLaSesionVigente,
      });
    }

    function programarGuardadoDeCopiaLocal() {
      if (guardadoPendiente) {
        return;
      }
      guardadoPendiente = setTimeout(guardarCopiaLocal, MILISEGUNDOS_ENTRE_GUARDADOS);
    }

    const cliente = obtenerClienteAbly(clientId);
    const canal = obtenerCanalDeDebate('sala', sessionId);
    canalRef.current = canal;

    function procesarMensaje(mensaje) {
      if (idsProcesados.has(mensaje.id)) {
        return;
      }
      idsProcesados.add(mensaje.id);
      ultimoTimestampProcesado = Math.max(ultimoTimestampProcesado, mensaje.timestamp ?? 0);
      eventosLocales = [
        ...eventosLocales,
        { name: mensaje.name, data: mensaje.data, timestamp: mensaje.timestamp, clientId: mensaje.clientId },
      ];
      estadoLocal = reducirEventos(estadoLocal, { name: mensaje.name, data: mensaje.data });
      setEventos(eventosLocales);
      setEstado(estadoLocal);
      programarGuardadoDeCopiaLocal();
    }

    // Una sala nueva puede caer en el mismo código de 4 dígitos que una anterior. Si el
    // historial dice que el debate en curso es otro, la copia local es de un debate viejo y
    // hay que tirarla entera en vez de mezclar dos sesiones.
    function descartarCopiaLocalDeOtraSesion(identificadorDelHistorial) {
      const identificadorDeLaCopia = estadoLocal.sesion?.identificador;
      if (!identificadorDelHistorial || !identificadorDeLaCopia) {
        return false;
      }
      if (identificadorDelHistorial === identificadorDeLaCopia) {
        return false;
      }
      idsProcesados.clear();
      ultimoTimestampProcesado = 0;
      inicioDeLaSesionVigente = 0;
      estadoLocal = estadoInicial();
      eventosLocales = [];
      setEstado(estadoLocal);
      setEventos(eventosLocales);
      borrarInstantanea(sessionId);
      return true;
    }

    function manejarMensajeEnVivo(mensaje) {
      if (recuperandoHistorial) {
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

    // Ably solo permite untilAttach con la dirección por defecto (backwards, más reciente
    // primero) — se junta todo y se invierte al final para procesar en orden cronológico.
    async function traerHistorialCompleto() {
      let pagina = await canal.history({ untilAttach: true });
      const mensajes = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        mensajes.push(...pagina.items);
        if (!pagina.hasNext()) {
          break;
        }
        pagina = await pagina.next();
      }
      mensajes.reverse();
      return mensajes;
    }

    // Reconstruye desde el historial del canal. Se usa al conectar y también al volver de una
    // caída: los mensajes ya procesados se descartan por id, así que esto solo rellena lo que
    // falta y nunca pisa lo que el cliente ya tiene en memoria.
    async function reconstruirDesdeElHistorial({ esLaPrimeraVez }) {
      recuperandoHistorial = true;
      const mensajes = await traerHistorialCompleto();

      if (esLaPrimeraVez) {
        const ultimoPrograma = [...mensajes]
          .reverse()
          .find((mensaje) => mensaje.name === EVENTOS.PROGRAMA_PUBLICADO);
        descartarCopiaLocalDeOtraSesion(ultimoPrograma?.data?.identificadorDeSesion);
      }

      const mensajesDeLaSesion = esLaPrimeraVez
        ? mensajesDeLaSesionVigente(mensajes)
        : // Al reconectar NO se vuelve a cortar por identificadorDeSesion: si el historial ya
          // no alcanza a incluir el `programa.publicado` de esta sesión, el corte no se puede
          // calcular y se colarían eventos de un debate anterior con el mismo código de sala.
          // Se filtra por el momento en que arrancó esta sesión, que ya conocemos.
          mensajes.filter((mensaje) => (mensaje.timestamp ?? 0) >= inicioDeLaSesionVigente);

      if (esLaPrimeraVez && mensajesDeLaSesion.length > 0 && inicioDeLaSesionVigente === 0) {
        inicioDeLaSesionVigente = mensajesDeLaSesion[0].timestamp ?? 0;
      }

      // Si lo más viejo que quedó en el historial es posterior a lo último que procesamos, en
      // el medio pasaron cosas que ya nadie puede recuperar: el estado de este cliente quedó
      // incompleto y hay que decirlo en pantalla en vez de seguir como si nada.
      const huboHueco =
        mensajesDeLaSesion.length > 0 &&
        ultimoTimestampProcesado > 0 &&
        (mensajesDeLaSesion[0].timestamp ?? 0) > ultimoTimestampProcesado;

      for (const mensaje of mensajesDeLaSesion) {
        procesarMensaje(mensaje);
      }

      recuperandoHistorial = false;
      while (colaDeMensajesEnVivo.length > 0) {
        procesarMensaje(colaDeMensajesEnVivo.shift());
      }
      guardarCopiaLocal();

      return huboHueco;
    }

    async function refrescarPresencia() {
      const miembrosActuales = await canal.presence.get();
      if (cancelado) {
        return;
      }
      setPresencia((presenciaPrevia) => {
        const conectadosAhora = new Set(miembrosActuales.map((miembro) => miembro.clientId));
        const yaDesconectados = presenciaPrevia
          .filter((presente) => !conectadosAhora.has(presente.participantId))
          .map((presente) => ({ ...presente, conectado: false }));
        return [
          ...yaDesconectados,
          ...miembrosActuales.map((miembro) => ({
            participantId: miembro.clientId,
            nombre: miembro.data?.nombre,
            emoji: miembro.data?.emoji,
            conectado: true,
          })),
        ];
      });
    }

    // Vuelta de una caída de conexión. Ably reenvía lo perdido solo si la reconexión ocurre
    // dentro de su ventana de recuperación (~2 minutos); más allá de eso vuelve a engancharse
    // y sigue entregando lo nuevo SIN avisar que hubo un hueco. Un celular bloqueado un rato
    // en medio de la clase entra justo en ese caso: sin esto, ese estudiante seguía el debate
    // con menos nodos y menos puntos que el resto, y en silencio. Bug real reportado en aula.
    async function recuperarDespuesDeUnaCaida() {
      setConexion((previa) => ({ ...previa, estado: ESTADOS_DE_CONEXION.RECUPERANDO }));
      try {
        await canal.attach();
        const huboHueco = await reconstruirDesdeElHistorial({ esLaPrimeraVez: false });
        await refrescarPresencia();
        if (!cancelado) {
          setConexion((previa) => ({
            estado: ESTADOS_DE_CONEXION.EN_LINEA,
            huecoEnElHistorial: previa.huecoEnElHistorial || huboHueco,
          }));
        }
      } catch (error) {
        console.error('[r2-argumentum] no se pudo recuperar tras la reconexión', error);
        recuperandoHistorial = false;
        if (!cancelado) {
          setConexion((previa) => ({ ...previa, estado: ESTADOS_DE_CONEXION.EN_LINEA, huecoEnElHistorial: true }));
        }
      }
    }

    function manejarCambioDeConexion(cambio) {
      if (cancelado) {
        return;
      }
      if (cambio.current === 'connected') {
        if (laConexionSeCayo) {
          laConexionSeCayo = false;
          recuperarDespuesDeUnaCaida();
        }
        return;
      }
      if (cambio.current === 'disconnected' || cambio.current === 'suspended') {
        laConexionSeCayo = true;
        setConexion((previa) => ({ ...previa, estado: ESTADOS_DE_CONEXION.RECONECTANDO }));
      }
    }

    async function conectar() {
      await canal.attach();
      canal.subscribe(manejarMensajeEnVivo);
      cliente.connection.on(manejarCambioDeConexion);

      await reconstruirDesdeElHistorial({ esLaPrimeraVez: true });

      await refrescarPresencia();
      canal.presence.subscribe(manejarPresencia);

      // `datosDePresencia` en null significa "solo observo" (el host: nunca entra a presence).
      // El participante entra apenas se conecta — el requisito de ingreso con argumento (ver
      // reglasDeIngreso.js) NO depende de estar o no en presence, depende de `ingresoConfirmado`
      // en el reducer. Entrar antes de confirmar es justamente lo que le permite al host ver
      // en "Todavía escribiendo su argumento de ingreso" y en el panel de avisos quién está en
      // la sala pero no terminó — con presence diferida, esas personas eran invisibles del
      // todo: nunca aparecían en `presencia`, así que ninguna lista podía mostrarlas. Bug real
      // reportado en prueba en vivo.
      if (datosDePresencia) {
        await canal.presence.enter(datosDePresencia);
      }

      if (!cancelado) {
        setConexion((previa) => ({ ...previa, estado: ESTADOS_DE_CONEXION.EN_LINEA }));
        setCargando(false);
      }
    }

    conectar().catch((error) => {
      console.error('[r2-argumentum] error conectando a la sesión', error);
    });

    return () => {
      cancelado = true;
      if (guardadoPendiente) {
        clearTimeout(guardadoPendiente);
      }
      guardarCopiaLocal();
      cliente.connection.off(manejarCambioDeConexion);
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

  return { estado, eventos, presencia, publicar, cargando, conexion };
}
