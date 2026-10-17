// Checkpoint 1 de Groq (ver docs/02-arquitectura.md). Hace dos cosas, ninguna de ellas juzgar
// si el argumento es "bueno":
//   1. Valida la FORMA: ¿tiene claim + razón?
//   2. Clasifica a qué postura del debate pertenece, o avisa que no encaja en ninguna.
// Quién puede proponer una postura nueva lo decide el cliente según `permitirPosturasNuevas`
// del Programa — aquí solo se informa el hallazgo.

import { revisarFormaMinima } from './_revisarFormaMinima.js';
import { consultarGroqConEsquema } from './_consultarGroq.js';

export const ESQUEMA_DE_VALIDACION = {
  type: 'object',
  properties: {
    aprobado: { type: 'boolean' },
    motivo: { type: 'string' },
    sugerenciaDeCorreccion: { type: 'string' },
    posturaDetectada: { type: ['string', 'null'] },
    esPosturaNueva: { type: 'boolean' },
    posturaSugerida: { type: 'string' },
    confianza: { type: 'number' },
  },
  required: [
    'aprobado',
    'motivo',
    'sugerenciaDeCorreccion',
    'posturaDetectada',
    'esPosturaNueva',
    'posturaSugerida',
    'confianza',
  ],
  additionalProperties: false,
};

// Patrón de escritura opcional (PEEL, CER, Toulmin…): el moderador lo pide y la IA solo SUGIERE cuáles partes se
// detectaron, en la misma llamada (sin gastar otra). No cambia `aprobado` ni puntúa. Ante la duda no señala nada.
const MAXIMO_DE_PARTES_DEL_PATRON = 8;
const MAXIMO_DE_CARACTERES_DE_UN_TEXTO_DEL_PATRON = 200;
export const CONFIANZA_MINIMA_DEL_PATRON = 0.6;

function acotarTexto(valor) {
  return String(valor ?? '').trim().slice(0, MAXIMO_DE_CARACTERES_DE_UN_TEXTO_DEL_PATRON);
}

// Devuelve { nombre, partes: [{ nombre, descripcion }] } limpio, o null si el cliente no mandó un patrón usable.
export function normalizarPatronRecibido(patron) {
  const partes = Array.isArray(patron?.partes)
    ? patron.partes
        .slice(0, MAXIMO_DE_PARTES_DEL_PATRON)
        .map((parte) => ({ nombre: acotarTexto(parte?.nombre), descripcion: acotarTexto(parte?.descripcion) }))
        .filter((parte) => parte.nombre)
    : [];
  return partes.length > 0 ? { nombre: acotarTexto(patron?.nombre), partes } : null;
}

// Sin patrón el esquema es el de siempre: no cambia ni el costo ni el comportamiento de las salas que no lo piden.
export function esquemaDeValidacion(patron) {
  if (!patron) {
    return ESQUEMA_DE_VALIDACION;
  }
  return {
    ...ESQUEMA_DE_VALIDACION,
    properties: {
      ...ESQUEMA_DE_VALIDACION.properties,
      partesPresentes: { type: 'array', items: { type: 'string' } },
      confianzaDelPatron: { type: 'number' },
    },
    required: [...ESQUEMA_DE_VALIDACION.required, 'partesPresentes', 'confianzaDelPatron'],
  };
}

// De la respuesta del modelo, solo lo que se puede afirmar: partes que existen en el patrón y confianza suficiente.
export function interpretarPatronDetectado(patron, resultado) {
  if (!patron || typeof resultado?.confianzaDelPatron !== 'number' || resultado.confianzaDelPatron < CONFIANZA_MINIMA_DEL_PATRON) {
    return null;
  }
  const nombresValidos = patron.partes.map((parte) => parte.nombre);
  const mencionadas = new Set(Array.isArray(resultado.partesPresentes) ? resultado.partesPresentes : []);
  const partesPresentes = nombresValidos.filter((nombre) => mencionadas.has(nombre));
  return {
    nombre: patron.nombre,
    partesPresentes,
    partesFaltantes: nombresValidos.filter((nombre) => !partesPresentes.includes(nombre)),
    confianza: resultado.confianzaDelPatron,
  };
}

// Idioma en que se escribe el debate (lo fija el docente en el Programa). Duplica los códigos de
// src/shared/programa/idiomaDelDebate.js: la carpeta api/ no importa código del cliente.
const INSTRUCCIONES_POR_IDIOMA = {
  es: {
    nombre: 'español',
    conectores: '"porque", "ya que", "debido a", "esto se debe a", "dado que"',
    consecutivos: '"por lo tanto", "esto implica", "lo que provoca/genera/retrasa/reduce..."',
  },
  en: {
    nombre: 'inglés',
    conectores: '"because", "since", "due to", "this is because", "given that"',
    consecutivos: '"therefore", "this implies", "which causes/leads to/delays/reduces..."',
  },
};

