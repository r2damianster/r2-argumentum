// Rúbrica y nota de una entrega escrita — ver docs/14-control-de-lectura.md.
//
// La rúbrica es una lista de criterios con peso y cuatro niveles. La nota (sobre 10, con decimales)
// es un cálculo que ve solo el docente. Funciones puras, sin conocer ninguna actividad: sirven igual
// para la calificación del docente, la sugerencia de Groq y la revisión de un par.

export const NIVELES_DE_RUBRICA = {
  EXCELENTE: 'excelente',
  BUENO: 'bueno',
  ACEPTABLE: 'aceptable',
  INSUFICIENTE: 'insuficiente',
};

// Orden de mayor a menor. El valor es el peldaño (3 a 0): la nota usa `valor / 3` y la cercanía entre
// dos evaluaciones usa la diferencia de peldaños.
export const ESCALA_DE_NIVELES = [
  { id: NIVELES_DE_RUBRICA.EXCELENTE, etiqueta: 'Excelente', valor: 3 },
  { id: NIVELES_DE_RUBRICA.BUENO, etiqueta: 'Bueno', valor: 2 },
  { id: NIVELES_DE_RUBRICA.ACEPTABLE, etiqueta: 'Aceptable', valor: 1 },
  { id: NIVELES_DE_RUBRICA.INSUFICIENTE, etiqueta: 'Insuficiente', valor: 0 },
];

export const IDS_DE_NIVELES = ESCALA_DE_NIVELES.map((nivel) => nivel.id);
export const VALOR_MAXIMO_DE_NIVEL = 3;
export const NOTA_MAXIMA = 10;

export function valorDelNivel(idDeNivel) {
  return ESCALA_DE_NIVELES.find((nivel) => nivel.id === idDeNivel)?.valor ?? null;
}

export function etiquetaDelNivel(idDeNivel) {
  return ESCALA_DE_NIVELES.find((nivel) => nivel.id === idDeNivel)?.etiqueta ?? '—';
}

// Criterios de serie: sirven para cualquier consigna. El Programa puede cambiar pesos, quitar los que
// no use y sumar `criteriosDeLaConsigna` (lo que esa tarea en particular exige).
export const CRITERIOS_BASE_DE_LA_RUBRICA = [
  {
    id: 'pertinencia',
    nombre: 'Pertinencia a la consigna',
    descripcion: 'Responde a lo que se pidió y se mantiene en el tópico.',
    peso: 25,
  },
  {
    id: 'estructura',
    nombre: 'Estructura',
    descripcion: 'Sigue la estructura pedida y el número de párrafos.',
    peso: 25,
  },
  {
    id: 'desarrollo',
    nombre: 'Desarrollo del tópico',
    descripcion: 'Las ideas están sostenidas con razones, datos o ejemplos.',
    peso: 25,
  },
  {
    id: 'claridad',
    nombre: 'Claridad y cohesión',
    descripcion: 'Las ideas se entienden y se enlazan entre sí.',
    peso: 15,
  },
  {
    id: 'lengua',
    nombre: 'Corrección lingüística',
    descripcion: 'Ortografía, puntuación y vocabulario adecuados.',
    peso: 10,
  },
];

const MAXIMO_DE_CARACTERES_DEL_TEXTO_DE_CRITERIO = 240;

function limpiarTexto(valor, maximo) {
  return String(valor ?? '').trim().slice(0, maximo);
}

function normalizarCriterio(criterio, posicion, prefijoDeId) {
  const nombre = limpiarTexto(criterio?.nombre, 80);
  if (!nombre) {
    return null;
  }
  const peso = Number(criterio?.peso);
  return {
    id: limpiarTexto(criterio?.id, 40) || `${prefijoDeId}-${posicion + 1}`,
    nombre,
    descripcion: limpiarTexto(criterio?.descripcion, MAXIMO_DE_CARACTERES_DEL_TEXTO_DE_CRITERIO),
    peso: Number.isFinite(peso) && peso > 0 ? peso : 10,
  };
}

// La rúbrica vigente de un Programa: los criterios propios (`rubrica`) o los de serie, más los de la
// consigna. Los ids se mantienen únicos para que las evaluaciones no se pisen.
export function resolverRubricaDelPrograma(programa) {
  const criteriosPropios = Array.isArray(programa?.rubrica) ? programa.rubrica : null;
  const deBase = (criteriosPropios ?? CRITERIOS_BASE_DE_LA_RUBRICA)
    .map((criterio, posicion) => normalizarCriterio(criterio, posicion, 'criterio'))
    .filter(Boolean);
  const deLaConsigna = (Array.isArray(programa?.criteriosDeLaConsigna) ? programa.criteriosDeLaConsigna : [])
    .map((criterio, posicion) =>
      normalizarCriterio(typeof criterio === 'string' ? { nombre: criterio, peso: 15 } : criterio, posicion, 'consigna')
    )
    .filter(Boolean);

  const idsUsados = new Set();
  return [...deBase, ...deLaConsigna].map((criterio) => {
    let idUnico = criterio.id;
    let repeticiones = 1;
    while (idsUsados.has(idUnico)) {
      repeticiones += 1;
      idUnico = `${criterio.id}-${repeticiones}`;
    }
    idsUsados.add(idUnico);
    return { ...criterio, id: idUnico };
  });
}

// Nivel por criterio → nota sobre 10 con dos decimales. Un criterio sin evaluar cuenta como 0; si no
// hay ninguna evaluación devuelve null (no hay nota que mostrar).
export function calcularNotaDeRubrica(rubrica, nivelesPorCriterio) {
  const pesoTotal = rubrica.reduce((suma, criterio) => suma + criterio.peso, 0);
  const hayEvaluacion = rubrica.some((criterio) => valorDelNivel(nivelesPorCriterio?.[criterio.id]) !== null);
  if (pesoTotal <= 0 || !hayEvaluacion) {
    return null;
  }
  const puntosObtenidos = rubrica.reduce(
    (suma, criterio) => suma + criterio.peso * ((valorDelNivel(nivelesPorCriterio?.[criterio.id]) ?? 0) / VALOR_MAXIMO_DE_NIVEL),
    0
  );
  return Math.round((NOTA_MAXIMA * puntosObtenidos * 100) / pesoTotal) / 100;
}

export function rubricaEstaCompleta(rubrica, nivelesPorCriterio) {
  return rubrica.length > 0 && rubrica.every((criterio) => valorDelNivel(nivelesPorCriterio?.[criterio.id]) !== null);
}

// Deja solo criterios que existen y niveles válidos: lo que llega de un par, de Groq o de un mensaje
// del canal no se acepta tal cual.
export function filtrarNivelesValidos(rubrica, nivelesPorCriterio) {
  const filtrados = {};
  for (const criterio of rubrica) {
    if (valorDelNivel(nivelesPorCriterio?.[criterio.id]) !== null) {
      filtrados[criterio.id] = nivelesPorCriterio[criterio.id];
    }
  }
  return filtrados;
}

// Texto de los comentarios por criterio: solo los criterios de la rúbrica, con longitud acotada.
export function filtrarComentariosPorCriterio(rubrica, comentariosPorCriterio, maximoDeCaracteres = 600) {
  const filtrados = {};
  for (const criterio of rubrica) {
    const comentario = limpiarTexto(comentariosPorCriterio?.[criterio.id], maximoDeCaracteres);
    if (comentario) {
      filtrados[criterio.id] = comentario;
    }
  }
  return filtrados;
}
