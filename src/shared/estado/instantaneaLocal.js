// Copia local del estado de la sesión, para sobrevivir a un F5 o a una pestaña cerrada.
//
// El estado en vivo se reconstruye del historial del canal, pero Ably retiene ese historial
// unos pocos minutos (decisión de arquitectura: sin base de datos, ver CLAUDE.md). Pasado ese
// rato, refrescar la pestaña dejaba al estudiante con "No se pudo recuperar la sesión" y al
// host sin el debate entero. Como el estado es una función pura del log de eventos, guardar el
// log en el navegador alcanza para volver a levantarlo sin servidor de por medio.
//
// Se usa localStorage y no sessionStorage a propósito: sessionStorage no sobrevive a cerrar la
// pestaña, que es justo el accidente del que hay que poder volver.

const PREFIJO = 'r2-argumentum-instantanea';
const VIDA_MAXIMA_MS = 12 * 60 * 60 * 1000;

function claveDeLaSala(sessionId) {
  return `${PREFIJO}:${sessionId}`;
}

// Las instantáneas viejas no sirven a nadie y ocupan la cuota del navegador.
function limpiarInstantaneasVencidas() {
  try {
    const ahora = Date.now();
    for (let indice = localStorage.length - 1; indice >= 0; indice -= 1) {
      const clave = localStorage.key(indice);
      if (!clave || !clave.startsWith(PREFIJO)) {
        continue;
      }
      const guardado = JSON.parse(localStorage.getItem(clave) || '{}');
      if (!guardado.guardadaEn || ahora - guardado.guardadaEn > VIDA_MAXIMA_MS) {
        localStorage.removeItem(clave);
      }
    }
  } catch {
    // Sin localStorage disponible no hay nada que limpiar.
  }
}

export function guardarInstantanea(sessionId, instantanea) {
  try {
    localStorage.setItem(
      claveDeLaSala(sessionId),
      JSON.stringify({ ...instantanea, sessionId, guardadaEn: Date.now() })
    );
  } catch {
    // Cuota llena o almacenamiento bloqueado: se sigue sin copia local, como antes.
    limpiarInstantaneasVencidas();
  }
}

export function leerInstantanea(sessionId) {
  try {
    limpiarInstantaneasVencidas();
    const guardado = localStorage.getItem(claveDeLaSala(sessionId));
    if (!guardado) {
      return null;
    }
    const instantanea = JSON.parse(guardado);
    if (!instantanea?.estado || !Array.isArray(instantanea.eventos)) {
      return null;
    }
    if (Date.now() - (instantanea.guardadaEn ?? 0) > VIDA_MAXIMA_MS) {
      return null;
    }
    return instantanea;
  } catch {
    return null;
  }
}

export function borrarInstantanea(sessionId) {
  try {
    localStorage.removeItem(claveDeLaSala(sessionId));
  } catch {
    // no-op
  }
}
