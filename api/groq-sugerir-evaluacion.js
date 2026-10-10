// Sugerencia de evaluación para las actividades escritas (foro) — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Es el mismo checkpoint 1 de Groq, ampliado: además de la forma, SUGIERE si el aporte está completo,
// incompleto o sin razón, y señala posibles falacias. Groq nunca puntúa ni decide: lo que devuelve
// lo ven quien escribe (para mejorar), los co-moderadores y el moderador (para decidir). Todo se
// presenta como «sugerencia» y, ante la duda, no se señala nada.

import { revisarFormaMinima } from './_revisarFormaMinima.js';
import { consultarGroqConReintentos } from './_consultarGroq.js';

// Duplica los códigos de src/shared/programa/idiomaDelDebate.js y las etiquetas de
// src/shared/nucleo/sugerenciaDeIA/: la carpeta api/ no importa código del cliente.
const NOMBRE_DEL_IDIOMA = { es: 'español', en: 'inglés' };

export const COMPLETITUDES = ['completo', 'incompleto', 'sin_razon'];

export const TIPOS_DE_FALACIA = [
  'ad_hominem',
  'falsa_dicotomia',
  'generalizacion_apresurada',
  'hombre_de_paja',
  'apelacion_a_autoridad',
  'apelacion_a_la_mayoria',
  'pendiente_resbaladiza',
  'razonamiento_circular',
  'falsa_causa',
];

const MAXIMO_DE_FALACIAS_SUGERIDAS = 3;
// Por debajo de esta confianza una falacia no se señala: equivocarse acusando a alguien de una
// falacia que no cometió cuesta más que dejar pasar una dudosa.
const CONFIANZA_MINIMA_PARA_SENALAR_UNA_FALACIA = 0.6;

// Criterios adicionales que el moderador activó para la sesión. El texto lo escribe el docente en el
// Programa; aun así se acota para que una lista enorme no infle el prompt.
const MAXIMO_DE_CRITERIOS_PEDIDOS = 3;
const CONFIANZA_MINIMA_PARA_SENALAR_UN_CRITERIO = 0.6;

export function limpiarCriteriosPedidos(criterios) {
  return (Array.isArray(criterios) ? criterios : [])
    .map((criterio) => ({
      id: String(criterio?.id ?? '').trim().slice(0, 40),
      etiqueta: String(criterio?.etiqueta ?? '').trim().slice(0, 80),
      descripcion: String(criterio?.descripcion ?? '').trim().slice(0, 240),
    }))
    .filter((criterio) => criterio.id && criterio.etiqueta)
    .slice(0, MAXIMO_DE_CRITERIOS_PEDIDOS);
}

function formatearTareaDeCriterios(criterios) {
  if (criterios.length === 0) {
    return '';
  }
  const lista = criterios
    .map((criterio) => `- id "${criterio.id}": ${criterio.etiqueta}${criterio.descripcion ? ` (${criterio.descripcion})` : ''}`)
    .join('\n');
  return `
TAREA 3 — Criterios adicionales. El docente pidió además lo siguiente; por cada uno indica si el aporte lo CUMPLE
("cumple": true) o no ("cumple": false), con su "confianza". Es independiente de la completitud y de la postura.
Si dudas, baja la confianza.
${lista}
`;
}

export function construirPromptDeEvaluacion({ nombreDelIdioma, ejemplosFormateados, textoDelObjetivo, criterios = [] }) {
  return `Eres un asistente que SUGIERE una evaluación de aportes escritos en un foro, en ${nombreDelIdioma}. Quien modera
decide: tú no puntúas ni decides nada, solo ayudas a quien escribe y a quien revisa.

TAREA 1 — Completitud. Elige una:
- "completo": tiene una afirmación clara y al menos una razón, dato, ejemplo o consecuencia que la sostiene.
- "incompleto": tiene una afirmación, pero la razón es vaga, no sostiene lo afirmado, o falta algo para entenderla.
- "sin_razon": solo opina o declara, sin ninguna razón, dato o ejemplo.
Una réplica (apoyar, contradecir, plantear un dilema, conceder o preguntar) es completa si deja claro a qué
responde y por qué. Juzga la ESTRUCTURA, nunca si estás de acuerdo con el contenido ni la postura.

TAREA 2 — Posibles falacias.
Señala una falacia SOLO si es clara en el texto. Si dudas, NO la señales. Tipos permitidos (usa estos ids exactos):
${TIPOS_DE_FALACIA.map((tipo) => `- ${tipo}`).join('\n')}
Por cada falacia da el "fragmento" textual exacto del aporte donde ocurre (copiado tal cual) y una "explicacion"
de máximo 20 palabras. Máximo ${MAXIMO_DE_FALACIAS_SUGERIDAS} falacias. Un texto sin falacias devuelve una lista vacía.
${formatearTareaDeCriterios(criterios)}${
  textoDelObjetivo
    ? `\nEl aporte es una réplica al siguiente texto (solo como contexto para entenderla, no lo juzgues):\n"${textoDelObjetivo}"\n`
    : ''
}
${ejemplosFormateados}

Escribe "comentario" (máximo 25 palabras, útil para quien escribe: qué mejorar o qué está bien) y las explicaciones en ${nombreDelIdioma}.
Devuelve SOLO JSON válido con esta forma exacta:
{"completitud": "completo|incompleto|sin_razon", "falacias": [{"tipo": "id", "fragmento": "texto exacto", "explicacion": "...", "confianza": number entre 0 y 1}], "criterios": [{"id": "id del criterio", "cumple": boolean, "confianza": number entre 0 y 1}], "comentario": "...", "confianza": number entre 0 y 1}
Si no hay criterios adicionales, "criterios" es una lista vacía.`;
}

