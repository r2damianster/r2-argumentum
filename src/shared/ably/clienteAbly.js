import * as Ably from 'ably';

let clienteAbly = null;

// Autenticación por token vía /api/ably-token — el navegador nunca ve la API key real.
// Ver docs/07-acceso-y-paginas.md.
export function obtenerClienteAbly(clientId) {
  if (clienteAbly) {
    return clienteAbly;
  }

  clienteAbly = new Ably.Realtime({
    authUrl: '/api/ably-token',
    authParams: { clientId },
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
