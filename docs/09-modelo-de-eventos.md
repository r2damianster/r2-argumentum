# Modelo de eventos

Arquitectura basada en eventos (event sourcing): todo el estado de la sesión — turnos, argumentos, conexiones, puntajes — se reconstruye reproduciendo el log de eventos publicados en el canal de Ably. No hay base de datos: el estado "vive" en la suscripción de cada cliente y se exporta como JSON al cierre (el export **es** el log completo de eventos, más un resumen calculado).

## Canal

```
debate:sala:{codigoDeSala}
```

**Implementado distinto a la versión original de este doc** (`debate:{programId}:{sessionId}`): el player solo conoce el código de sala de 4 dígitos al entrar, no el `programId` — sin backend no hay forma de resolverlo. El segmento `programId` se reemplaza por el literal `sala`, y `sessionId` es el propio código de 4 dígitos. Un solo canal por sesión; todos los clientes (host, participantes, co-moderadores) se suscriben al mismo canal y mantienen su propio estado derivado localmente con un reducer puro (`src/shared/estado/reducirEventos.js`).

## Descubrimiento del Programa por el player

```
programa.publicado { programa: <Programa completo>, identificadorDeSesion }
```

El `identificadorDeSesion` delimita a qué debate pertenece cada evento del canal. Hace falta porque el canal se llama solo con el código de sala de 4 dígitos, que se genera al azar y se puede repetir entre debates: sin esa marca, una sesión nueva hereda del historial los argumentos y el `comod.selected` de la anterior. Al reconstruir el estado, cada cliente toma el identificador del último `programa.publicado` del historial y descarta todo lo anterior a su primera aparición (el host lo republica al elegir posturas, por eso puede haber más de uno por sesión).

Evento agregado durante la implementación (no estaba en la versión original de este doc). Lo publica el **host**, una vez, al montar la consola de sesión — antes de eso el player no tiene forma de conocer el tema, las posturas, ni los `ejemplosPorTema` que necesita para llamar a Groq. El player no habilita ninguna UI hasta recibirlo (vía backfill del historial o en vivo).

## Presence (nativo de Ably, no eventos custom)

Al entrar, cada cliente hace `presence.enter()` con:

```
{ nombre, emoji }
```

**Implementado distinto a la versión original**: el `rol` NO viaja en el payload de presence — se deriva del evento `comod.selected` (si el `participantId` está en la lista, es co-moderador; si no, es participante). El host nunca hace `presence.enter()` (no es un participante, solo observa `presence.subscribe()` para la ruleta de turnos y la lista en vivo).

Se usa para: saber quién está conectado (ruleta de turnos), mostrar lista de participantes en la consola del host.

## Eventos de control de fase (publica el Moderador)

```
phase.started   { phaseType, ronda?, timestamp }
phase.closed    { phaseType, ronda?, timestamp }
```

`phaseType`: `"apertura_simultanea"` | `"escritura_argumentos"` | `"conexion_sugerida"` | `"conexion_libre"` | `"cierre_y_ranking"`.

**`apertura_simultanea`** (agregada durante la implementación, no estaba en la spec original): primera fase de la sesión — todos los participantes (no co-moderadores) escriben su argumento inicial en paralelo, sin ruleta de turnos, siempre `tipoDeclarado: "nuevo"`, posición 1, ronda 1. Se cierra automáticamente cuando todos ya escribieron o al agotar `duracionMin` de esa entrada de `programa.fases` (lo que ocurra primero) — el motor del host la gestiona igual que un cierre manual de fase.

El cierre de `"apertura_simultanea"` o de `"escritura_argumentos"` es lo que **dispara** la llamada Groq de sugerencia de conexiones — sobre TODO el pool de argumentos acumulado hasta ese momento, no solo los de esa fase (así se detectan conexiones entre una reacción nueva y un argumento de la apertura).

### Máquina de rondas dentro de `apertura_simultanea` — requisito de entrada

Agregada tras confirmar que la apertura debe ser un **requisito indispensable** antes del debate en sí, y que no conviene forzar su cierre por temporizador sin que el moderador confirme con los estudiantes. Eventos nuevos:

```
apertura.ronda_iniciada  { ronda: 1 | 2, iniciadaEn, expiraEn }
apertura.ronda_extendida { ronda: 1, hasta }
apertura.ronda_cerrada   { ronda: 1 | 2, aprobados: [participantId...], pendientes: [participantId...], esFinal: bool }
```

