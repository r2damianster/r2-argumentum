// Sugerencia de calificación para el control de lectura — ver docs/14-control-de-lectura.md.
//
// Groq SUGIERE un nivel por criterio de la rúbrica, un comentario por criterio, qué partes de la
// estructura aparecen en el texto y una confianza. No decide nada: lo ve solo el docente, de forma
// anónima (a Groq tampoco se le envía ningún nombre), y es él quien aprueba o corrige. El estudiante
// nunca ve esta sugerencia. Solo la puede pedir el host (el token de su sesión): protege la cuota y las
// claves de la lectura, que solo conoce el docente.

import { consultarGroqConReintentos } from './_consultarGroq.js';
import { sesionDelHostEsValida } from './_sesionDelHost.js';

// Duplica los códigos de src/shared/programa/idiomaDelDebate.js y los niveles de
// src/shared/nucleo/rubrica/rubrica.js: la carpeta api/ no importa código del cliente.
const NOMBRE_DEL_IDIOMA = { es: 'español', en: 'inglés' };
export const NIVELES_DE_LA_RUBRICA = ['excelente', 'bueno', 'aceptable', 'insuficiente'];

const MINIMO_DE_PALABRAS_PARA_CALIFICAR = 5;
const MAXIMO_DE_CRITERIOS = 14;
const MAXIMO_DE_CARACTERES_DEL_TEXTO = 12000;
const MAXIMO_DE_CARACTERES_DE_LAS_CLAVES = 4000;
const MAXIMO_DE_CARACTERES_DE_LA_CONSIGNA = 1500;
const MAXIMO_DE_CARACTERES_DEL_COMENTARIO = 400;
const MAXIMO_DE_CARACTERES_DEL_COMENTARIO_GENERAL = 600;

function recortar(valor, maximo) {
  return String(valor ?? '').trim().slice(0, maximo);
}

export function construirPromptDeCalificacion({ nombreDelIdioma, consigna, estructura, rubrica, claves }) {
  const descripcionDeLaEstructura =
    estructura?.partes?.length > 0
      ? `Estructura pedida: ${estructura.nombre}, en ${estructura.numeroDeParrafos} párrafo(s), ${
          estructura.distribucion === 'desarrollada'
            ? 'con una parte por párrafo'
            : 'con toda la estructura dentro de cada párrafo (una parte por oración)'
        }.\nPartes:\n${estructura.partes.map((parte) => `- ${parte.nombre}: ${parte.descripcion ?? ''}`).join('\n')}`
      : `Escritura libre en ${estructura?.numeroDeParrafos ?? 1} párrafo(s), sin estructura obligatoria.`;

  return `Eres un asistente que SUGIERE una calificación para un texto breve escrito por un estudiante, en ${nombreDelIdioma}.
El docente decide: tú no calificas de forma definitiva, solo propones para que él apruebe o corrija. El texto es anónimo.

Consigna que recibió el estudiante:
"${consigna}"

${descripcionDeLaEstructura}
${
  claves
    ? `\nIdeas clave de la lectura (solo como referencia para valorar si el texto trata el tópico con acierto; el estudiante no las conoce):\n${claves}\n`
    : ''
}
Rúbrica. Por cada criterio elige un nivel entre: excelente, bueno, aceptable, insuficiente.
${rubrica.map((criterio) => `- id "${criterio.id}" — ${criterio.nombre}: ${criterio.descripcion ?? ''}`).join('\n')}

Reglas:
- Valora lo que está escrito, no la postura ni si estás de acuerdo con el contenido.
- No inventes lo que el texto no dice. Si dudas entre dos niveles, elige el más bajo y baja la confianza.
- "comentariosPorCriterio": para cada criterio, una frase útil para el estudiante (qué está bien o qué mejorar), de máximo 30 palabras, en ${nombreDelIdioma}, dirigida a la persona («Tu texto…»). Sin números ni notas.
- "partesDetectadas": ${
    estructura?.partes?.length > 0
      ? 'por cada parte de la estructura, si aparece o no en el texto ("presente": true o false).'
      : 'lista vacía (no hay estructura).'
  }
- "comentarioGeneral": máximo 40 palabras en ${nombreDelIdioma}.
- "confianza": número entre 0 y 1 sobre qué tan segura es tu sugerencia en conjunto.
Devuelve SOLO JSON válido con esta forma exacta:
{"niveles": {"<id del criterio>": "excelente|bueno|aceptable|insuficiente"}, "comentariosPorCriterio": {"<id del criterio>": "..."}, "partesDetectadas": [{"nombre": "...", "presente": true}], "comentarioGeneral": "...", "confianza": 0.0}`;
}

function limitarConfianza(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : null;
}

