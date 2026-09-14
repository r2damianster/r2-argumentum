import Ably from 'ably';

export default async function handler(request, response) {
  if (!process.env.ABLY_API_KEY) {
    response.status(500).json({ error: 'ABLY_API_KEY no configurada en el entorno' });
    return;
  }

  const clientId = request.query.clientId || `anon-${Math.random().toString(36).slice(2)}`;
  const clienteAbly = new Ably.Rest(process.env.ABLY_API_KEY);

  try {
    const solicitudDeToken = await clienteAbly.auth.createTokenRequest({ clientId });
    response.status(200).json(solicitudDeToken);
  } catch (error) {
    response.status(500).json({ error: 'No se pudo generar el token de Ably' });
  }
}
