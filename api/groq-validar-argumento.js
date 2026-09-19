// Checkpoint 1 de Groq (ver docs/02-arquitectura.md). Hace dos cosas, ninguna de ellas juzgar
// si el argumento es "bueno":
//   1. Valida la FORMA: ¿tiene claim + razón?
//   2. Clasifica a qué postura del debate pertenece, o avisa que no encaja en ninguna.
// Quién puede proponer una postura nueva lo decide el cliente según `permitirPosturasNuevas`
// del Programa — acá solo se informa el hallazgo.

import { revisarFormaMinima } from './_revisarFormaMinima.js';

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
async function consultarGroqConReintentos(cuerpoDeLaPeticion) {
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

  // Antes de gastar una llamada: un texto sin razón real ("... porque ....") no se manda a
  // Groq, que podía aprobarlo solo por ver el conector.
  const revisionMinima = revisarFormaMinima(texto);
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

  const cuerpoDeLaPeticion = JSON.stringify({
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
    // El modelo razona antes de responder y esos tokens cuentan contra el tope: con 800, un
    // argumento largo podía cortar el JSON a la mitad y el estudiante veía "el validador no
    // respondió". Reporte de prueba en vivo con 8 participantes.
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const consulta = await consultarGroqConReintentos(cuerpoDeLaPeticion);
  if (consulta.error) {
    response.status(502).json({ error: consulta.error, detalle: consulta.detalle });
    return;
  }

  const { resultado } = consulta;
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
}