Flujo (gestionado enteramente por el host, sin cierre automático por temporizador salvo cuando ya no queda nadie pendiente):

1. Al iniciar la sesión se publica `apertura.ronda_iniciada { ronda: 1 }` con `expiraEn` calculado desde `duracionMin` de la entrada `apertura_simultanea` del Programa.
2. Si todos los elegibles (no co-moderadores) ya tienen un `argument.submitted` antes de que venza el plazo, la ronda se cierra sola (`esFinal: true`, `pendientes: []`) — no se molesta al host con una pregunta vacía.
3. Si vence el plazo y quedan pendientes, el motor **no cierra nada solo**: espera un clic del host. El host pregunta a los estudiantes si ya terminaron y decide:
   - **Dar 1 minuto más** → `apertura.ronda_extendida { ronda: 1, hasta: ahora + 60000 }` (extiende el plazo vigente, no crea una ronda nueva).
   - **Cerrar ronda ya** → `apertura.ronda_cerrada { ronda: 1, esFinal: pendientes.length === 0 }`. Si siguen quedando pendientes, `esFinal: false` — esto NO es el corte definitivo, solo pausa a la siguiente pregunta.
4. Con `esFinal: false`, el host recibe una segunda pregunta: ¿dar una segunda oportunidad (1 minuto, fijo) solo a quienes faltan?
   - **Sí** → `apertura.ronda_iniciada { ronda: 2, expiraEn: ahora + 60000 }`. Al vencer (o si el host cierra antes), el cierre de ronda 2 es **siempre definitivo** (`esFinal: true`).
   - **No** → se publica igual un `apertura.ronda_cerrada` definitivo (recalculando pendientes en ese instante), sin pasar por una ronda 2 real.
5. Corte definitivo (`esFinal: true`): quienes están en `pendientes` quedan marcados `sinArgumentoDeApertura: true` en el estado derivado — sin argumento aprobado, sin `score.updated` de categoría "argumento", y excluidos de la ruleta de turnos por el resto de la sesión (`elegirCandidatoParaTurno` en `motorDeSesion.js` los filtra). Esto es una excepción deliberada a la política general de "2 intentos de Groq y escala a co-moderador" (ver `CLAUDE.md` del proyecto y `06-pendientes.md`): esa política sigue vigente tal cual dentro de `escritura_argumentos`, pero el requisito de apertura es un corte de asistencia, no un turno en vivo — agotadas las dos rondas, no hay más reintentos ni escalamiento.

Nota de costo de Ably: el chequeo de Groq contra un borrador (`/api/groq-validar-argumento`) es una llamada HTTP directa del cliente, no pasa por el canal — el estudiante puede corregir su argumento tantas veces como quiera sin publicar nada. Recién se publica al canal (`argument.submit_attempt` → `argument.validation_result` → `argument.submitted`) una vez que el intento queda aprobado, igual que hoy.

## Postura

```
stance.assigned  { participantId, stanceId, metodo: "libre" | "aleatoria" | "por_grupo" }
```

Se publica una vez por participante, antes de que pueda escribir su primer argumento. Cada argumento hereda el `stanceId` vigente del participante en el momento de publicarse (no se recalcula retroactivamente si cambia de postura después, ver `permiteCambioPostura` en el Programa).

## Selección de co-moderadores

```
comod.selected   { participantIds: [...], formulaUsada, totalParticipantes, timestamp }
```

Publicado una vez por el Moderador al iniciar la sesión, tras aplicar `ceil(n * 0.10)` (o el override del Programa) sobre el conteo de presence.

## Turnos

```
turn.offered   { turnId, candidateId, ofrecidoEn, expiraEn }
turn.accepted  { turnId, participantId }
turn.rejected  { turnId, participantId, totalRechazosDelParticipante }
turn.timeout   { turnId, candidateId }
turn.forced    { turnId, participantId }   // ya superó maxRechazosAntesDeForzar, no puede rechazar
```

Flujo: `turn.offered` → dentro de `timeoutAceptacion` segundos llega `turn.accepted`, `turn.rejected` o (si no responde) `turn.timeout`. Cualquier resultado distinto de `accepted` dispara un nuevo `turn.offered` a otro candidato (ruleta ponderada, excluye temporalmente a quien rechazó/no respondió).

## Argumentos

