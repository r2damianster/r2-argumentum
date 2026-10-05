// Reintento de publicaciones a Ably que el servicio rechazó por límite de tasa. La prueba de carga del 4-oct-2026
// (docs/06-pendientes.md) mostró que con 80 o más personas Ably rechaza publicaciones (error 42913: más de 50
// mensajes por segundo en un canal; 42917: más de 600 por segundo en toda la cuenta) y que **un mensaje rechazado
// es un mensaje perdido**: nadie lo reintentaba. Un rechazo por tasa no publicó nada, así que reintentar no
// duplica; la espera crece y lleva un factor aleatorio para que los reintentos no vuelvan a chocar todos a la vez.

export const MAXIMO_DE_INTENTOS_DE_PUBLICACION = 6;
export const ESPERA_BASE_DE_PUBLICACION_MS = 500;
export const ESPERA_MAXIMA_DE_PUBLICACION_MS = 8000;

// Códigos 429 de Ably: 42910–42919 son límites de tasa (42913 por canal, 42917 por cuenta, etc.).
export function esUnLimiteDeTasa(error) {
  const codigo = Number(error?.code);
  return error?.statusCode === 429 || (codigo >= 42900 && codigo < 43000);
}

const esperarPorDefecto = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

// `publicarUnaVez`: función que hace la publicación y devuelve una promesa. Si falla por un límite de tasa se
// reintenta con espera creciente; cualquier otro error (permisos, red caída) se lanza tal cual en el primer intento.
export async function publicarConReintentos(
  publicarUnaVez,
  {
    maximoDeIntentos = MAXIMO_DE_INTENTOS_DE_PUBLICACION,
    esperaBaseMs = ESPERA_BASE_DE_PUBLICACION_MS,
    esperaMaximaMs = ESPERA_MAXIMA_DE_PUBLICACION_MS,
    esperar = esperarPorDefecto,
    azar = Math.random,
  } = {}
) {
  for (let intento = 1; ; intento += 1) {
    try {
      return await publicarUnaVez();
    } catch (error) {
      if (!esUnLimiteDeTasa(error) || intento >= maximoDeIntentos) {
        throw error;
      }
      const espera = Math.min(esperaMaximaMs, esperaBaseMs * 2 ** (intento - 1));
      await esperar(Math.round(espera * (0.5 + azar())));
    }
  }
}
