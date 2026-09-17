// Checkpoint 1 de Groq (ver docs/02-arquitectura.md): valida forma del argumento,
// no su profundidad filosófica. Criterio: ¿tiene claim + razón?

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    response.status(500).json({ error: 'GROQ_API_KEY no configurada en el entorno' });
    return;
  }

  const { texto, ejemplos = [] } = request.body;

  const ejemplosFormateados = ejemplos
    .map(
      (ejemplo, indice) =>
        `Ejemplo ${indice + 1}:\nMalo: "${ejemplo.malo}"\nBueno: "${ejemplo.bueno}"\nPor qué: ${ejemplo.porque}`
    )
    .join('\n\n');

  const promptSistema = `Eres un validador de FORMA de argumentos en español, no un juez de contenido.
Tu único criterio: ¿el texto tiene una afirmación (claim) y al menos una razón, causa o consecuencia
que la sustente? Evaluá la ESTRUCTURA LÓGICA (claim + razón), NUNCA exijas una palabra exacta.
Cualquiera de estas formas cuenta como razón válida, entre muchas otras posibles:
- Conectores causales: "porque", "ya que", "debido a", "esto se debe a", "dado que".
- Conectores consecutivos: "por lo tanto", "esto implica", "lo que provoca/genera/retrasa/reduce...".
- Una evidencia, dato, ejemplo o comparación concreta, incluso sin conector explícito.
Si hay una relación causa-efecto identificable en el texto, aprobalo aunque no use "porque"/"ya que"
literalmente. Rechazá solo si es una afirmación sin ninguna razón, causa, consecuencia o evidencia.
No evalúes profundidad filosófica ni si estás de acuerdo con el contenido, solo la forma.

${ejemplosFormateados}

Devuelve SOLO JSON válido con esta forma exacta:
{"aprobado": boolean, "motivo": "máximo 20 palabras", "sugerenciaDeCorreccion": "vacío si aprobado es true"}`;

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
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: texto },
        ],
        temperature: 0.2,
        max_tokens: 600,
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
