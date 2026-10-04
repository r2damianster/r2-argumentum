// Estructuras de escritura (PEEL, SPRE…) — ver docs/14-control-de-lectura.md.
//
// Una estructura es una lista de partes con una guía de qué va en cada una. Cada Programa elige una
// de serie por su `id` o trae una propia en el JSON. La app solo MUESTRA la guía y cuenta palabras y
// párrafos; que el texto la siga lo sugiere Groq y lo decide el docente.

export const DISTRIBUCIONES_DE_ESTRUCTURA = {
  // La estructura completa dentro de cada párrafo, una parte por oración.
  COMPACTA: 'compacta',
  // Una parte por párrafo: el texto se extiende a lo largo de varios párrafos.
  DESARROLLADA: 'desarrollada',
};

export const ETIQUETA_DE_LA_DISTRIBUCION = {
  [DISTRIBUCIONES_DE_ESTRUCTURA.COMPACTA]: 'Compacta: toda la estructura dentro de cada párrafo (una parte por oración)',
  [DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA]: 'Desarrollada: una parte por párrafo',
};

export const ID_DE_ESTRUCTURA_LIBRE = 'libre';

// `es` y `en`: el idioma del ejercicio decide cuál se muestra (ver idiomaDelDebate.js).
export const ESTRUCTURAS_DE_SERIE = {
  libre: { id: 'libre', nombre: { es: 'Escritura libre', en: 'Free writing' }, partes: [] },
  peel: {
    id: 'peel',
    nombre: { es: 'PEEL', en: 'PEEL' },
    partes: [
      {
        nombre: { es: 'Punto', en: 'Point' },
        descripcion: { es: 'La idea principal del párrafo, en una oración.', en: 'The main idea of the paragraph, in one sentence.' },
      },
      {
        nombre: { es: 'Evidencia', en: 'Evidence' },
        descripcion: { es: 'Un dato, cita o ejemplo que sostiene el punto.', en: 'A fact, quotation or example that supports the point.' },
      },
      {
        nombre: { es: 'Explicación', en: 'Explain' },
        descripcion: { es: 'Por qué la evidencia sostiene el punto.', en: 'Why the evidence supports the point.' },
      },
      {
        nombre: { es: 'Enlace', en: 'Link' },
        descripcion: { es: 'Cómo se conecta con la consigna o con el siguiente párrafo.', en: 'How it connects to the prompt or to the next paragraph.' },
      },
    ],
  },
  spre: {
    id: 'spre',
    nombre: { es: 'SPRE', en: 'SPRE' },
    partes: [
      {
        nombre: { es: 'Situación', en: 'Situation' },
        descripcion: { es: 'El contexto en que se plantea el tema.', en: 'The context in which the topic arises.' },
      },
      {
        nombre: { es: 'Problema', en: 'Problem' },
        descripcion: { es: 'La dificultad o pregunta que surge en esa situación.', en: 'The difficulty or question that arises in that situation.' },
      },
      {
        nombre: { es: 'Respuesta', en: 'Response' },
        descripcion: { es: 'La solución o postura que se propone.', en: 'The solution or position that is proposed.' },
      },
      {
        nombre: { es: 'Evaluación', en: 'Evaluation' },
        descripcion: { es: 'Qué tan bien funciona la respuesta y por qué.', en: 'How well the response works and why.' },
      },
    ],
  },
  prep: {
    id: 'prep',
    nombre: { es: 'PREP', en: 'PREP' },
    partes: [
      {
        nombre: { es: 'Punto', en: 'Point' },
        descripcion: { es: 'Tu posición, dicha desde el inicio.', en: 'Your position, stated from the start.' },
      },
      {
        nombre: { es: 'Razón', en: 'Reason' },
        descripcion: { es: 'Por qué piensas así.', en: 'Why you think so.' },
      },
      {
        nombre: { es: 'Ejemplo', en: 'Example' },
        descripcion: { es: 'Un caso concreto que ilustra la razón.', en: 'A concrete case that illustrates the reason.' },
      },
      {
        nombre: { es: 'Punto', en: 'Point' },
        descripcion: { es: 'Vuelves a afirmar tu posición, ahora respaldada.', en: 'You restate your position, now supported.' },
      },
    ],
  },
  cer: {
    id: 'cer',
    nombre: { es: 'CER', en: 'CER' },
    partes: [
      {
        nombre: { es: 'Afirmación', en: 'Claim' },
        descripcion: { es: 'Lo que sostienes sobre el tema.', en: 'What you assert about the topic.' },
      },
      {
        nombre: { es: 'Evidencia', en: 'Evidence' },
        descripcion: { es: 'Datos o ideas de la lectura que respaldan la afirmación.', en: 'Data or ideas from the reading that back the claim.' },
      },
      {
        nombre: { es: 'Razonamiento', en: 'Reasoning' },
        descripcion: { es: 'La lógica que une la evidencia con la afirmación.', en: 'The logic that links the evidence to the claim.' },
      },
    ],
  },
};

