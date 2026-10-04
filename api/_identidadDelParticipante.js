// Identidad inviolable de un participante, sin base de datos.
//
// Antes cualquiera podía pedir un token de Ably con el clientId de otra persona (se ve en presencia) y
// así leer su devolución o entregar a su nombre. Ahora el clientId se DERIVA de un secreto que solo
// conoce su dueño: clientId = «p-» + primeros 32 caracteres hexadecimales de SHA-256(secreto). El
// secreto se genera en el navegador al ingresar y viaja solo en una cabecera al pedir el token; el
// clientId (público) no permite deducirlo. El servidor no guarda nada: recalcula y compara.
//
// src/shared/ably/identidadDelParticipante.js repite la derivación del lado del navegador.

import { createHash } from 'node:crypto';

export const PREFIJO_DEL_CLIENT_ID_SEGURO = 'p-';
export const NOMBRE_DE_LA_CABECERA_DEL_SECRETO = 'x-secreto-del-participante';
const LONGITUD_DE_LA_HUELLA = 32;
const FORMATO_DEL_SECRETO = /^[A-Za-z0-9_-]{32,128}$/;

export function derivarClientIdDelSecreto(secreto) {
  const huella = createHash('sha256').update(String(secreto)).digest('hex').slice(0, LONGITUD_DE_LA_HUELLA);
  return `${PREFIJO_DEL_CLIENT_ID_SEGURO}${huella}`;
}

export function secretoCorrespondeAlClientId(secreto, clientId) {
  return typeof secreto === 'string' && FORMATO_DEL_SECRETO.test(secreto) && derivarClientIdDelSecreto(secreto) === clientId;
}
