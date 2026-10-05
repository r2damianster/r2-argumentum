// Qué entregas consultar a Groq y cuándo — ver docs/14-control-de-lectura.md.
//
// Con 40 o más estudiantes, mandar todo al terminar la escritura chocaría con los límites por minuto
// de Groq. Por eso las consultas salen a medida que llegan las entregas, en cola y con pocas a la vez, y
// un fallo se reintenta un par de veces con espera antes de dejarlo para que el docente lo pida a mano.
// Función pura: el hook del host la llama y se encarga de las promesas.

export const CONCURRENCIA_DE_CONSULTAS = 2;
export const MAXIMO_DE_INTENTOS_AUTOMATICOS = 2;
export const ESPERA_ENTRE_INTENTOS_MS = 15 * 1000;

// Con el plan gratuito de Groq (8.000 tokens por minuto) caben unas 5 sugerencias por minuto: cuando Groq dice que
// se alcanzó el límite, TODA la cola se pausa lo que él pida (acotado a este rango) y los intentos que chocaron
// con el límite no cuentan como fallos de la entrega (prueba de carga del 4-oct-2026, docs/06-pendientes.md).
export const PAUSA_MINIMA_POR_LIMITE_MS = 5 * 1000;
export const PAUSA_MAXIMA_POR_LIMITE_MS = 70 * 1000;

export function calcularPausaPorLimite(reintentarEnMs) {
  return Math.min(PAUSA_MAXIMA_POR_LIMITE_MS, Math.max(PAUSA_MINIMA_POR_LIMITE_MS, Number(reintentarEnMs) || 0));
}

// `cola`: la cola del docente. `enCurso`: Set de participantId con una consulta en vuelo.
// `intentos` y `ultimoIntento`: por participantId. Devuelve las entregas a consultar ahora, sin pasarse
// de la concurrencia.
export function elegirConsultasPendientes({
  cola,
  enCurso,
  intentos = {},
  ultimoIntento = {},
  ahora = Date.now(),
  concurrencia = CONCURRENCIA_DE_CONSULTAS,
  pausadoHasta = 0,
}) {
  if (ahora < pausadoHasta) {
    return [];
  }
  const libres = Math.max(0, concurrencia - enCurso.size);
  return cola
    .filter(
      (item) =>
        Boolean(item.texto) &&
        !item.sugerenciaConsultada &&
        !enCurso.has(item.participantId) &&
        (intentos[item.participantId] ?? 0) < MAXIMO_DE_INTENTOS_AUTOMATICOS &&
        ahora - (ultimoIntento[item.participantId] ?? 0) >= ((intentos[item.participantId] ?? 0) > 0 ? ESPERA_ENTRE_INTENTOS_MS : 0)
    )
    .slice(0, libres);
}
