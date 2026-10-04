// Cliente mínimo de Groq con reintentos, compartido por los endpoints de api/. El prefijo "_" en el
// nombre evita que Vercel lo exponga como endpoint.

const MAXIMO_DE_INTENTOS_CON_GROQ = 3;
const ESPERA_BASE_ENTRE_INTENTOS_MS = 400;
const ESPERA_MAXIMA_ENTRE_INTENTOS_MS = 2000;

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

// Con varios estudiantes revisando a la vez, Groq responde 429 (límite de ráfaga) o 5xx de vez
// en cuando, y el modelo a veces devuelve JSON cortado. Son fallos transitorios: un reintento
// corto casi siempre alcanza, y al estudiante le ahorra ver "el validador no respondió". Los
// errores 4xx distintos de 429 (petición mal formada, clave inválida) no se reintentan.
export async function consultarGroqConReintentos(cuerpoDeLaPeticion) {
  let ultimoFallo = { error: 'No se pudo contactar a Groq', detalle: null };

  for (let intento = 1; intento <= MAXIMO_DE_INTENTOS_CON_GROQ; intento += 1) {
    let respuestaGroq;
    try {
      respuestaGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: cuerpoDeLaPeticion,
      });
    } catch (error) {
      ultimoFallo = { error: 'No se pudo contactar a Groq', detalle: String(error) };
      respuestaGroq = null;
    }

    let esperaSugeridaMs = ESPERA_BASE_ENTRE_INTENTOS_MS * intento;

    if (respuestaGroq) {
      const datos = await respuestaGroq.json().catch(() => null);

      if (respuestaGroq.ok) {
        try {
          return { resultado: JSON.parse(datos.choices[0].message.content) };
        } catch {
          ultimoFallo = { error: 'Groq no devolvió JSON válido', detalle: datos };
        }
      } else {
        ultimoFallo = { error: 'Groq devolvió un error', detalle: datos };
        const esTransitorio = respuestaGroq.status === 429 || respuestaGroq.status >= 500;
        if (!esTransitorio) {
          return ultimoFallo;
        }
        const segundosPedidos = Number(respuestaGroq.headers?.get?.('retry-after'));
        if (Number.isFinite(segundosPedidos) && segundosPedidos > 0) {
          esperaSugeridaMs = segundosPedidos * 1000;
        }
      }
    }

    if (intento < MAXIMO_DE_INTENTOS_CON_GROQ) {
      await esperar(Math.min(esperaSugeridaMs, ESPERA_MAXIMA_ENTRE_INTENTOS_MS));
    }
  }

  return ultimoFallo;
}
