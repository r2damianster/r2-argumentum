// Qué entregas consultar a Groq y cuándo — ver docs/14-control-de-lectura.md.
//
// Con 40 o más estudiantes, mandar todo al terminar la escritura chocaría con los límites por minuto
// de Groq. Por eso las consultas salen a medida que llegan las entregas, en cola y con pocas a la vez, y
// un fallo se reintenta un par de veces con espera antes de dejarlo para que el docente lo pida a mano.
// Función pura: el hook del host la llama y se encarga de las promesas.

export const CONCURRENCIA_DE_CONSULTAS = 2;
export const MAXIMO_DE_INTENTOS_AUTOMATICOS = 2;
export const ESPERA_ENTRE_INTENTOS_MS = 15 * 1000;

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
}) {
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
