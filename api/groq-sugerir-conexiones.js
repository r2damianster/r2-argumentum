// Checkpoint 2 de Groq (ver docs/02-arquitectura.md): UNA sola llamada por ronda,
// disparada manualmente por el moderador al cerrar la fase de escritura.
// Nunca se llama por cada clic de conexión individual.

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

  let respuestaGroq;
  let datos;
  try {
    respuestaGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: listaDeArgumentos },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });
    datos = await respuestaGroq.json();
  } catch (error) {
    response.status(502).json({ error: 'No se pudo contactar a Groq', detalle: String(error) });
    return;
  }

  if (!respuestaGroq.ok) {
    response.status(502).json({ error: 'Groq devolvió un error', detalle: datos });
    return;
  }

  try {
    const resultado = JSON.parse(datos.choices[0].message.content);
    response.status(200).json(resultado);
  } catch (error) {
    response.status(502).json({ error: 'Groq no devolvió JSON válido', detalle: datos });
  }
}
