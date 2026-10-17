// Patrón de escritura que el moderador pide para los argumentos de la sesión (debate hablado).
//
// Apagado por defecto. Con él activo, quien escribe ve la guía del patrón (PEEL, CER, Toulmin…) y hay dos
// modos de retroalimentación:
//   - con_retroalimentacion: práctica. La IA le sugiere a quien escribe qué parte falta.
//   - sin_retroalimentacion: evaluación. La IA no le dice nada a quien escribe; solo el moderador
//     recibe la sugerencia de qué partes se detectaron.
// En ambos modos el argumento pasa igual: el patrón es una ayuda, nunca un requisito ni puntaje.

import { ESTRUCTURAS_DE_SERIE, ID_DE_ESTRUCTURA_LIBRE, resolverEstructuraDelPrograma } from './estructurasDeEscritura.js';

export const MODOS_DEL_PATRON = {
  NINGUNO: 'ninguno',
  CON_RETROALIMENTACION: 'con_retroalimentacion',
  SIN_RETROALIMENTACION: 'sin_retroalimentacion',
};

export const ETIQUETA_DEL_MODO_DEL_PATRON = {
  [MODOS_DEL_PATRON.CON_RETROALIMENTACION]: 'Con retroalimentación (práctica)',
  [MODOS_DEL_PATRON.SIN_RETROALIMENTACION]: 'Sin retroalimentación (evaluación)',
};

export const DESCRIPCION_DEL_MODO_DEL_PATRON = {
  [MODOS_DEL_PATRON.CON_RETROALIMENTACION]:
    'La IA le sugiere a cada estudiante qué parte del patrón le falta. Sirve para practicar.',
  [MODOS_DEL_PATRON.SIN_RETROALIMENTACION]:
    'La IA no le dice nada a quien escribe: solo tú ves qué partes del patrón se detectaron. Sirve para evaluar si lo aplican por su cuenta.',
};

export const PATRON_POR_DEFECTO = 'cer';

// PEEL y SPRE son patrones de párrafo: en un argumento de una a tres oraciones quedan largos.
export const PATRONES_DE_PARRAFO = ['peel', 'spre'];

// Cuántas partes tiene el patrón a partir de la cual el argumento corto se queda justo.
export const PARTES_QUE_EXIGEN_MAS_TEXTO = 5;

export function patronesElegibles() {
  return Object.values(ESTRUCTURAS_DE_SERIE).filter((estructura) => estructura.id !== ID_DE_ESTRUCTURA_LIBRE);
}

// Un valor ausente, viejo o inválido deja el patrón apagado: un Programa mal escrito no rompe la sesión.
export function normalizarPatronDeArgumento(valor) {
  const modoSolicitado = valor?.modo;
  const modo = Object.values(MODOS_DEL_PATRON).includes(modoSolicitado) ? modoSolicitado : MODOS_DEL_PATRON.NINGUNO;
  const estructuraSolicitada = valor?.estructura;
  const estructura = patronesElegibles().some((patron) => patron.id === estructuraSolicitada)
    ? estructuraSolicitada
    : PATRON_POR_DEFECTO;
  return { modo, estructura };
}

// El aviso para el moderador al elegir un patrón que puede resultar largo para un argumento corto.
export function avisoDeLongitudDelPatron(idDeEstructura) {
  if (PATRONES_DE_PARRAFO.includes(idDeEstructura)) {
    return 'Es un patrón de párrafo: pide más texto que un argumento corto del debate.';
  }
  const estructura = ESTRUCTURAS_DE_SERIE[idDeEstructura];
  if (estructura && estructura.partes.length >= PARTES_QUE_EXIGEN_MAS_TEXTO) {
    return `Tiene ${estructura.partes.length} partes: pide un argumento más largo de lo habitual.`;
  }
  return '';
}

// Devuelve null si el patrón está apagado; si no, el patrón listo para mostrar en el idioma del debate:
// { modo, daRetroalimentacion, estructura: { id, nombre, queEs, ejemplo, partes } }.
export function patronDeArgumentoActivo(programa, idioma = 'es') {
  const { modo, estructura } = normalizarPatronDeArgumento(programa?.patronDeArgumento);
  if (modo === MODOS_DEL_PATRON.NINGUNO) {
    return null;
  }
  return {
    modo,
    daRetroalimentacion: modo === MODOS_DEL_PATRON.CON_RETROALIMENTACION,
    estructura: resolverEstructuraDelPrograma({ estructura }, idioma),
  };
}
