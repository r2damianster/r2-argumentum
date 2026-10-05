// Modos de ahorro de mensajes y de IA según el tamaño de la sala — ver docs/06-pendientes.md (prueba de carga del
// 4-oct-2026) y docs/02-arquitectura.md.
//
// Con salas chicas conviene lo más directo e inmediato; con salas grandes, ahorrar mensajes (Ably limita la tasa) y
// tokens de IA (Groq limita por minuto). El modo lo elige el docente al configurar la sala o se deja en
// «automático»: al iniciar, el host lo fija según cuántas personas hay (evento `sesion.modo_de_ahorro_fijado`) para que
// host y estudiantes apliquen el mismo y no cambie a mitad de la sesión. Funciones puras.
//
//   pequena   (hasta ~50)  Como era antes: cada estudiante avisa su entrega a la sala al instante, la IA razona con
//                          el esfuerzo normal y las réplicas cortas del foro también se consultan.
//   moderada  (desde ~50)  Las entregas se anuncian en lote desde el host cada ≤ 5 s, la IA razona con poco esfuerzo
//                          (~50 % menos tokens) y las réplicas cortas del foro no consultan a la IA.
//
// Quedan pendientes los modos «ahorro» y «masivo» (docs/06-pendientes.md).

export const MODOS_DE_AHORRO = {
  AUTOMATICO: 'automatico',
  PEQUENA: 'pequena',
  MODERADA: 'moderada',
};

// Modos que de verdad cambian el comportamiento (el automático se resuelve a uno de estos al iniciar).
export const MODOS_CONCRETOS = [MODOS_DE_AHORRO.PEQUENA, MODOS_DE_AHORRO.MODERADA];

export const PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO = 50;

export const ETIQUETA_DEL_MODO_DE_AHORRO = {
  [MODOS_DE_AHORRO.AUTOMATICO]: 'Automático',
  [MODOS_DE_AHORRO.PEQUENA]: 'Sala pequeña',
  [MODOS_DE_AHORRO.MODERADA]: 'Sala grande (moderado)',
};

export const PERFILES_DE_AHORRO = {
  [MODOS_DE_AHORRO.PEQUENA]: {
    avisoDeEntregas: 'individual', // cada estudiante publica su aviso a la sala al instante
    razonamientoDeGroq: 'normal',
    consultarReplicasCortasALaIA: true,
  },
  [MODOS_DE_AHORRO.MODERADA]: {
    avisoDeEntregas: 'lote', // lo anuncia el host en lote (entregasAgrupadas.js)
    razonamientoDeGroq: 'bajo',
    consultarReplicasCortasALaIA: false,
  },
};

// Lo que escribe el docente en la configuración: un valor desconocido vuelve a «automático».
export function normalizarModoDeAhorro(valor) {
  return Object.values(MODOS_DE_AHORRO).includes(valor) ? valor : MODOS_DE_AHORRO.AUTOMATICO;
}

export function recomendarModoDeAhorro(numeroDePersonas) {
  const personas = Math.max(0, Math.floor(Number(numeroDePersonas) || 0));
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
  if (modo === MODOS_DE_AHORRO.AUTOMATICO) {
    return {
      texto: `Modo de ahorro: automático. Con ${conectados} conectados se usaría «${ETIQUETA_DEL_MODO_DE_AHORRO[recomendado]}»; se fija al iniciar según cuántas personas haya.`,
      conviene: false,
    };
  }
  const desajustado = modo !== recomendado;
  return {
    texto: desajustado
      ? `Modo de ahorro: «${ETIQUETA_DEL_MODO_DE_AHORRO[modo]}». Con ${conectados} conectados conviene «${ETIQUETA_DEL_MODO_DE_AHORRO[recomendado]}»: cámbialo en «Volver a configuración».`
      : `Modo de ahorro: «${ETIQUETA_DEL_MODO_DE_AHORRO[modo]}».`,
    conviene: desajustado,
  };
}
