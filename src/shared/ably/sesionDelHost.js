// Sesión del moderador en el navegador. La clave nunca está aquí: se envía a /api/host-login y
// el servidor devuelve un token firmado con caducidad, que se guarda en localStorage y se
// presenta a /api/ably-token para obtener la identidad "host" (ver api/_sesionDelHost.js).

const CLAVE_DE_SESION_DEL_HOST = 'r2-argumentum-host-sesion';

export function leerSesionDelHost(ahora = Date.now()) {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_DE_SESION_DEL_HOST) ?? 'null');
    if (guardada?.token && guardada.expiraEn > ahora) {
      return guardada;
    }
  } catch {
    // Sin localStorage o con contenido dañado: se trata como sin sesión.
  }
  return null;
}

export function guardarSesionDelHost(sesion) {
  try {
    if (sesion) {
      localStorage.setItem(CLAVE_DE_SESION_DEL_HOST, JSON.stringify(sesion));
    } else {
      localStorage.removeItem(CLAVE_DE_SESION_DEL_HOST);
    }
  } catch {
    // Sin localStorage disponible
  }
}

// Devuelve { sesion } si entró, o { mensajeDeError } si no.
export async function iniciarSesionDelHost({ usuario, clave }) {
  let respuesta;
  try {
    respuesta = await fetch('/api/host-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, clave }),
    });
  } catch {
    return { mensajeDeError: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
  }

  if (respuesta.status === 401) {
    return { mensajeDeError: 'Usuario o clave incorrectos.' };
  }
  if (respuesta.status === 503) {
    return { mensajeDeError: 'El servidor no tiene configurada la clave del host (HOST_USER / HOST_PASSWORD).' };
  }
  if (!respuesta.ok) {
    return { mensajeDeError: 'No se pudo iniciar sesión. Inténtalo de nuevo.' };
  }

  const sesion = await respuesta.json();
  guardarSesionDelHost(sesion);
  return { sesion };
}
