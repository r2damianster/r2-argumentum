// Traduce la respuesta del checkpoint 1 de Groq a una decisión concreta para el estudiante.
//
// Principio rector (CLAUDE.md): Groq NUNCA es juez autoritativo. Ante la duda, el sistema
// aprueba y deja seguir — bloquear a un estudiante por una clasificación insegura es peor que
// dejar pasar un argumento mal catalogado, que además el co-moderador puede reclasificar.

export const DECISIONES = {
  APROBADO: 'aprobado',
  FORMA_INVALIDA: 'forma_invalida',
  POSTURA_DISTINTA: 'postura_distinta',
  POSTURA_NUEVA_PROPUESTA: 'postura_nueva_propuesta',
  POSTURA_FUERA_DEL_DEBATE: 'postura_fuera_del_debate',
};

// Por debajo de esta confianza no se contradice la postura que el estudiante eligió: él sabe
// mejor que el clasificador qué está defendiendo.
const CONFIANZA_MINIMA_PARA_CONTRADECIR = 0.6;

export function decidirValidacion({
  resultadoDeGroq,
  stanceElegido,
  permitirPosturasNuevas = false,
  posturas = [],
  // Con asignación aleatoria nadie "eligió" su postura, y no tiene sentido ofrecer cambiarse
  // a la que Groq detectó — el ejercicio es justo defender la que le tocó. Sin esto, el
  // mensaje ofrecía un botón de cambio que en ese modo no existe en pantalla.
  permiteCambioDePostura = true,
}) {
  if (!resultadoDeGroq.aprobado) {
    return {
      decision: DECISIONES.FORMA_INVALIDA,
      mensaje: resultadoDeGroq.motivo || 'Tu argumento todavía no tiene una razón que sostenga lo que afirmas.',
      sugerencia: resultadoDeGroq.sugerenciaDeCorreccion || '',
    };
  }

  if (resultadoDeGroq.esPosturaNueva) {
    const posturaSugerida = resultadoDeGroq.posturaSugerida || 'una postura que no está en la lista';
    if (permitirPosturasNuevas) {
      return {
        decision: DECISIONES.POSTURA_NUEVA_PROPUESTA,
        mensaje: `Tu argumento no defiende ninguna de las posturas del debate, sino ${posturaSugerida}.`,
        sugerencia: 'Puedes proponerla al moderador y esperar su aprobación, o reescribir tu argumento.',
        posturaSugerida: resultadoDeGroq.posturaSugerida || '',
      };
    }
    return {
      decision: DECISIONES.POSTURA_FUERA_DEL_DEBATE,
      mensaje: `Tu argumento defiende ${posturaSugerida}, y este debate solo admite las posturas de la lista.`,
      sugerencia: 'Reescribe tu argumento defendiendo una de las posturas disponibles.',
      posturaSugerida: resultadoDeGroq.posturaSugerida || '',
    };
  }

  // Una postura marcada como matizada ("depende", "condicional") por definición critica o
  // concede algo a los dos polos, así que un argumento suyo puede parecer de cualquiera de las
  // otras posturas. Contradecirla ahí rechazaba argumentos legítimos (reporte de prueba en vivo:
  // un contraargumento crítico del libre mercado, escrito desde la postura matizada, se
  // rechazaba por "defender más mercado").
  const posturaElegida = posturas.find((postura) => postura.id === stanceElegido);
  const eligioPosturaMatizada = Boolean(posturaElegida?.esMatizada);

  const clasificoConSeguridad =
    resultadoDeGroq.posturaDetectada !== null &&
    (resultadoDeGroq.confianza === null || resultadoDeGroq.confianza >= CONFIANZA_MINIMA_PARA_CONTRADECIR);

  if (
    clasificoConSeguridad &&
    !eligioPosturaMatizada &&
    stanceElegido &&
    resultadoDeGroq.posturaDetectada !== stanceElegido
  ) {
    const etiquetaDetectada =
      posturas.find((postura) => postura.id === resultadoDeGroq.posturaDetectada)?.etiqueta ??
      resultadoDeGroq.posturaDetectada;
    return {
      decision: DECISIONES.POSTURA_DISTINTA,
      mensaje: permiteCambioDePostura
        ? `Tu argumento parece defender "${etiquetaDetectada}", que no es la postura que elegiste.`
        : `Tu argumento parece defender "${etiquetaDetectada}", pero te toca defender otra postura.`,
      sugerencia: permiteCambioDePostura
        ? 'Puedes cambiar tu postura a esa, o reescribir el argumento para defender la que elegiste.'
        : 'Reescribe tu argumento para defender la postura que te tocó.',
      posturaDetectada: resultadoDeGroq.posturaDetectada,
    };
  }

  return {
    decision: DECISIONES.APROBADO,
    mensaje: '',
    sugerencia: '',
    posturaDetectada: resultadoDeGroq.posturaDetectada ?? stanceElegido ?? null,
  };
}

export function esDecisionQueBloquea(decision) {
  return decision === DECISIONES.FORMA_INVALIDA || decision === DECISIONES.POSTURA_FUERA_DEL_DEBATE;
}
