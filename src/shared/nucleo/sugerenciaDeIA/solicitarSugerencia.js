import { resolverIdiomaDelDebate } from '../../programa/idiomaDelDebate.js';
import { criteriosParaLaIA } from '../criteriosAdicionales/criteriosAdicionales.js';

// Pide a la IA una sugerencia de evaluación de un aporte (endpoint api/groq-sugerir-evaluacion.js).
// Nunca lanza: si algo falla devuelve `{ fallo: true }` y la actividad publica el aporte sin
// sugerencia, porque la IA ayuda pero no es requisito para participar.
//
// Devuelve:
//   { formaMinima: { valido, motivo, sugerencia }, sugerencia: { completitud, falacias, criterios, comentario, confianza } | null }
//   { fallo: true }
export async function solicitarSugerenciaDeEvaluacion({ texto, programa, textoDelObjetivo = '' }) {
  try {
    const peticion = await fetch('/api/groq-sugerir-evaluacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto,
        ejemplos: programa.ejemplosPorTema ?? [],
        idioma: resolverIdiomaDelDebate(programa),
        textoDelObjetivo,
        criterios: criteriosParaLaIA(programa),
      }),
    });
    if (!peticion.ok) {
      return { fallo: true };
    }
    return await peticion.json();
  } catch {
    return { fallo: true };
  }
}