```
argument.submit_attempt {
  attemptId, participantId, turnId, ronda,
  numeroDeIntento,     // 1 o 2 (máx. según Programa)
  texto
}

argument.validation_result {   // resultado de Groq sobre el intento anterior
  attemptId, aprobado: bool, motivo, sugerenciaDeCorreccion?
}

argument.submitted {
  argumentId, participantId, turnId, ronda,
  posicionEnRonda,          // 1, 2 o 3 — determina el valor base (ver 05-reglas-de-puntaje.md)
  tipoDeclarado,            // nuevo | contraargumento | refuerzo | dilema | pregunta | concesion
  argumentoObjetivoId?,     // requerido si tipoDeclarado lo exige
  texto, stanceId,
  viaCoModerador: bool,     // true si entró tras agotar intentos de Groq
  timestamp
}

argument.validated {   // publicado después, por un co-moderador
  argumentId, coModeradorId,
  tipoFinal,             // puede diferir del tipoDeclarado
  puntajeAsignado,
  nota,
  faltaMarcada: bool,
  timestamp
}
```

`argument.submit_attempt` y `argument.validation_result` son el ciclo de validación de forma (checkpoint 1 de Groq). Solo tras un `aprobado: true` (o una escalada a co-moderador) se publica `argument.submitted`.

## Bids de intervención

Ver `04-roles-y-turnos.md` para el flujo completo. Corren en paralelo al turno principal, no lo interrumpen.

```
bid.submitted {
  bidId, participantId, tipoDeBid: "desmontar" | "fortalecer",
  argumentoObjetivoId, texto, ronda, turnoPrincipalId, timestamp
}

bid.vote_comoderador {
  bidId, coModeradorId,        // presente en el payload por necesidad de puntaje,
                                // la UI nunca lo muestra (ver nota de anonimidad en 04)
  voto: "aprueba" | "rechaza",
  timestamp
}

bid.evaluacion_expirada { bidId }   // se agotó tiempoLimiteEvaluacionBid sin quórum completo

topic.bids_cerrados {
  turnoPrincipalId, listaDeBidIds,
  cerradoPor: "agotamiento" | "moderador",
  timestamp
}

bid.decision_moderador {
  bidId, decisionFinal: "aprobado" | "rechazado",
  timestamp
}
```

Si `decisionFinal: "aprobado"`, se publica inmediatamente un `argument.submitted` normal (texto = el del bid, sin pasar por Groq) y los `score.updated` correspondientes: uno para el participante (fórmula de posición, igual que cualquier argumento) y uno por cada co-moderador cuyo voto coincidió con la decisión final (+5, ver `05-reglas-de-puntaje.md`).

## Conexiones

```
link.created {
  linkId, sourceArgumentId, targetArgumentId,
  tipoDeRelacion,       // refuerzo | contraargumento | dilema | conexion
  porParticipanteId,
  timestamp
}

link.suggested {   // salida del checkpoint 2 de Groq, en lote por ronda
  suggestionId, sourceArgumentId, targetArgumentId,
  tipoDeRelacion, confianza, ronda
}

link.suggestion_resolved {
  suggestionId,
  resolucion: "aceptada" | "rechazada_reconectada" | "rechazada_reescrita",
  porParticipanteId
}
```

Antes de publicar `link.created`, el cliente valida localmente (contra su copia del estado derivado) que `sourceArgumentId` no tenga ya una salida — ver la regla de "1 conexión saliente por argumento propio" en `04-roles-y-turnos.md`.

## Puntaje

```
score.updated {
  participantId, delta, motivo, nuevoTotal,
  categoria: "argumento" | "conexion" | "co_moderacion"
}
```

Se publica cada vez que la fórmula de `05-reglas-de-puntaje.md` produce un cambio: al validar un argumento, al resolver una conexión, o al registrarse una acción de co-moderación.

## Cierre de sesión

```
session.closed { timestamp }
```

Al recibirlo, cada cliente vuelca su estado derivado (reconstruido desde el log completo de eventos que ya recibió) a un archivo JSON exportable — no requiere una llamada adicional a ningún servidor, el propio cliente ya tiene todo el historial por haber estado suscrito al canal.

## Principio de reconstrucción de estado

Ningún cliente confía en "memoria propia" no verificable: el grafo argumental, los puntajes y el estado de cada turno son siempre una función pura del log de eventos recibido hasta el momento (`estado = reduce(eventos, estadoInicial)`). Esto permite que un participante que se reconecta a mitad de sesión reconstruya el estado completo simplemente pidiendo el historial del canal a Ably (dentro de la ventana de retención), sin necesitar una base de datos.
