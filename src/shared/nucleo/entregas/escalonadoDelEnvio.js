// Escalonado del envío automático de borradores al vencer el tiempo (control de lectura).
//
// Cuando se acaba la escritura todos los borradores se envían a la vez. Cada entrega publica un aviso a la sala
// que Ably entrega a TODOS, así que N entregas simultáneas son N × N mensajes de salida. La prueba de carga del
// 4-oct-2026 (docs/06-pendientes.md) mostró que con 80 o más personas Ably rechaza lo que pasa de 50 mensajes por
// segundo en un canal y de 600 por segundo en la cuenta, y parte de las entregas se pierde. Por eso cada
// cliente espera un tiempo aleatorio antes de enviar, tanto más largo cuanto más grande es la sala.

// Presupuesto de entregas de mensajes por segundo: la mitad del límite de 600 de la cuenta, para dejar margen
// al resto del tráfico.
export const PRESUPUESTO_DE_ENTREGAS_POR_SEGUNDO = 300;

// El host acepta entregas por tiempo hasta 2 minutos después del cierre (MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS):
// el escalonado queda bien por debajo para que los reintentos tengan margen.
export const VENTANA_MAXIMA_DEL_ESCALONADO_MS = 75 * 1000;

// Con N personas, cada entrega genera N entregas de mensaje: para no pasar del presupuesto hay que repartir las
// N entregas en N² / presupuesto segundos. 40 personas → ~5 s; 80 → ~21 s; 200 → tope de 75 s.
export function ventanaDelEscalonadoMs(numeroDePersonas) {
  const personas = Math.max(1, Math.floor(Number(numeroDePersonas) || 1));
  const segundos = (personas * personas) / PRESUPUESTO_DE_ENTREGAS_POR_SEGUNDO;
  return Math.min(VENTANA_MAXIMA_DEL_ESCALONADO_MS, Math.round(segundos * 1000));
}

export function esperaAleatoriaDelEnvioMs(numeroDePersonas, azar = Math.random) {
  return Math.round(azar() * ventanaDelEscalonadoMs(numeroDePersonas));
}