function limitarConfianza(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : null;
}

// Segunda red tras el modelo: solo sale lo que el cliente puede mostrar y tiene sentido. Una falacia
// con tipo inventado, sin confianza suficiente o cuyo fragmento no está en el texto se descarta (el
// modelo a veces «cita» algo que el aporte no dice).
export function normalizarSugerencia(resultado, textoDelAporte, criteriosPedidos = []) {
  const completitud = COMPLETITUDES.includes(resultado?.completitud) ? resultado.completitud : null;
  const textoEnMinusculas = String(textoDelAporte ?? '').toLowerCase();

  const falacias = (Array.isArray(resultado?.falacias) ? resultado.falacias : [])
    .filter((falacia) => TIPOS_DE_FALACIA.includes(falacia?.tipo))
    .map((falacia) => ({
      tipo: falacia.tipo,
      fragmento: String(falacia.fragmento ?? '').trim(),
      explicacion: String(falacia.explicacion ?? '').trim(),
      confianza: limitarConfianza(falacia.confianza),
    }))
    .filter((falacia) => falacia.confianza !== null && falacia.confianza >= CONFIANZA_MINIMA_PARA_SENALAR_UNA_FALACIA)
    .filter((falacia) => falacia.fragmento && textoEnMinusculas.includes(falacia.fragmento.toLowerCase()))
    .slice(0, MAXIMO_DE_FALACIAS_SUGERIDAS);

  // Solo salen los criterios que se pidieron (la etiqueta viaja con el resultado para mostrarlo sin el
  // Programa) y con confianza suficiente: ante la duda no se señala nada, igual que con las falacias.
  const criterios = (Array.isArray(resultado?.criterios) ? resultado.criterios : [])
    .map((criterio) => ({
      pedido: criteriosPedidos.find((candidato) => candidato.id === criterio?.id),
      cumple: criterio?.cumple,
      confianza: limitarConfianza(criterio?.confianza),
    }))
    .filter(
      (criterio) =>
        criterio.pedido &&
        typeof criterio.cumple === 'boolean' &&
        criterio.confianza !== null &&
        criterio.confianza >= CONFIANZA_MINIMA_PARA_SENALAR_UN_CRITERIO
    )
    .map(({ pedido, cumple, confianza }) => ({ id: pedido.id, etiqueta: pedido.etiqueta, cumple, confianza }));

  return {
    completitud,
    falacias,
    criterios,
    comentario: String(resultado?.comentario ?? '').trim(),
    confianza: limitarConfianza(resultado?.confianza),
  };
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

  const { texto, ejemplos = [], idioma, textoDelObjetivo = '', criterios = [] } = request.body ?? {};
  const criteriosPedidos = limpiarCriteriosPedidos(criterios);
  const idiomaDelDebate = NOMBRE_DEL_IDIOMA[idioma] ? idioma : 'es';

  // Antes de gastar una llamada: un texto sin razón real no se manda a Groq.
  const formaMinima = revisarFormaMinima(texto, idiomaDelDebate);
  if (!formaMinima.valido) {
    response.status(200).json({ formaMinima, sugerencia: null });
    return;
  }

  const ejemplosFormateados = ejemplos
    .map(
      (ejemplo, indice) =>
        `Ejemplo ${indice + 1}:\nMalo: "${ejemplo.malo}"\nBueno: "${ejemplo.bueno}"\nPor qué: ${ejemplo.porque}`
    )
    .join('\n\n');

  const cuerpoDeLaPeticion = JSON.stringify({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: construirPromptDeEvaluacion({
          nombreDelIdioma: NOMBRE_DEL_IDIOMA[idiomaDelDebate],
          ejemplosFormateados,
          textoDelObjetivo: String(textoDelObjetivo).slice(0, 600),
          criterios: criteriosPedidos,
        }),
      },
      { role: 'user', content: texto },
    ],
    // Temperatura 0: el mismo aporte tiene que dar la misma sugerencia (ver groq-validar-argumento).
    temperature: 0,
    top_p: 1,
    seed: 7,
    // El modelo razona antes de responder; con un tope bajo el JSON se corta (ver groq-validar-argumento).
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const consulta = await consultarGroqConReintentos(cuerpoDeLaPeticion);
  if (consulta.error) {
    response.status(502).json({ error: consulta.error, detalle: consulta.detalle });
    return;
  }

  response.status(200).json({
    formaMinima,
    sugerencia: normalizarSugerencia(consulta.resultado, texto, criteriosPedidos),
  });
}
