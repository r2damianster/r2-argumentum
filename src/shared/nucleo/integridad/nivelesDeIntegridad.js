// Niveles de integridad académica de una actividad — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// La integridad está APAGADA por defecto (no se registra nada). Cuando el moderador la activa, las
// señales son una ADVERTENCIA para el instructor, no una prueba ni una sanción automática. Funciones
// puras e independientes de la actividad: sirven para cualquier campo donde alguien escriba.

export const NIVELES_DE_INTEGRIDAD = {
  // No se registra nada y no se usa el canal privado.
  NINGUNA: 'ninguna',
  // Se registran señales. Quien escribe ve «el moderador verá esta marca» antes de enviar, y elige
  // «Enviar igual» o «Reescribir». Solo el moderador ve las marcas.
  ADVERTENCIAS: 'advertencias',
  // Además de registrar, se bloquea pegar y arrastrar texto. Los intentos quedan registrados.
  RESTRICTIVA: 'restrictiva',
};

export const NIVEL_DE_INTEGRIDAD_POR_DEFECTO = NIVELES_DE_INTEGRIDAD.NINGUNA;

export function normalizarIntegridad(integridad) {
  const nivel = Object.values(NIVELES_DE_INTEGRIDAD).includes(integridad?.nivel)
    ? integridad.nivel
    : NIVEL_DE_INTEGRIDAD_POR_DEFECTO;
  return { nivel };
}

export function resolverNivelDeIntegridad(programa) {
  return normalizarIntegridad(programa?.integridad).nivel;
}

export function integridadEstaActiva(programa) {
  return resolverNivelDeIntegridad(programa) !== NIVELES_DE_INTEGRIDAD.NINGUNA;
}

export function integridadBloqueaPegar(programa) {
  return resolverNivelDeIntegridad(programa) === NIVELES_DE_INTEGRIDAD.RESTRICTIVA;
}

export const ETIQUETA_DEL_NIVEL_DE_INTEGRIDAD = {
  [NIVELES_DE_INTEGRIDAD.NINGUNA]: 'Sin evaluación de integridad',
  [NIVELES_DE_INTEGRIDAD.ADVERTENCIAS]: 'Con advertencias',
  [NIVELES_DE_INTEGRIDAD.RESTRICTIVA]: 'Restrictiva (bloquea pegar)',
};

// Lo que se le dice a la clase al ingresar: registrar señales sin avisar sería injusto.
export function avisoDeIntegridadAlIngresar(nivel) {
  if (nivel === NIVELES_DE_INTEGRIDAD.ADVERTENCIAS) {
    return 'En esta actividad se registran señales de integridad mientras escribes (por ejemplo, si pegas texto de otro sitio). Solo las ve el moderador y son una advertencia, no una sanción automática.';
  }
  if (nivel === NIVELES_DE_INTEGRIDAD.RESTRICTIVA) {
    return 'En esta actividad no se puede pegar ni arrastrar texto: escribe con tus propias palabras. Los intentos quedan registrados y los ve el moderador.';
  }
  return '';
}
