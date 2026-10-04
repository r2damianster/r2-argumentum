// Identidad inviolable de un participante (lado del navegador). La derivación debe ser idéntica a la de
// api/_identidadDelParticipante.js (la carpeta api/ no importa código del cliente, por eso se repite).
//
// clientId = «p-» + 32 primeros caracteres hexadecimales de SHA-256(secreto). El secreto es aleatorio, se
// guarda solo en el navegador de quien ingresa y se envía únicamente al pedir el token de Ably.

export const NOMBRE_DE_LA_CABECERA_DEL_SECRETO = 'x-secreto-del-participante';

function aHexadecimal(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generarSecretoAleatorio() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  // Solo letras, números, guion y guion bajo: viaja en una cabecera.
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function derivarClientIdDelSecreto(secreto) {
  const huella = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secreto));
  return `p-${aHexadecimal(huella).slice(0, 32)}`;
}

export async function crearIdentidadSegura() {
  const secreto = generarSecretoAleatorio();
  return { participantId: await derivarClientIdDelSecreto(secreto), secreto };
}
