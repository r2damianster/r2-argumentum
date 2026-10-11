// Checkpoint 2 de Groq (ver docs/02-arquitectura.md): UNA sola llamada por ronda,
// disparada manualmente por el moderador al cerrar la fase de escritura.
// Nunca se llama por cada clic de conexión individual.

import { consultarGroqConEsquema } from './_consultarGroq.js';

export const ESQUEMA_DE_SUGERENCIAS = {
  type: 'object',
  properties: {
    sugerencias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceArgumentId: { type: 'string' },
          targetArgumentId: { type: 'string' },
          tipoDeRelacion: { type: 'string', enum: ['refuerzo', 'contraargumento', 'dilema', 'conexion'] },
          confianza: { type: 'number' },
        },
        required: ['sourceArgumentId', 'targetArgumentId', 'tipoDeRelacion', 'confianza'],
        additionalProperties: false,
      },
    },
  },
  required: ['sugerencias'],
  additionalProperties: false,
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    response.status(500).json({ error: 'GROQ_API_KEY no configurada en el entorno' });
    return;
  }

  const { argumentos = [] } = request.body;

  const listaDeArgumentos = argumentos
    .map((argumento) => `[${argumento.argumentId}] ${argumento.texto}`)
    .join('\n');

  const promptSistema = `Eres un analista de estructura argumental en español. Recibes una lista de
argumentos identificados por su id. Propón relaciones plausibles entre ellos: refuerzo,
contraargumento, dilema o conexion. No decidas cuál argumento es "correcto", solo identifica
relaciones estructurales entre las ideas.

Devuelve SOLO un JSON con esta forma exacta:
{"sugerencias": [{"sourceArgumentId": "...", "targetArgumentId": "...", "tipoDeRelacion": "refuerzo|contraargumento|dilema|conexion", "confianza": 0.0}]}`;

  const consulta = await consultarGroqConEsquema(
    {
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: listaDeArgumentos },
      ],
      temperature: 0,
      seed: 7,
      max_tokens: 1500,
    },
    { nombre: 'sugerencias_de_conexiones', esquema: ESQUEMA_DE_SUGERENCIAS }
  );
  if (consulta.error) {
    response.status(502).json({ error: consulta.error, detalle: consulta.detalle });
    return;
  }

  // Groq inventa o recorta ids con frecuencia. Una sugerencia que nombra un argumento
  // inexistente no se puede dibujar ni aceptar: se descarta aquí en vez de viajar al canal
  // y quedar como una arista colgada en el mapa.
  const idsValidos = new Set(argumentos.map((argumento) => argumento.argumentId));
  const sugerencias = (consulta.resultado?.sugerencias || []).filter(
    (sugerencia) =>
      idsValidos.has(sugerencia.sourceArgumentId) &&
      idsValidos.has(sugerencia.targetArgumentId) &&
      sugerencia.sourceArgumentId !== sugerencia.targetArgumentId
  );
  response.status(200).json({ sugerencias });
}
