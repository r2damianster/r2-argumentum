import * as Ably from 'ably';
import { leerSesionDelHost } from './sesionDelHost.js';
import { publicarConReintentos } from './reintentarPublicacion.js';
import { NOMBRE_DE_LA_CABECERA_DEL_SECRETO } from './identidadDelParticipante.js';
import {
  nombreDelCanalDeDevolucion,
  nombreDelCanalDeEntregas,
  nombreDelCanalDelDocente,
} from '../nucleo/entregas/canalesPrivados.js';

let clienteAbly = null;

// Autenticación por token vía /api/ably-token — el navegador nunca ve la API key real.
// Ver docs/07-acceso-y-paginas.md.
// Los participantes prueban que su identidad es suya con un secreto (ver identidadDelParticipante.js); el
// host, con su sesión firmada. Ambos viajan solo al pedir el token, nunca por un canal.
const secretosPorClientId = new Map();

export function registrarSecretoDelParticipante(clientId, secreto) {
  if (clientId && secreto) {
    secretosPorClientId.set(clientId, secreto);
  }
}

function opcionesDeAutenticacion(clientId) {
  if (clientId === 'host') {
    return { authUrl: '/api/ably-token', authParams: { clientId, hostToken: leerSesionDelHost()?.token ?? '' } };
  }
  return {
    authUrl: '/api/ably-token',
    authParams: { clientId },
    authHeaders: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: secretosPorClientId.get(clientId) ?? '' },
  };
}

export function obtenerClienteAbly(clientId, secreto = null) {
  if (clienteAbly) {
    return clienteAbly;
  }
  registrarSecretoDelParticipante(clientId, secreto);
  clienteAbly = new Ably.Realtime(opcionesDeAutenticacion(clientId));
  return clienteAbly;
}

export function obtenerCanalDeDebate(programId, sessionId) {
  const clientePorDefecto = clienteAbly;
  if (!clientePorDefecto) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clientePorDefecto.channels.get(`debate:${programId}:${sessionId}`);
}

// --- Canal privado de integridad (ver docs/13-foro-escrito-y-nucleo-reutilizable.md) ---
//
// Los participantes solo tienen permiso de PUBLICAR en este canal (api/ably-token.js): no pueden
// suscribirse ni pedir el historial. Por eso publican por REST (una petición HTTP puntual con su
// token) y no con la conexión en tiempo real, que intentaría engancharse al canal y sería rechazada.
const clientesRest = new Map();

function obtenerClienteRestAbly(clientId) {
  if (!clientesRest.has(clientId)) {
    clientesRest.set(clientId, new Ably.Rest(opcionesDeAutenticacion(clientId)));
  }
  return clientesRest.get(clientId);
}

export function nombreDelCanalDeIntegridad(sessionId) {
  return `debate:integridad:${sessionId}`;
}

export async function publicarEnElCanalDeIntegridad(sessionId, clientId, nombreDelEvento, carga) {
  await publicarConReintentos(() =>
    obtenerClienteRestAbly(clientId).channels.get(nombreDelCanalDeIntegridad(sessionId)).publish(nombreDelEvento, carga)
  );
}

// Solo el host puede leerlo: con la conexión de un participante el servidor de Ably rechaza el enganche.
export function obtenerCanalDeIntegridad(sessionId) {
  if (!clienteAbly) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clienteAbly.channels.get(nombreDelCanalDeIntegridad(sessionId));
}

// --- Canales privados del control de lectura (ver docs/14-control-de-lectura.md) ---
//
// Nombres y reglas de cada canal: nucleo/entregas/canalesPrivados.js. Permisos: api/ably-token.js.

// Las entregas, igual que las señales de integridad, solo se PUBLICAN (por REST, con el token de quien
// escribe); leerlas es exclusivo del host.
export async function publicarEnElCanalDeEntregas(sessionId, clientId, nombreDelEvento, carga) {
  await publicarConReintentos(() =>
    obtenerClienteRestAbly(clientId).channels.get(nombreDelCanalDeEntregas(sessionId)).publish(nombreDelEvento, carga)
  );
}

export function obtenerCanalDeEntregas(sessionId) {
  if (!clienteAbly) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clienteAbly.channels.get(nombreDelCanalDeEntregas(sessionId));
}

export function obtenerCanalDelDocente(sessionId) {
  if (!clienteAbly) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clienteAbly.channels.get(nombreDelCanalDelDocente(sessionId));
}

// La devolución de una persona: la lee solo ella (su token solo abre su propio canal).
export function obtenerCanalDeDevolucionDeMiCliente(clientId, sessionId) {
  if (!clienteAbly) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clienteAbly.channels.get(nombreDelCanalDeDevolucion(clientId, sessionId));
}

// El host publica en el canal de cada estudiante por REST: no necesita enganchar 40 canales.
let clienteRestDelHost = null;

export async function publicarDevolucionDelHost(sessionId, participantId, nombreDelEvento, carga) {
  if (!clienteRestDelHost) {
    clienteRestDelHost = new Ably.Rest(opcionesDeAutenticacion('host'));
  }
  await publicarConReintentos(() =>
    clienteRestDelHost.channels.get(nombreDelCanalDeDevolucion(participantId, sessionId)).publish(nombreDelEvento, carga)
  );
}
