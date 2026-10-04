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
  libre: {
    id: 'libre',
    nombre: { es: 'Escritura libre', en: 'Free writing' },
    queEs: {
      es: 'Sin estructura obligatoria: escribes con tus palabras, pero cuida que haya una idea clara, algo que la sostenga (un dato, una razón o un ejemplo) y un cierre.',
      en: 'No required structure: write in your own words, but make sure there is a clear idea, something that supports it (a fact, a reason or an example) and a closing.',
    },
    partes: [],
  },
  peel: {
    id: 'peel',
    nombre: { es: 'PEEL', en: 'PEEL' },
    queEs: {
      es: 'Un párrafo en cuatro movimientos: afirmas una idea (Punto), la respaldas con un dato o una cita (Evidencia), explicas por qué esa evidencia sostiene la idea (Explicación) y la conectas con la consigna o con lo que sigue (Enlace).',
      en: 'A paragraph in four moves: you state an idea (Point), back it up with a fact or quotation (Evidence), explain why that evidence supports the idea (Explain) and connect it to the prompt or to what follows (Link).',
    },
    ejemplo: {
      es: [
        'Leer en voz alta mejora la comprensión de textos difíciles.',
        'En la lectura, un estudio con 40 estudiantes mostró un 20 % más de aciertos cuando leían en voz alta.',
        'Esto sugiere que escuchar la propia voz obliga a ir más despacio y a procesar cada frase.',
        'Por eso, en mi carrera, leeré en voz alta los textos técnicos antes de resumirlos.',
      ],
      en: [
        'Reading aloud improves comprehension of difficult texts.',
        'In the reading, a study of 40 students showed 20% more correct answers when they read aloud.',
        'This suggests that hearing your own voice forces you to slow down and process each sentence.',
        'That is why, in my field, I will read technical texts aloud before summarizing them.',
      ],
    },
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
    queEs: {
      es: 'Cuenta un problema y su solución: describes el contexto (Situación), señalas la dificultad (Problema), propones lo que se hizo o se puede hacer (Respuesta) y valoras qué tan bien funciona (Evaluación).',
      en: 'Tells a problem and its solution: you describe the context (Situation), point out the difficulty (Problem), propose what was or can be done (Response) and judge how well it works (Evaluation).',
    },
    ejemplo: {
      es: [
        'En muchas aulas, los estudiantes leen en silencio y pasan directo a otra actividad.',
        'El problema es que casi nadie sabe si de verdad comprendió lo leído.',
        'Una respuesta es pedir un resumen escrito de dos párrafos al terminar la lectura.',
        'Funciona bien porque obliga a ordenar las ideas, aunque exige tiempo en clase.',
      ],
      en: [
        'In many classrooms, students read silently and move straight on to another activity.',
        'The problem is that almost nobody knows whether they really understood what they read.',
        'One response is to ask for a two-paragraph written summary after the reading.',
        'It works well because it forces students to organize ideas, although it takes class time.',
      ],
    },
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
    queEs: {
      es: 'Defiende una posición desde el inicio: dices tu posición (Punto), das la razón (Razón), la ilustras con un caso concreto (Ejemplo) y reafirmas tu posición, ya respaldada (Punto).',
      en: 'Defends a position from the start: you state your position (Point), give the reason (Reason), illustrate it with a concrete case (Example) and restate your position, now supported (Point).',
    },
    ejemplo: {
      es: [
        'Creo que los resúmenes escritos ayudan más a aprender que releer.',
        'La razón es que escribir obliga a decidir qué es importante y a decirlo con palabras propias.',
        'Por ejemplo, cuando resumí un artículo de metodología, descubrí que no entendía una de sus ideas centrales.',
        'Por eso defiendo resumir por escrito antes de dar un tema por aprendido.',
      ],
      en: [
        'I believe written summaries help learning more than rereading.',
        'The reason is that writing forces you to decide what matters and to say it in your own words.',
        'For example, when I summarized a methodology article, I found I did not understand one of its central ideas.',
        'That is why I defend summarizing in writing before considering a topic learned.',
      ],
    },
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
    queEs: {
      es: 'Estructura de argumento con evidencia: afirmas algo (Afirmación), lo respaldas con datos o ideas del texto (Evidencia) y explicas la lógica que une ambas cosas (Razonamiento).',
      en: 'An evidence-based argument: you claim something (Claim), support it with data or ideas from the text (Evidence) and explain the logic that links both (Reasoning).',
    },
    ejemplo: {
      es: [
        'Medir un problema antes de intervenir reduce los errores de una propuesta.',
        'El texto cuenta que un equipo que midió primero redujo sus correcciones a la mitad.',
        'Al conocer el tamaño real del problema, el equipo eligió una solución proporcionada y evitó rehacer trabajo.',
      ],
      en: [
        'Measuring a problem before intervening reduces the errors of a proposal.',
        'The text reports that a team that measured first cut its corrections in half.',
        'By knowing the real size of the problem, the team chose a proportionate solution and avoided rework.',
      ],
    },
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

  // La muestra pedagógica (qué es y un ejemplo resuelto, parte por parte) solo la traen las estructuras de
  // serie; una propia del Programa se muestra con sus partes.
  const ejemplo = base.ejemplo?.[idioma] ?? base.ejemplo?.es ?? null;
  return {
    id: base.id ?? idSolicitado ?? 'propia',
    nombre: textoEnElIdioma(base.nombre, idioma),
    queEs: base.queEs ? textoEnElIdioma(base.queEs, idioma) : '',
    ejemplo: Array.isArray(ejemplo) && ejemplo.length === partes.length ? ejemplo : null,
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
