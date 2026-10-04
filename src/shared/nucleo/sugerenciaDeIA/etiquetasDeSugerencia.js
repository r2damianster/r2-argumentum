// Cómo se muestra la sugerencia de la IA — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
// La IA propone y las personas deciden: todo el texto que ve el usuario habla de «sugerencia».
// Funciones puras, independientes de la actividad.

export const ETIQUETA_DE_COMPLETITUD = {
  completo: 'Completo',
  incompleto: 'Incompleto',
  sin_razon: 'Sin razón',
};

export const ETIQUETA_DE_FALACIA = {
  ad_hominem: 'Ataque a la persona (ad hominem)',
  falsa_dicotomia: 'Falsa dicotomía',
  generalizacion_apresurada: 'Generalización apresurada',
  hombre_de_paja: 'Hombre de paja',
  apelacion_a_autoridad: 'Apelación a la autoridad',
  apelacion_a_la_mayoria: 'Apelación a la mayoría',
  pendiente_resbaladiza: 'Pendiente resbaladiza',
  razonamiento_circular: 'Razonamiento circular',
  falsa_causa: 'Falsa causa',
};

export function describirCompletitud(sugerencia) {
  return ETIQUETA_DE_COMPLETITUD[sugerencia?.completitud] ?? null;
}

export function describirFalacias(sugerencia) {
  return (sugerencia?.falacias ?? []).map((falacia) => ({
    ...falacia,
    etiqueta: ETIQUETA_DE_FALACIA[falacia.tipo] ?? falacia.tipo,
  }));
}

// Lo que la IA marcó para mirar con atención: sirve para ordenar la cola de revisión (lo marcado
// primero). No es una decisión: un aporte «incompleto» o con una posible falacia solo sube en la cola.
export function sugerenciaMerecePrioridad(sugerencia) {
  if (!sugerencia) {
    return false;
  }
  return sugerencia.completitud === 'incompleto' || sugerencia.completitud === 'sin_razon' || (sugerencia.falacias ?? []).length > 0;
}
