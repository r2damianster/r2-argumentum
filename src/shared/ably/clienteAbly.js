import * as Ably from 'ably';
import { leerSesionDelHost } from './sesionDelHost.js';

let clienteAbly = null;

// Autenticación por token vía /api/ably-token — el navegador nunca ve la API key real.
// Ver docs/07-acceso-y-paginas.md.
export function obtenerClienteAbly(clientId) {
  if (clienteAbly) {
    return clienteAbly;
  }

  clienteAbly = new Ably.Realtime({
    authUrl: '/api/ably-token',
    // La identidad "host" exige la sesión firmada del moderador; los participantes no la usan.
    authParams: clientId === 'host' ? { clientId, hostToken: leerSesionDelHost()?.token ?? '' } : { clientId },
  });

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
    clientesRest.set(clientId, new Ably.Rest({ authUrl: '/api/ably-token', authParams: { clientId } }));
  }
  return clientesRest.get(clientId);
}

export function nombreDelCanalDeIntegridad(sessionId) {
  return `debate:integridad:${sessionId}`;
}

export async function publicarEnElCanalDeIntegridad(sessionId, clientId, nombreDelEvento, carga) {
  await obtenerClienteRestAbly(clientId).channels.get(nombreDelCanalDeIntegridad(sessionId)).publish(nombreDelEvento, carga);
}

// Solo el host puede leerlo: con la conexión de un participante el servidor de Ably rechaza el enganche.
export function obtenerCanalDeIntegridad(sessionId) {
  if (!clienteAbly) {
    throw new Error('Debes llamar a obtenerClienteAbly() antes de pedir un canal.');
  }
  return clienteAbly.channels.get(nombreDelCanalDeIntegridad(sessionId));
}
