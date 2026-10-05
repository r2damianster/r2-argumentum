// Modos de ahorro de mensajes y de IA según el tamaño de la sala — ver docs/06-pendientes.md (prueba de carga del
// 4-oct-2026) y docs/02-arquitectura.md.
//
// Con salas chicas conviene lo más directo e inmediato; con salas grandes, ahorrar mensajes (Ably limita la tasa) y
// tokens de IA (Groq limita por minuto). El modo lo elige el docente al configurar la sala o se deja en
// «automático»: al iniciar, el host lo fija según cuántas personas hay (evento `sesion.modo_de_ahorro_fijado`) para que
// host y estudiantes apliquen el mismo y no cambie a mitad de la sesión. Funciones puras.
//
//   pequena   (hasta ~50)    Como era antes: cada estudiante avisa a la sala al instante, la IA sugiere sola con el
//                            esfuerzo normal y las réplicas cortas del foro también se consultan.
//   moderada  (~50 a ~120)   Las entregas se anuncian en lote desde el host cada ≤ 5 s, la IA razona con poco esfuerzo
//                            (~50 % menos tokens) y las réplicas cortas del foro no consultan a la IA.
//   ahorro    (~120 o más)   Además: revisiones, confirmaciones y devoluciones también se anuncian en lote, la IA solo
//                            sugiere cuando el docente la pide (por entrega o las pendientes) y el foro consulta a la IA
//                            una sola vez por aporte y nunca por réplicas.
//   masivo    (cientos; solo   Los participantes no publican NADA en la sala (ni presencia ni ingreso): todo lo mandan
//   control de lectura)        por canales privados y el host difunde resúmenes en lote. Hay que elegirlo a mano antes de
//                              abrir la sala, porque el ingreso ya ocurre ahí; el modo automático nunca lo elige.

export const MODOS_DE_AHORRO = {
  AUTOMATICO: 'automatico',
  PEQUENA: 'pequena',
  MODERADA: 'moderada',
  AHORRO: 'ahorro',
  MASIVO: 'masivo',
};

// Modos que de verdad cambian el comportamiento (el automático se resuelve a uno de estos al iniciar).
export const MODOS_CONCRETOS = [MODOS_DE_AHORRO.PEQUENA, MODOS_DE_AHORRO.MODERADA, MODOS_DE_AHORRO.AHORRO, MODOS_DE_AHORRO.MASIVO];

export const PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO = 50;
export const PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO = 120;
// Desde aquí el modo automático ya no alcanza (no puede elegir el masivo): se le recomienda al docente elegirlo a mano.
export const PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_EL_MODO_MASIVO = 250;

export const ETIQUETA_DEL_MODO_DE_AHORRO = {
  [MODOS_DE_AHORRO.AUTOMATICO]: 'Automático',
  [MODOS_DE_AHORRO.PEQUENA]: 'Sala pequeña',
  [MODOS_DE_AHORRO.MODERADA]: 'Sala grande (moderado)',
  [MODOS_DE_AHORRO.AHORRO]: 'Sala grande (ahorro)',
  [MODOS_DE_AHORRO.MASIVO]: 'Sala masiva',
};

export const PERFILES_DE_AHORRO = {
  [MODOS_DE_AHORRO.PEQUENA]: {
    avisoDeEntregas: 'individual', // cada estudiante publica su aviso a la sala al instante
    avisosDeLaLectura: 'sueltos', // revisiones, confirmaciones y devoluciones: un evento por persona
    ingreso: 'publico', // el ingreso se publica en la sala y la persona entra a la presencia
    sugerenciasDeLaIA: 'automaticas',
    razonamientoDeGroq: 'normal',
    consultarReplicasCortasALaIA: true,
    consultarReplicasALaIA: true,
    maximoDeConsultasALaIAPorAporte: 2,
  },
  [MODOS_DE_AHORRO.MODERADA]: {
    avisoDeEntregas: 'lote', // lo anuncia el host en lote (anunciosEnLote.js)
    avisosDeLaLectura: 'sueltos',
    ingreso: 'publico',
    sugerenciasDeLaIA: 'automaticas',
    razonamientoDeGroq: 'bajo',
    consultarReplicasCortasALaIA: false,
    consultarReplicasALaIA: true,
    maximoDeConsultasALaIAPorAporte: 2,
  },
  [MODOS_DE_AHORRO.AHORRO]: {
    avisoDeEntregas: 'lote',
    avisosDeLaLectura: 'lote',
    ingreso: 'publico',
    sugerenciasDeLaIA: 'por_demanda',
    razonamientoDeGroq: 'bajo',
    consultarReplicasCortasALaIA: false,
    consultarReplicasALaIA: false,
    maximoDeConsultasALaIAPorAporte: 1,
  },
  [MODOS_DE_AHORRO.MASIVO]: {
    avisoDeEntregas: 'lote',
    avisosDeLaLectura: 'lote',
    ingreso: 'privado', // el ingreso viaja por el canal privado y el host lo anuncia en lote; sin presencia
    sugerenciasDeLaIA: 'por_demanda',
    razonamientoDeGroq: 'bajo',
    consultarReplicasCortasALaIA: false,
    consultarReplicasALaIA: false,
    maximoDeConsultasALaIAPorAporte: 1,
  },
};

