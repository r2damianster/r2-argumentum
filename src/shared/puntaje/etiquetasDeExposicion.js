// Cómo se nombran en pantalla las calificaciones de una exposición oral (co-moderadores y host).
// La lógica de puntaje vive en evaluacionDeExposiciones.js; aquí solo el texto.

import { CALIDADES_DE_EXPOSICION } from '../eventos/nombresDeEventos.js';

// Orden de los botones: de mejor a peor, y al final «no está hablando».
export const CALIDADES_EN_ORDEN_DE_BOTONES = [
  CALIDADES_DE_EXPOSICION.BUENA,
  CALIDADES_DE_EXPOSICION.ACEPTABLE,
  CALIDADES_DE_EXPOSICION.INSUFICIENTE,
  CALIDADES_DE_EXPOSICION.SIN_EXPOSICION,
];

export const ETIQUETA_DE_CALIDAD_DE_EXPOSICION = {
  [CALIDADES_DE_EXPOSICION.BUENA]: 'Coherente con el punto',
  [CALIDADES_DE_EXPOSICION.ACEPTABLE]: 'Aceptable',
  [CALIDADES_DE_EXPOSICION.INSUFICIENTE]: 'Fuera de tema o sin razón',
  [CALIDADES_DE_EXPOSICION.SIN_EXPOSICION]: 'No está hablando',
};

// Lectura del promedio de los co-moderadores (entre −1 y +1) para el moderador.
export function describirNivelPromedio(nivelPromedio) {
  if (nivelPromedio === null || nivelPromedio === undefined) {
    return 'sin calificaciones';
  }
  if (nivelPromedio >= 0.5) {
    return 'coherente con el punto';
  }
  if (nivelPromedio > -0.5) {
    return 'aceptable';
  }
  return 'fuera de tema o sin razón';
}
