// Puntaje de los aportes de una actividad escrita (posts y réplicas) — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Sigue la fórmula única: no hay números sueltos, todo sale de los valores de posición del perfil
// de puntaje (perfilesDePuntaje.js). Es independiente de cualquier actividad.
//
//   post nuevo n.º 1, 2, 3 → valor de la posición 1, 2, 3 del perfil
//   réplica                → valor de la última posición del perfil (la de menor valor)
//   más allá de los topes  → se publica y se ve, pero vale 0

export const LIMITES_DE_APORTES_PUNTUADOS_POR_DEFECTO = {
  maxPostsNuevos: 3,
  maxReplicasPuntuadas: 5,
};

// Niveles que decide la revisión humana sobre un aporte. Se aplican una sola vez, al cerrar.
export const NIVELES_DE_REVISION_DE_APORTE = {
  NO_CUENTA: 0,
  PARCIAL: 0.5,
  CUENTA_COMPLETO: 1,
};

export const ESCALA_DE_REVISION_DE_APORTE = { minimo: 0, maximo: 1 };

export const ETIQUETA_DE_NIVEL_DE_REVISION = {
  [NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO]: 'Cuenta completo',
  [NIVELES_DE_REVISION_DE_APORTE.PARCIAL]: 'Cuenta parcial',
  [NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA]: 'No cuenta',
};

export function resolverLimitesDeAportesPuntuados(programa) {
  return { ...LIMITES_DE_APORTES_PUNTUADOS_POR_DEFECTO, ...(programa?.limitesDePuntaje ?? {}) };
}

// `ordinalDelTipo` es el lugar que ocupa entre los aportes del mismo tipo de esa persona
// (su 1.er post, su 2.ª réplica…), contando desde 1.
export function calcularPuntajeDeAporte(
  { esReplica, ordinalDelTipo },
  parametros,
  limites = LIMITES_DE_APORTES_PUNTUADOS_POR_DEFECTO
) {
  const valores = parametros.valoresBasePosicion;

  if (esReplica) {
    return ordinalDelTipo <= limites.maxReplicasPuntuadas ? valores[valores.length - 1] : 0;
  }
  const maximoDePosts = Math.min(limites.maxPostsNuevos, valores.length);
  return ordinalDelTipo <= maximoDePosts ? valores[ordinalDelTipo - 1] : 0;
}

// Cuánto hay que sumar o restar al puntaje provisional según el nivel final de la revisión.
// Un aporte que cuenta completo no cambia; uno parcial pierde la mitad; uno que no cuenta lo pierde todo.
export function calcularAjusteDeAportePorRevision({ puntajeProvisional, nivelFinal }) {
  if (nivelFinal === null || nivelFinal === undefined) {
    return 0;
  }
  return Math.round((nivelFinal - NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO) * puntajeProvisional);
}