function textoEnElIdioma(textoPorIdioma, idioma) {
  if (typeof textoPorIdioma === 'string') {
    return textoPorIdioma;
  }
  return textoPorIdioma?.[idioma] ?? textoPorIdioma?.es ?? '';
}

// Devuelve la estructura lista para mostrar, ya en el idioma del ejercicio:
// { id, nombre, partes: [{ nombre, descripcion }], esLibre }.
// El Programa puede traer `estructura: "peel"`, `estructura: { id: "peel" }` o una propia con
// `partes`. Una estructura desconocida se trata como libre en vez de romper la sesión.
export function resolverEstructuraDelPrograma(programa, idioma = 'es') {
  const solicitada = programa?.estructura;
  const idSolicitado = typeof solicitada === 'string' ? solicitada : solicitada?.id;
  const propia = typeof solicitada === 'object' && Array.isArray(solicitada?.partes) && solicitada.partes.length > 0;

  const base = propia ? solicitada : ESTRUCTURAS_DE_SERIE[idSolicitado] ?? ESTRUCTURAS_DE_SERIE[ID_DE_ESTRUCTURA_LIBRE];
  const partes = (base.partes ?? []).map((parte) => ({
    nombre: textoEnElIdioma(parte.nombre, idioma),
    descripcion: textoEnElIdioma(parte.descripcion, idioma),
  }));

  return {
    id: base.id ?? idSolicitado ?? 'propia',
    nombre: textoEnElIdioma(base.nombre, idioma),
    partes,
    esLibre: partes.length === 0,
  };
}

export function resolverDistribucion(programa) {
  return programa?.distribucion === DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA
    ? DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA
    : DISTRIBUCIONES_DE_ESTRUCTURA.COMPACTA;
}

// Cuántos párrafos se piden. Sin dato, 1. En la distribución desarrollada la estructura se reparte en
// párrafos, así que se ajusta al múltiplo de partes más cercano hacia arriba (con 4 partes: 4, 8…).
export function resolverNumeroDeParrafos(programa, idioma = 'es') {
  const solicitado = Math.max(1, Math.floor(Number(programa?.numeroDeParrafos) || 1));
  const estructura = resolverEstructuraDelPrograma(programa, idioma);
  if (estructura.esLibre || resolverDistribucion(programa) !== DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA) {
    return solicitado;
  }
  const cantidadDePartes = estructura.partes.length;
  return Math.ceil(solicitado / cantidadDePartes) * cantidadDePartes;
}

// Lo que ve quien escribe como orientación: cuántos párrafos y cómo se reparte la estructura.
export function describirLaEstructuraPedida(programa, idioma = 'es') {
  const estructura = resolverEstructuraDelPrograma(programa, idioma);
  const numeroDeParrafos = resolverNumeroDeParrafos(programa, idioma);
  const textoDeParrafos = numeroDeParrafos === 1 ? '1 párrafo' : `${numeroDeParrafos} párrafos`;
  if (estructura.esLibre) {
    return `Escritura libre en ${textoDeParrafos}.`;
  }
  const distribucion = resolverDistribucion(programa);
  const nombresDeLasPartes = estructura.partes.map((parte) => parte.nombre).join(' → ');
  return distribucion === DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA
    ? `${estructura.nombre} en ${textoDeParrafos}, una parte por párrafo: ${nombresDeLasPartes}.`
    : `${estructura.nombre} en ${textoDeParrafos}, con toda la estructura dentro de cada párrafo (una parte por oración): ${nombresDeLasPartes}.`;
}