// Segunda red tras el modelo: solo sale lo que el cliente puede mostrar. Un criterio inventado o un
// nivel que no existe se descarta; una parte de la estructura que no se pidió, también.
export function normalizarSugerenciaDeCalificacion(resultado, { rubrica, estructura }) {
  const idsDeCriterios = new Set(rubrica.map((criterio) => criterio.id));

  const niveles = {};
  for (const [criterioId, nivel] of Object.entries(resultado?.niveles ?? {})) {
    if (idsDeCriterios.has(criterioId) && NIVELES_DE_LA_RUBRICA.includes(nivel)) {
      niveles[criterioId] = nivel;
    }
  }

  const comentariosPorCriterio = {};
  for (const [criterioId, comentario] of Object.entries(resultado?.comentariosPorCriterio ?? {})) {
    const texto = recortar(comentario, MAXIMO_DE_CARACTERES_DEL_COMENTARIO);
    if (idsDeCriterios.has(criterioId) && texto) {
      comentariosPorCriterio[criterioId] = texto;
    }
  }

  const nombresDeLasPartes = new Set((estructura?.partes ?? []).map((parte) => parte.nombre));
  const partesDetectadas = (Array.isArray(resultado?.partesDetectadas) ? resultado.partesDetectadas : [])
    .filter((parte) => nombresDeLasPartes.has(parte?.nombre) && typeof parte.presente === 'boolean')
    .map((parte) => ({ nombre: parte.nombre, presente: parte.presente }));

  return {
    niveles,
    comentariosPorCriterio,
    partesDetectadas,
    comentarioGeneral: recortar(resultado?.comentarioGeneral, MAXIMO_DE_CARACTERES_DEL_COMENTARIO_GENERAL),
    confianza: limitarConfianza(resultado?.confianza),
    // Con algún criterio sin nivel la sugerencia no sirve para aprobar «tal cual».
    completa: rubrica.every((criterio) => Boolean(niveles[criterio.id])),
  };
}

export function contarPalabras(texto) {
  return (String(texto ?? '').match(/[\p{L}\p{N}]+/gu) ?? []).length;
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

  const { hostToken, texto, consigna, estructura, rubrica, claves = '', idioma } = request.body ?? {};
  if (!sesionDelHostEsValida(hostToken, process.env.HOST_PASSWORD)) {
    response.status(401).json({ error: 'Solo el docente moderador puede pedir una sugerencia de calificación' });
    return;
  }
  if (!Array.isArray(rubrica) || rubrica.length === 0 || rubrica.length > MAXIMO_DE_CRITERIOS) {
    response.status(400).json({ error: 'La rúbrica es obligatoria (entre 1 y 14 criterios)' });
    return;
  }
  if (!String(consigna ?? '').trim()) {
    response.status(400).json({ error: 'Falta la consigna' });
    return;
  }

  // Un texto casi vacío no se manda a Groq: no hay nada que valorar y el docente lo ve a simple vista.
  if (contarPalabras(texto) < MINIMO_DE_PALABRAS_PARA_CALIFICAR) {
    response.status(200).json({ sugerencia: null, motivo: 'texto_muy_corto' });
    return;
  }

  const rubricaLimpia = rubrica.map((criterio) => ({
    id: recortar(criterio?.id, 40),
    nombre: recortar(criterio?.nombre, 80),
    descripcion: recortar(criterio?.descripcion, 240),
  }));
  const estructuraLimpia = {
    nombre: recortar(estructura?.nombre, 60),
    numeroDeParrafos: Math.max(1, Math.floor(Number(estructura?.numeroDeParrafos) || 1)),
    distribucion: estructura?.distribucion === 'desarrollada' ? 'desarrollada' : 'compacta',
    partes: (Array.isArray(estructura?.partes) ? estructura.partes : []).slice(0, 12).map((parte) => ({
      nombre: recortar(parte?.nombre, 60),
      descripcion: recortar(parte?.descripcion, 200),
    })),
  };
  const idiomaDelTexto = NOMBRE_DEL_IDIOMA[idioma] ? idioma : 'es';

  const cuerpoDeLaPeticion = JSON.stringify({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: construirPromptDeCalificacion({
          nombreDelIdioma: NOMBRE_DEL_IDIOMA[idiomaDelTexto],
          consigna: recortar(consigna, MAXIMO_DE_CARACTERES_DE_LA_CONSIGNA),
          estructura: estructuraLimpia,
          rubrica: rubricaLimpia,
          claves: recortar(claves, MAXIMO_DE_CARACTERES_DE_LAS_CLAVES),
        }),
      },
      { role: 'user', content: recortar(texto, MAXIMO_DE_CARACTERES_DEL_TEXTO) },
    ],
    // Temperatura 0: el mismo texto tiene que dar la misma sugerencia (ver groq-validar-argumento).
    temperature: 0,
    top_p: 1,
    seed: 7,
    // `reasoning_effort: 'low'`: con el esfuerzo por defecto el modelo gastaba ~1.000–1.400 tokens «pensando» antes de
    // responder. Medido el 4-oct-2026 con 3 textos (bueno, flojo, fuera de tema): el total por sugerencia bajó de
    // ~1.500–2.400 a ~900–1.000 tokens y los niveles salieron iguales (salvo 2 criterios de formato en el texto
    // fuera de tema). Con el límite de 8.000 tokens por minuto del plan gratuito, es ~2 veces más sugerencias.
    reasoning_effort: 'low',
    max_tokens: 1800,
    response_format: { type: 'json_object' },
  });

  const consulta = await consultarGroqConReintentos(cuerpoDeLaPeticion);
  if (consulta.error) {
    // Un límite de tasa de Groq se responde como 429 con la espera que pidió, para que la cola del docente se
    // pause ese tiempo (el plan gratuito da unas 5 sugerencias por minuto) en vez de reintentar a ciegas.
    if (consulta.estado === 429) {
      response.status(429).json({ error: consulta.error, reintentarEnSegundos: consulta.reintentarEnSegundos ?? null });
      return;
    }
    response.status(502).json({ error: consulta.error, detalle: consulta.detalle });
    return;
  }

  response.status(200).json({
    sugerencia: normalizarSugerenciaDeCalificacion(consulta.resultado, { rubrica: rubricaLimpia, estructura: estructuraLimpia }),
  });
}
