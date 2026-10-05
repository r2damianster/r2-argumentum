// Pide a Groq una sugerencia de calificación para una entrega del control de lectura — ver
// docs/14-control-de-lectura.md. Solo la usa el host (el endpoint exige el token de su sesión).
//
// Devuelve { sugerencia } (puede ser null, con `motivo`, si el texto es muy corto) o { fallo: true }.
// Nunca lanza: sin sugerencia el docente califica a mano y la cola sigue.

import { leerSesionDelHost } from '../../ably/sesionDelHost.js';
import { resolverEstructuraDelPrograma, resolverDistribucion, resolverNumeroDeParrafos } from '../escritura/estructurasDeEscritura.js';
import { resolverIdiomaDelDebate } from '../../programa/idiomaDelDebate.js';

// `programa` debe ser el Programa COMPLETO del host: las claves de la lectura no viajan en el publicado.
// `razonamiento`: 'bajo' pide al modelo poco esfuerzo de razonamiento (~50 % menos tokens; modo de sala grande);
// cualquier otro valor usa el esfuerzo normal.
export async function solicitarSugerenciaDeCalificacion({ texto, programa, rubrica, razonamiento = 'normal', solicitar = fetch }) {
  const idioma = resolverIdiomaDelDebate(programa);
  const estructura = resolverEstructuraDelPrograma(programa, idioma);
  try {
    const respuesta = await solicitar('/api/groq-sugerir-calificacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostToken: leerSesionDelHost()?.token ?? '',
        texto,
        consigna: programa.consigna,
        estructura: {
          nombre: estructura.nombre,
          partes: estructura.partes,
          distribucion: resolverDistribucion(programa),
          numeroDeParrafos: resolverNumeroDeParrafos(programa, idioma),
        },
        rubrica: rubrica.map((criterio) => ({ id: criterio.id, nombre: criterio.nombre, descripcion: criterio.descripcion })),
        claves: programa.clavesDeLaLectura ?? '',
        razonamiento,
        idioma,
      }),
    });
    if (!respuesta.ok) {
      // 429: Groq alcanzó su límite por minuto y dijo cuánto esperar. La cola del docente se pausa ese tiempo.
      const esperaPedida = respuesta.status === 429 ? Number((await respuesta.json().catch(() => ({})))?.reintentarEnSegundos) : NaN;
      return Number.isFinite(esperaPedida) && esperaPedida > 0 ? { fallo: true, reintentarEnMs: esperaPedida * 1000 } : { fallo: true };
    }
    const { sugerencia = null, motivo = null } = await respuesta.json();
    return { sugerencia, motivo };
  } catch {
    return { fallo: true };
  }
}
