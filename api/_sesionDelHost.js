// Sesión del moderador (host). La clave vive solo en variables de entorno de Vercel
// (HOST_USER y HOST_PASSWORD): el navegador nunca la ve. Al iniciar sesión se entrega un
// token firmado con caducidad; /api/ably-token lo exige para emitir credenciales de "host".
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DURACION_DE_LA_SESION_DEL_HOST_MS = 7 * 24 * 60 * 60 * 1000;

function claveDeFirma(claveDelHost) {
  return createHash('sha256').update(`r2-argumentum-host:${claveDelHost}`).digest();
}

function firmar(claveDelHost, expiraEn) {
  return createHmac('sha256', claveDeFirma(claveDelHost)).update(String(expiraEn)).digest('hex');
}

function sonIguales(textoA, textoB) {
  const huellaA = createHash('sha256').update(String(textoA)).digest();
  const huellaB = createHash('sha256').update(String(textoB)).digest();
  return timingSafeEqual(huellaA, huellaB);
}

export function credencialesDelHostSonValidas({ usuario, clave }, { usuarioEsperado, claveEsperada }) {
  // Se comparan las dos aunque la primera falle, para no dar pistas por el tiempo de respuesta.
  const usuarioCoincide = sonIguales(usuario ?? '', usuarioEsperado);
  const claveCoincide = sonIguales(clave ?? '', claveEsperada);
  return usuarioCoincide && claveCoincide;
}

// Cuentas válidas del host: la principal (HOST_USER / HOST_PASSWORD) más las adicionales de
// HOST_USERS, un JSON `[{"usuario":"...","clave":"..."}]`. Un JSON dañado se ignora: la
// cuenta principal nunca queda bloqueada por un error en las adicionales.
export function cuentasDelHost(entorno) {
  const cuentas = [];
  if (entorno.HOST_USER && entorno.HOST_PASSWORD) {
    cuentas.push({ usuarioEsperado: entorno.HOST_USER, claveEsperada: entorno.HOST_PASSWORD });
  }
  try {
    const adicionales = JSON.parse(entorno.HOST_USERS || '[]');
    for (const cuentaAdicional of Array.isArray(adicionales) ? adicionales : []) {
      if (cuentaAdicional?.usuario && cuentaAdicional?.clave) {
        cuentas.push({ usuarioEsperado: cuentaAdicional.usuario, claveEsperada: cuentaAdicional.clave });
      }
    }
  } catch {
    // HOST_USERS mal formado: se sigue solo con la cuenta principal.
  }
  return cuentas;
}

export function algunaCuentaDelHostCoincide(credenciales, cuentas) {
  // Se recorren todas sin cortar al primer acierto, para no dar pistas por el tiempo.
  let coincide = false;
  for (const cuenta of cuentas) {
    if (credencialesDelHostSonValidas(credenciales, cuenta)) {
      coincide = true;
    }
  }
  return coincide;
}

export function firmarSesionDelHost(claveDelHost, ahora = Date.now()) {
  const expiraEn = ahora + DURACION_DE_LA_SESION_DEL_HOST_MS;
  return { token: `${expiraEn}.${firmar(claveDelHost, expiraEn)}`, expiraEn };
}

export function sesionDelHostEsValida(token, claveDelHost, ahora = Date.now()) {
  if (typeof token !== 'string' || !claveDelHost) {
    return false;
  }
  const [expiraEnTexto, firmaRecibida] = token.split('.');
  const expiraEn = Number(expiraEnTexto);
  if (!Number.isFinite(expiraEn) || expiraEn <= ahora || !firmaRecibida) {
    return false;
  }
  return sonIguales(firmaRecibida, firmar(claveDelHost, expiraEn));
}
