// Tiempo total de una actividad — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// No hay tiempos por respuesta: solo la duración total de la fase. Todo se deduce de dos datos
// que ya viajan en el log (cuándo empezó y cuánto dura), así un F5 del host o de cualquier
// participante recupera la misma cuenta atrás sin estado en memoria.

export const MILISEGUNDOS_POR_MINUTO = 60 * 1000;
export const MINUTOS_DE_AVISO_FINAL = 2;
export const MINUTOS_DE_UNA_EXTENSION = 5;

// `desfaseDelRelojMs`: cuánto se adelanta el reloj de ESTE equipo respecto al servidor de Ably
// (positivo si va adelantado). Con la hora de un equipo mal puesta, la cuenta atrás se descuadraría
// entre dispositivos; restarlo la devuelve a la hora común.
export function calcularTiempoRestante({
  iniciadaEn,
  duracionMin,
  extensionesMin = 0,
  ahora = Date.now(),
  desfaseDelRelojMs = 0,
}) {
  if (!iniciadaEn || !duracionMin) {
    return { terminaEn: null, restanteMs: null, haVencido: false, enAvisoFinal: false };
  }
  const terminaEn = iniciadaEn + (duracionMin + extensionesMin) * MILISEGUNDOS_POR_MINUTO;
  const restanteMs = terminaEn - (ahora - desfaseDelRelojMs);
  return {
    terminaEn,
    restanteMs: Math.max(0, restanteMs),
    haVencido: restanteMs <= 0,
    enAvisoFinal: restanteMs > 0 && restanteMs <= MINUTOS_DE_AVISO_FINAL * MILISEGUNDOS_POR_MINUTO,
  };
}

export function formatearCuentaAtras(restanteMs) {
  if (restanteMs === null || restanteMs === undefined) {
    return '';
  }
  const segundosTotales = Math.ceil(restanteMs / 1000);
  const minutos = Math.floor(segundosTotales / 60);
  const segundos = segundosTotales % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}