// Lo que escribe el docente en la configuración: un valor desconocido vuelve a «automático».
export function normalizarModoDeAhorro(valor) {
  return Object.values(MODOS_DE_AHORRO).includes(valor) ? valor : MODOS_DE_AHORRO.AUTOMATICO;
}

// Lo que el modo automático fija al iniciar. Nunca devuelve «masivo»: el ingreso ya ocurrió en la sala de espera.
export function recomendarModoDeAhorro(numeroDePersonas) {
  const personas = Math.max(0, Math.floor(Number(numeroDePersonas) || 0));
  if (personas >= PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO) {
    return MODOS_DE_AHORRO.AHORRO;
  }
  return personas >= PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO ? MODOS_DE_AHORRO.MODERADA : MODOS_DE_AHORRO.PEQUENA;
}

// El modo que rige AHORA en esta sesión.
//   · Programa sin el campo (guardado antes de esta función, o debate hablado): sala pequeña, el comportamiento de siempre.
//   · Modo concreto elegido por el docente: ese.
//   · Automático: el que fijó el host al iniciar; antes de iniciar, sala pequeña.
export function resolverModoDeAhorro({ programa, estado } = {}) {
  const elegido = programa?.modoDeAhorro;
  if (MODOS_CONCRETOS.includes(elegido)) {
    return elegido;
  }
  if (elegido === MODOS_DE_AHORRO.AUTOMATICO && MODOS_CONCRETOS.includes(estado?.sesion?.modoDeAhorro)) {
    return estado.sesion.modoDeAhorro;
  }
  return MODOS_DE_AHORRO.PEQUENA;
}

export function perfilDeAhorro({ programa, estado } = {}) {
  return PERFILES_DE_AHORRO[resolverModoDeAhorro({ programa, estado })];
}

// Lo que se le dice al docente en la sala de espera sobre el modo de ahorro, con las personas conectadas ahora.
// Devuelve null si el Programa no usa el modo (debate hablado).
export function describirElModoDeAhorro({ programa, conectados }) {
  if (programa?.modoDeAhorro === undefined) {
    return null;
  }
  const modo = normalizarModoDeAhorro(programa.modoDeAhorro);
  const recomendado = recomendarModoDeAhorro(conectados);
  const convieneMasivo = conectados >= PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_EL_MODO_MASIVO && modo !== MODOS_DE_AHORRO.MASIVO;
  const sugerenciaDelMasivo = convieneMasivo
    ? ` Con tantas personas, si es posible elige «${ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.MASIVO]}» en «Volver a configuración» (abre otra sala).`
    : '';
  if (modo === MODOS_DE_AHORRO.AUTOMATICO) {
    return {
      texto: `Modo de ahorro: automático. Con ${conectados} conectados se usaría «${ETIQUETA_DEL_MODO_DE_AHORRO[recomendado]}»; se fija al iniciar según cuántas personas haya.${sugerenciaDelMasivo}`,
      conviene: convieneMasivo,
    };
  }
  // El masivo no se compara con la recomendación automática: es una elección deliberada para salas muy grandes.
  const desajustado = modo !== MODOS_DE_AHORRO.MASIVO && modo !== recomendado;
  return {
    texto: desajustado
      ? `Modo de ahorro: «${ETIQUETA_DEL_MODO_DE_AHORRO[modo]}». Con ${conectados} conectados conviene «${ETIQUETA_DEL_MODO_DE_AHORRO[recomendado]}»: cámbialo en «Volver a configuración».${sugerenciaDelMasivo}`
      : `Modo de ahorro: «${ETIQUETA_DEL_MODO_DE_AHORRO[modo]}».${sugerenciaDelMasivo}`,
    conviene: desajustado || convieneMasivo,
  };
}
