import { credencialesDelHostSonValidas, firmarSesionDelHost } from './_sesionDelHost.js';

const ESPERA_TRAS_CLAVE_INCORRECTA_MS = 700;

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Usa POST' });
    return;
  }

  const usuarioEsperado = process.env.HOST_USER;
  const claveEsperada = process.env.HOST_PASSWORD;
  if (!usuarioEsperado || !claveEsperada) {
    response.status(503).json({ error: 'HOST_USER / HOST_PASSWORD no están configuradas en el entorno' });
    return;
  }

  const { usuario, clave } = request.body ?? {};
  if (!credencialesDelHostSonValidas({ usuario, clave }, { usuarioEsperado, claveEsperada })) {
    // Una pausa corta frena los intentos de adivinar la clave a fuerza bruta.
    await esperar(ESPERA_TRAS_CLAVE_INCORRECTA_MS);
    response.status(401).json({ error: 'Usuario o clave incorrectos' });
    return;
  }

  response.status(200).json(firmarSesionDelHost(claveEsperada));
}
