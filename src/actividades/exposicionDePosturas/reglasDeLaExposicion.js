// Reglas de la «Exposición de posturas», la versión ligera del debate hablado (docs/04).
//
// Sin imports a propósito: lo leen el estado derivado y las instrucciones, y la definición de la
// actividad importa el motor, que a su vez importa esas reglas (ver reglasDeIngreso.js).

export const ID_EXPOSICION_DE_POSTURAS = 'exposicion_de_posturas';

// Cada quien expone una sola vez y solo su postura: el argumento de ingreso ES la postura, así que
// no hay nada más que preparar ni conectar. Ocupa la posición 1 del perfil de puntaje.
export const POSICIONES_POR_PERSONA_EN_LA_EXPOSICION = 1;

export function esExposicionDePosturas(programa) {
  return programa?.actividad === ID_EXPOSICION_DE_POSTURAS;
}

// Cuántas posiciones del perfil de puntaje puede llegar a completar una persona.
export function posicionesQueSePuedenCompletar(programa, posicionesDelPerfil) {
  return esExposicionDePosturas(programa)
    ? Math.min(POSICIONES_POR_PERSONA_EN_LA_EXPOSICION, posicionesDelPerfil)
    : posicionesDelPerfil;
}
