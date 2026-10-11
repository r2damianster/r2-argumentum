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
  // Si el último fallo fue un límite de tasa (429), cuántos segundos pide esperar Groq: el cliente pausa su cola
  // ese tiempo en vez de seguir golpeando un límite por minuto que ya se agotó.
  let ultimaEsperaPedidaSegundos = null;

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
          return { resultado: JSON.parse(datos.choices[0].message.content), uso: datos.usage };
        } catch {
          ultimoFallo = { error: 'Groq no devolvió JSON válido', detalle: datos };
        }
      } else {
        ultimoFallo = { error: 'Groq devolvió un error', detalle: datos, estado: respuestaGroq.status };
        ultimaEsperaPedidaSegundos = null;
        const esTransitorio = respuestaGroq.status === 429 || respuestaGroq.status >= 500;
        if (!esTransitorio) {
          return ultimoFallo;
        }
        const segundosPedidos = Number(respuestaGroq.headers?.get?.('retry-after'));
        if (Number.isFinite(segundosPedidos) && segundosPedidos > 0) {
          esperaSugeridaMs = segundosPedidos * 1000;
          ultimaEsperaPedidaSegundos = segundosPedidos;
        }
      }
    }

    if (intento < MAXIMO_DE_INTENTOS_CON_GROQ) {
      await esperar(Math.min(esperaSugeridaMs, ESPERA_MAXIMA_ENTRE_INTENTOS_MS));
    }
  }

  return ultimaEsperaPedidaSegundos === null ? ultimoFallo : { ...ultimoFallo, reintentarEnSegundos: ultimaEsperaPedidaSegundos };
}

// Pide a Groq una respuesta que cumpla `esquema` (structured outputs en modo estricto: gpt-oss-20b y
// gpt-oss-120b lo soportan). El modo estricto garantiza JSON con la forma pedida, así que ya no se
// depende de que el modelo "obedezca" una descripción en prosa. Si Groq rechaza el esquema (400), se
// repite la consulta con `json_object` y la forma descrita en el prompt: Groq nunca condiciona el trabajo.
// Todas las propiedades del esquema van en `required` y cada objeto con `additionalProperties: false`.
export async function consultarGroqConEsquema(cuerpoBase, { nombre, esquema }) {
  const consulta = await consultarGroqConReintentos(
    JSON.stringify({
      ...cuerpoBase,
      response_format: { type: 'json_schema', json_schema: { name: nombre, strict: true, schema: esquema } },
    })
  );
  const consultaFinal =
    consulta.estado === 400
      ? await consultarGroqConReintentos(JSON.stringify({ ...cuerpoBase, response_format: { type: 'json_object' } }))
      : consulta;
  registrarUsoDeGroq(nombre, cuerpoBase, consultaFinal);
  return consultaFinal;
}

// Contabilidad de tokens por endpoint: una línea JSON en los registros de Vercel (nunca el texto de la
// persona). Con el límite del plan gratuito (8.000 tokens por minuto) es lo que permite medir cualquier
// cambio de prompt o de `reasoning_effort` con cifras y no a ojo.
function registrarUsoDeGroq(nombre, cuerpoBase, consulta) {
  console.info(
    JSON.stringify({
      groq: nombre,
      modelo: cuerpoBase.model,
      razonamiento: cuerpoBase.reasoning_effort ?? 'por_defecto',
      ok: !consulta.error,
      tokensDeEntrada: consulta.uso?.prompt_tokens ?? null,
      tokensDeSalida: consulta.uso?.completion_tokens ?? null,
      tokensTotales: consulta.uso?.total_tokens ?? null,
    })
  );
}
