import Ably from 'ably';
import { esClientIdValido } from './_clienteIdValido.js';
import { sesionDelHostEsValida } from './_sesionDelHost.js';

// La clave de Ably solo puede operar en los canales del debate: aunque alguien obtenga un token,
// no lo puede usar en otros canales de la cuenta.
//
// Hay dos tipos de canal (ver docs/13-foro-escrito-y-nucleo-reutilizable.md):
//   debate:sala:{código}        el de la sesión: lo leen y escriben todos
//   debate:integridad:{código}  las señales de integridad: los participantes solo pueden PUBLICAR;
//                               leerlas (suscribirse o pedir el historial) es exclusivo del host. Así
//                               una marca de «texto pegado» no la puede leer un compañero con las
//                               herramientas del navegador.
const CAPACIDAD_DE_LOS_PARTICIPANTES = {
  'debate:sala:*': ['publish', 'subscribe', 'presence', 'history'],
  'debate:integridad:*': ['publish'],
};
const CAPACIDAD_DEL_HOST = {
  'debate:sala:*': ['publish', 'subscribe', 'presence', 'history'],
  'debate:integridad:*': ['publish', 'subscribe', 'history'],
};

export function capacidadSegunLaIdentidad(clientId) {
  return clientId === 'host' ? CAPACIDAD_DEL_HOST : CAPACIDAD_DE_LOS_PARTICIPANTES;
}

export default async function handler(request, response) {
  if (!process.env.ABLY_API_KEY) {
    response.status(500).json({ error: 'ABLY_API_KEY no configurada en el entorno' });
    return;
  }

  const clientIdSolicitado = request.query.clientId;
  if (clientIdSolicitado !== undefined && !esClientIdValido(clientIdSolicitado)) {
    response.status(400).json({ error: 'clientId inválido' });
    return;
  }

  // "host" es la identidad autoritativa del debate (corre el motor): solo se entrega con la
  // sesión del moderador iniciada en /api/host-login. Los participantes usan su propio id.
  if (clientIdSolicitado === 'host' && !sesionDelHostEsValida(request.query.hostToken, process.env.HOST_PASSWORD)) {
    response.status(401).json({ error: 'Inicia sesión como moderador para usar la identidad de host' });
    return;
  }

  const clientId = clientIdSolicitado || `anon-${Math.random().toString(36).slice(2)}`;
  const clienteAbly = new Ably.Rest(process.env.ABLY_API_KEY);

  try {
    const solicitudDeToken = await clienteAbly.auth.createTokenRequest({
      clientId,
      capability: JSON.stringify(capacidadSegunLaIdentidad(clientId)),
    });
    response.status(200).json(solicitudDeToken);
  } catch (error) {
    response.status(500).json({ error: 'No se pudo generar el token de Ably' });
  }
}
