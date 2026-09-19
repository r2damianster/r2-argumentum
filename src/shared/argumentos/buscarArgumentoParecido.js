// Detecta si un argumento que se está escribiendo repite casi lo mismo que uno ya publicado.
//
// Es un filtro local y barato (sin Groq): compara el vocabulario "con contenido" de los dos
// textos. No pretende entender el sentido — solo evitar que alguien copie con otras palabras
// sueltas lo que ya está en el mapa y cobre puntos por ello. Si alguien de verdad quiere apoyar
// el argumento existente, lo correcto es marcarlo como refuerzo, y el aviso se lo ofrece.

const PALABRAS_SIN_CONTENIDO = new Set([
  'que', 'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'con', 'por', 'para', 'como', 'pero',
  'sus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'muy', 'mas', 'son',
  'ser', 'hay', 'han', 'fue', 'era', 'les', 'nos', 'lo', 'al', 'se', 'su', 'es', 'en', 'de',
  'la', 'el', 'un', 'y', 'o', 'a', 'no', 'si', 'porque', 'ya', 'dado', 'debido', 'puesto',
  'cuando', 'donde', 'sobre', 'entre', 'tambien', 'cada', 'todo', 'todos', 'toda', 'todas',
]);

export const UMBRAL_DE_SIMILITUD_POR_DEFECTO = 0.6;

// Con menos palabras con contenido no hay base para decir que dos textos "dicen lo mismo": tres
// palabras sueltas contenidas en un argumento largo puntuaban 0,9 y el aviso saltaba con frases
// que apenas empezaban. Se exige al texto nuevo lo mismo que pide la revisión de forma mínima
// (5 palabras en total); el argumento ya publicado solo necesita tener algo que comparar.
export const MINIMO_DE_PALABRAS_CON_CONTENIDO_DEL_TEXTO_NUEVO = 5;
const MINIMO_DE_PALABRAS_CON_CONTENIDO_DEL_ARGUMENTO_EXISTENTE = 3;

function quitarTildes(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Quitar terminaciones comunes hace que "regulaciones"/"regulación" o "empresas"/"empresa"
// cuenten como la misma idea sin necesitar un lematizador completo.
function raizAproximada(palabra) {
  return palabra.replace(/(ciones|cion|mente|es|s)$/u, '');
}

export function extraerPalabrasConContenido(texto) {
  const palabras = quitarTildes(String(texto ?? '').toLowerCase()).match(/[a-z0-9ñ]+/g) ?? [];
  const conContenido = palabras
    .filter((palabra) => palabra.length >= 3 && !PALABRAS_SIN_CONTENIDO.has(palabra))
    .map(raizAproximada)
    .filter((palabra) => palabra.length >= 3);
  return new Set(conContenido);
}

// Similitud de Jaccard, con una salvedad: si un texto es (casi) un subconjunto del otro, un
// argumento corto copiado dentro de uno largo también cuenta como parecido.
export function calcularSimilitud(textoNuevo, textoExistente) {
  const palabrasA = extraerPalabrasConContenido(textoNuevo);
  const palabrasB = extraerPalabrasConContenido(textoExistente);
  if (
    palabrasA.size < MINIMO_DE_PALABRAS_CON_CONTENIDO_DEL_TEXTO_NUEVO ||
    palabrasB.size < MINIMO_DE_PALABRAS_CON_CONTENIDO_DEL_ARGUMENTO_EXISTENTE
  ) {
    return 0;
  }
  let enComun = 0;
  for (const palabra of palabrasA) {
    if (palabrasB.has(palabra)) {
      enComun += 1;
    }
  }
  const union = palabrasA.size + palabrasB.size - enComun;
  const jaccard = enComun / union;
  const contencion = enComun / Math.min(palabrasA.size, palabrasB.size);
  return Math.max(jaccard, contencion * 0.9);
}

// Devuelve el argumento existente más parecido si supera el umbral, o null.
export function buscarArgumentoParecido(texto, argumentosExistentes, umbral = UMBRAL_DE_SIMILITUD_POR_DEFECTO) {
  let mejor = null;
  for (const argumento of argumentosExistentes) {
    const similitud = calcularSimilitud(texto, argumento.texto);
    if (similitud >= umbral && (!mejor || similitud > mejor.similitud)) {
      mejor = { argumento, similitud };
    }
  }
  return mejor;
}