// Groq a veces devuelve en "posturaSugerida" el id técnico de una postura inventada
// ("homo_scientificus") en vez de una etiqueta legible, y ese texto va derecho a la pantalla
// del estudiante. Si coincide con una postura real se usa su etiqueta; si no, al menos se
// limpia el formato de id. Bug real reportado en prueba en vivo.
function etiquetaLegibleDePostura(posturaSugerida, posturas) {
  const texto = String(posturaSugerida ?? '').trim();
  if (!texto) {
    return '';
  }
  const posturaConocida = posturas.find((postura) => postura.id === texto);
  if (posturaConocida) {
    return posturaConocida.etiqueta;
  }
  return texto.includes('_') && !texto.includes(' ') ? texto.replace(/_/g, ' ') : texto;
}

function construirBloqueDelPatron(patron, instruccionesDelIdioma) {
  if (!patron) {
    return '';
  }
  const partes = patron.partes
    .map((parte, indice) => `${indice + 1}. "${parte.nombre}"${parte.descripcion ? `: ${parte.descripcion}` : ''}`)
    .join('\n');
  return `TAREA 3 — Detectar un patrón de escritura (solo una ayuda; NO cambia "aprobado").
El moderador pidió que el argumento siga el patrón ${patron.nombre || 'indicado'}. Partes:
${partes}
En "partesPresentes" devuelve los nombres EXACTOS (tal como están entre comillas) de las partes que el texto cumple.
Reconoce cada parte por su FUNCIÓN, no por palabras literales: una oración, una frase o una analogía breve bastan
(por ejemplo, un matiz como "por lo general" o "en la mayoría de los casos" cumple un calificador; una condición como
"salvo que" o "podría bastar si" cumple una refutación; una comparación con otro ámbito cumple un respaldo), aunque el
texto no nombre la parte ni siga el orden. Recorre las partes UNA POR UNA antes de responder. Un argumento corto puede
usar pocas partes: eso es normal. No juzgues si el contenido es correcto, solo si la parte está. Omite una parte solo
si en el texto no hay nada que cumpla su función; si dudas del conjunto, baja "confianzaDelPatron" (0 a 1).
Escribe los nombres de las partes en ${instruccionesDelIdioma.nombre}, tal como se te dieron.

`;
}

