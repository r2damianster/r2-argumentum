// Checkpoint 1 de Groq (ver docs/02-arquitectura.md). Hace dos cosas, ninguna de ellas juzgar
// si el argumento es "bueno":
//   1. Valida la FORMA: ¿tiene claim + razón?
//   2. Clasifica a qué postura del debate pertenece, o avisa que no encaja en ninguna.
// Quién puede proponer una postura nueva lo decide el cliente según `permitirPosturasNuevas`
// del Programa — acá solo se informa el hallazgo.

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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    response.status(500).json({ error: 'GROQ_API_KEY no configurada en el entorno' });
    return;
  }

  const { texto, ejemplos = [], posturas = [] } = request.body;

  const ejemplosFormateados = ejemplos
    .map(
      (ejemplo, indice) =>
        `Ejemplo ${indice + 1}:\nMalo: "${ejemplo.malo}"\nBueno: "${ejemplo.bueno}"\nPor qué: ${ejemplo.porque}`
    )
    .join('\n\n');

  const posturasFormateadas = posturas
    .map((postura) => `- id: "${postura.id}" → ${postura.etiqueta}`)
    .join('\n');

  const promptSistema = `Eres un validador de FORMA de argumentos en español, no un juez de contenido.

TAREA 1 — Validar la forma.
Tu único criterio: ¿el texto tiene una afirmación (claim) y al menos una razón, causa o consecuencia
que la sustente? Evalúa la ESTRUCTURA LÓGICA (claim + razón), NUNCA exijas una palabra exacta.
Cualquiera de estas formas cuenta como razón válida, entre muchas otras posibles:
- Conectores causales: "porque", "ya que", "debido a", "esto se debe a", "dado que".
- Conectores consecutivos: "por lo tanto", "esto implica", "lo que provoca/genera/retrasa/reduce...".
- Una evidencia, dato, ejemplo o comparación concreta, incluso sin conector explícito.
Si hay una relación causa-efecto identificable en el texto, apruébalo aunque no use "porque"/"ya que"
literalmente. Recházalo solo si es una afirmación sin ninguna razón, causa, consecuencia o evidencia.
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
  etiqueta corta en español, legible, nunca como un identificador técnico con guiones bajos.

${ejemplosFormateados}

Devuelve SOLO JSON válido con esta forma exacta:
{"aprobado": boolean, "motivo": "máximo 20 palabras", "sugerenciaDeCorreccion": "vacío si aprobado es true", "posturaDetectada": "id o null", "esPosturaNueva": boolean, "posturaSugerida": "etiqueta corta o vacío", "confianza": number entre 0 y 1}`;

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
        // Temperatura 0: el mismo argumento tiene que dar el mismo veredicto. Con 0.2 el
        // mismo texto pasaba de "postura nueva" a aprobado al reenviarlo, y eso el estudiante
        // lo lee como arbitrariedad. Bug real reportado en prueba en vivo.
        temperature: 0,
        top_p: 1,
        seed: 7,
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
    // Groq a veces devuelve el id de una postura que no existe. Se normaliza acá para que el
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
    });
  } catch (error) {
    response.status(502).json({ error: 'Groq no devolvió JSON válido', detalle: datos });
  }
}
