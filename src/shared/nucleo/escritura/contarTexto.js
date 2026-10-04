// Conteos de un texto escrito — ver docs/14-control-de-lectura.md. La app solo cuenta: no restringe
// nada de lo que cada persona escribe.

import { contarPalabras } from '../../argumentos/contarPalabras.js';

export { contarPalabras };

// Un párrafo es un bloque de texto separado por saltos de línea. En el celular quien escribe suele
// pulsar «intro» una sola vez entre párrafos, así que no se exige una línea en blanco.
export function dividirEnParrafos(texto) {
  return String(texto ?? '')
    .split(/\r?\n+/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo.length > 0);
}

export function contarParrafos(texto) {
  return dividirEnParrafos(texto).length;
}

export function resumirTexto(texto) {
  return { palabras: contarPalabras(texto), parrafos: contarParrafos(texto) };
}
