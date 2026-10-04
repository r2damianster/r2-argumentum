// Llama al checkpoint 1 de Groq (api/groq-validar-argumento.js) sin que su disponibilidad condicione el
// trabajo: la IA ayuda, pero nunca es requisito para participar. Si Groq falla (límite de cuota, 5xx, sin
// clave, sin red), el argumento pasa y se avisa que no fue pre-revisado. Nunca lanza.

export const AVISO_SIN_REVISION_DE_IA =
  'Tu argumento no fue pre-revisado por límites de la IA. Puedes continuar; el moderador lo verá igual.';

// Respuesta equivalente a «aprobado, sin opinión sobre la postura»: `decidirValidacion` la deja pasar con la
// postura que la persona ya eligió.
export const RESPUESTA_SIN_REVISION_DE_IA = Object.freeze({
  aprobado: true,
  motivo: AVISO_SIN_REVISION_DE_IA,
  sugerenciaDeCorreccion: '',
  posturaDetectada: null,
  esPosturaNueva: false,
  posturaSugerida: '',
  confianza: null,
  sinRevisarPorIA: true,
});

export async function validarArgumentoConGroq({ texto, ejemplos = [], posturas = [], idioma }) {
  try {
    const peticion = await fetch('/api/groq-validar-argumento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, ejemplos, posturas, idioma }),
    });
    if (!peticion.ok) {
      return { ...RESPUESTA_SIN_REVISION_DE_IA };
    }
    const respuesta = await peticion.json();
    if (typeof respuesta?.aprobado !== 'boolean') {
      return { ...RESPUESTA_SIN_REVISION_DE_IA };
    }
    return respuesta;
  } catch {
    return { ...RESPUESTA_SIN_REVISION_DE_IA };
  }
}