export function construirPromptSistema({ instruccionesDelIdioma, posturasFormateadas, ejemplosFormateados, patron = null }) {
  return `Eres un validador de FORMA de argumentos escritos en ${instruccionesDelIdioma.nombre}, no un juez de contenido.

TAREA 1 — Validar la forma.
Tu único criterio: ¿el texto tiene una afirmación (claim) y al menos una razón, causa o consecuencia
que la sustente? Evalúa la ESTRUCTURA LÓGICA (claim + razón), NUNCA exijas una palabra exacta.
Cualquiera de estas formas cuenta como razón válida, entre muchas otras posibles:
- Conectores causales: ${instruccionesDelIdioma.conectores}.
- Conectores consecutivos: ${instruccionesDelIdioma.consecutivos}.
- Una evidencia, dato, ejemplo o comparación concreta, incluso sin conector explícito.
- Un DILEMA también es una forma válida: plantea dos efectos, consecuencias o alternativas en tensión
  ("si X entonces Y, pero también Z") con o sin pregunta final ("¿qué conviene más?").
  No exijas un conector causal a un dilema: su fuerza está en la contradicción entre dos
  efectos, no en la causalidad de uno solo. Rechaza preguntas vacías sin contenido argumental ni efectos contrapuestos.
Si hay una relación causa-efecto o dilema identificable en el texto, apruébalo aunque no use ningún conector
literalmente. Recházalo solo si es una afirmación sin ninguna razón, causa, consecuencia, evidencia o dilema.
No evalúes profundidad filosófica ni si estás de acuerdo con el contenido, solo la forma.

TAREA 2 — Clasificar la postura.
Estas son las posturas que se debaten:
${posturasFormateadas || '(no se informaron posturas: devuelve posturaDetectada null y esPosturaNueva false)'}

Decide cuál de esas posturas defiende el texto. Reglas:
- Si defiende claramente una de la lista, devuelve su id exacto en "posturaDetectada".
- Si defiende una posición coherente pero que NO corresponde a ninguna de la lista, devuelve
  "posturaDetectada": null y "esPosturaNueva": true, y describe esa posición en "posturaSugerida".
- No fuerces la clasificación: si dudas entre dos, elige la más cercana y baja la "confianza".
- Si el texto es condicional, matizado o depende de circunstancias ("depende de…", "en algunos
  casos sí y en otros no"), no lo asignes con seguridad: devuelve "confianza" por debajo de 0.6.
  Contradecir al estudiante sobre qué está defendiendo cuesta más caro que dejarlo pasar.
- La clasificación es independiente de la forma: un texto puede tener mala forma y aun así
  dejar clara su postura.
- "posturaSugerida" se usa TAL CUAL en una frase que lee el estudiante: escríbela como una
  etiqueta corta en ${instruccionesDelIdioma.nombre}, legible, nunca como un identificador técnico con guiones bajos.

${construirBloqueDelPatron(patron, instruccionesDelIdioma)}${ejemplosFormateados}

Escribe "motivo", "sugerenciaDeCorreccion" y "posturaSugerida" en ${instruccionesDelIdioma.nombre}, el mismo idioma del argumento.
Devuelve SOLO JSON válido con esta forma exacta:
{"aprobado": boolean, "motivo": "máximo 20 palabras", "sugerenciaDeCorreccion": "vacío si aprobado es true", "posturaDetectada": "id o null", "esPosturaNueva": boolean, "posturaSugerida": "etiqueta corta o vacío", "confianza": number entre 0 y 1${patron ? ', "partesPresentes": ["nombres exactos de las partes detectadas"], "confianzaDelPatron": number entre 0 y 1' : ''}}`;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    response.status(500).json({ error: 'GROQ_API_KEY no configurada en el entorno' });
    return;
  }

  const { texto, ejemplos = [], posturas = [], idioma, razonamiento } = request.body;
  const patron = normalizarPatronRecibido(request.body.patron);
  const instruccionesDelIdioma = INSTRUCCIONES_POR_IDIOMA[idioma] ?? INSTRUCCIONES_POR_IDIOMA.es;

  // Antes de gastar una llamada: un texto sin razón real ("... porque ....") no se manda a
  // Groq, que podía aprobarlo solo por ver el conector.
  const revisionMinima = revisarFormaMinima(texto, INSTRUCCIONES_POR_IDIOMA[idioma] ? idioma : 'es');
  if (!revisionMinima.valido) {
    response.status(200).json({
      aprobado: false,
      motivo: revisionMinima.motivo,
      sugerenciaDeCorreccion: revisionMinima.sugerencia,
      posturaDetectada: null,
      esPosturaNueva: false,
      posturaSugerida: '',
      confianza: null,
    });
    return;
  }

  const ejemplosFormateados = ejemplos
    .map(
      (ejemplo, indice) =>
        `Ejemplo ${indice + 1}:\nMalo: "${ejemplo.malo}"\nBueno: "${ejemplo.bueno}"\nPor qué: ${ejemplo.porque}`
    )
    .join('\n\n');

  const posturasFormateadas = posturas
    .map((postura) => `- id: "${postura.id}" → ${postura.etiqueta}`)
    .join('\n');

  const promptSistema = construirPromptSistema({ instruccionesDelIdioma, posturasFormateadas, ejemplosFormateados, patron });

  const consulta = await consultarGroqConEsquema(
    {
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: texto },
      ],
      // Temperatura 0: el mismo argumento tiene que dar el mismo veredicto. Con 0.2 el
      // mismo texto pasaba de "postura nueva" a aprobado al reenviarlo, y eso el estudiante
      // lo lee como arbitrariedad. Bug real reportado en prueba en vivo.
      temperature: 0,
      seed: 7,
      // `reasoning_effort: 'low'` solo si el cliente lo pide (modo de sala grande): medido el 11-oct-2026 con 15 textos,
      // ahorra ~18 % de tokens pero cambia veredictos (aprobó un texto sin razón y movió la postura de otro). En sala
      // pequeña un veredicto inestable se lee como arbitrariedad; en sala grande el límite de tokens por minuto pesa más.
      ...(razonamiento === 'bajo' ? { reasoning_effort: 'low' } : {}),
      // El modelo razona antes de responder y esos tokens cuentan contra el tope: con 800, un
      // argumento largo podía cortar el JSON a la mitad y el estudiante veía "el validador no
      // respondió". Reporte de prueba en vivo con 8 participantes.
      max_tokens: 1500,
    },
    { nombre: 'validacion_de_argumento', esquema: esquemaDeValidacion(patron) }
  );
  if (consulta.error) {
    response.status(502).json({ error: consulta.error, detalle: consulta.detalle });
    return;
  }

  const { resultado } = consulta;
  // Groq a veces devuelve el id de una postura que no existe. Se normaliza aquí para que el
  // cliente nunca reciba un stanceId inventado.
  const idsValidos = new Set(posturas.map((postura) => postura.id));
  const posturaDetectada = idsValidos.has(resultado.posturaDetectada) ? resultado.posturaDetectada : null;

  response.status(200).json({
    aprobado: Boolean(resultado.aprobado),
    motivo: resultado.motivo ?? '',
    sugerenciaDeCorreccion: resultado.sugerenciaDeCorreccion ?? '',
    posturaDetectada,
    esPosturaNueva: posturaDetectada === null && Boolean(resultado.esPosturaNueva),
    posturaSugerida: etiquetaLegibleDePostura(resultado.posturaSugerida, posturas),
    confianza: typeof resultado.confianza === 'number' ? resultado.confianza : null,
    ...(patron ? { patron: interpretarPatronDetectado(patron, resultado) } : {}),
  });
}
