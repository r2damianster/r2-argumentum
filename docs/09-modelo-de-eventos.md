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

## Ingreso con argumento obligatorio

```
ingreso.confirmado  { participantId, stanceId, argumentId, nombre, emoji }
```

`nombre` y `emoji` viajan en el log además de en presencia de Ably: presencia solo sabe quién está conectado **ahora**, así que quien cierra la pestaña desaparece de ella y, si el host refresca, su nombre se perdía (marcador sin esa persona, mapa e informe con el ID técnico). El reducer los guarda en `participantes[id]` y `useEstadoDeSesion` completa el roster de presencia con ellos (`completarPresenciaConParticipantes`), marcando `conectado: false` a quien ya no está.

El participante NO aparece en la sala por conectarse. Se suscribe al canal sin entrar a presencia, lee el Programa, elige postura y redacta su argumento revisándolo con Groq por HTTP (sin publicar nada). Al confirmar se publica todo junto — `argument.submit_attempt`, `argument.validation_result`, `stance.assigned`, `argument.submitted` (con `esArgumentoDeIngreso: true` y `pendienteDeExposicion: true`) e `ingreso.confirmado` — y recién ahí hace `presence.enter()`. De este modo, el argumento de ingreso entra a la ruleta marcado como pendiente de exposición (`argumentoListo: true`, `argumentoPendienteId`) conservando `intervenciones: 0`, habilitando el sorteo de turnos aleatorios desde el inicio de la sesión.

Quien está en la sala sin `ingreso.confirmado` es **oyente**: ve todo el debate, no entra a la ruleta de turnos y no puntúa. Puede convertirse en participante de dos maneras: completando su argumento de ingreso antes de que el moderador inicie la sesión, o —ya iniciada— publicando un contraargumento desde `FormularioDeContraargumentoParaOyentes.jsx`. En ese caso elige él mismo la postura desde la que contraargumenta (no hereda la del argumento que rebate), el texto publicado debe ser exactamente el que Groq revisó, y el envío emite `argument.submitted` + `link.created` + `ingreso.confirmado`.

## Propuesta de postura nueva

```
stance.proposed            { propuestaId, participantId, nombre, emoji, etiquetaPropuesta, textoDelArgumento }
stance.decision_moderador  { propuestaId, decision: "aceptada" | "rechazada", stanceId }
```

Quien propuso la postura ve la respuesta del moderador en su pantalla de ingreso: si la aceptan se le asigna la postura nueva (y, si no tocó su texto, puede confirmar el ingreso sin volver a revisar); si la rechazan, se le pide reescribir para una postura existente.

Solo si el Programa tiene `permitirPosturasNuevas: true` (por defecto `false`). Si Groq detecta que el argumento no defiende ninguna de las posturas de la lista, el estudiante puede proponer la suya. Al aceptarla, el host republica `programa.publicado` con la postura agregada: el grafo, el ranking y el resto de la UI la toman del canal como a cualquier otra.

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

**El turno es para exponer en voz alta un argumento ya publicado, nunca una invitación a escribir contra reloj.** El estudiante prepara su argumento mientras escucha a los demás (revisándolo con Groq por HTTP, sin gastar Ably) y, al aprobarse, lo publica de una vez, marcado como pendiente de exposición:

```
argument.submitted { ..., pendienteDeExposicion: true }   // + link.created si tiene objetivo
```

El reducer deja a esa persona con `argumentoListo: true` y `argumentoPendienteId`, no le suma intervención (todavía nadie lo escuchó) y el argumento ya puntúa (ver `05-reglas-de-puntaje.md`). Solo quien tiene un argumento pendiente entra a la ruleta. `argument.ready` (`{ participantId, listoEn }`) **ya no se emite**: el reducer lo sigue entendiendo por compatibilidad con historiales viejos.

Cuando esa persona recibe la palabra, anuncia el argumento que va a exponer:

```
argument.presenting  { turnId, participantId, argumentId, texto, tipoDeclarado, stanceId, argumentoObjetivoId }
```

El reducer lo adjunta al turno en curso (`turnos.turnoEnCurso.presentacion`) solo si `turnId` y `participantId` coinciden con ese turno, y —si trae `argumentId`— abre `estado.exposiciones[argumentId]` en estado `en_curso`. Con eso la sala (proyección incluida) muestra el argumento **en grande unos 12 segundos** (`DestacadoDelTurno`) y después en tamaño normal dentro del banner "X está hablando", y los co-moderadores pueden calificarlo mientras habla. Es un solo mensaje de Ably por turno.

Al terminar de exponer, quien hablaba publica:

```
exposicion.terminada  { turnId, participantId, argumentId }
```

Libera el turno, suma la intervención, apaga el «listo» y deja la exposición en `terminada` (un evento repetido no suma dos veces). Si el moderador termina el turno con `turn.ended_by_host`, la exposición queda `interrumpida` y el argumento sigue pendiente.

### Calificación de la exposición

```
exposicion.calificada              { argumentId, coModeradorId, calidad: "buena" | "aceptable" | "insuficiente" | "sin_exposicion", nota? }
exposicion.evaluada_moderador      { argumentId, decision: "evaluada" | "descartada" | "sin_evaluar", calidad? }
```

`exposicion.calificada`: cada co-moderador una vez por exposición (la última reemplaza a la anterior); una calidad desconocida o una exposición inexistente se ignora. `exposicion.evaluada_moderador`: `evaluada` exige `calidad`; `descartada` anula las calificaciones de esa exposición; `sin_evaluar` deshace la decisión. Ninguno de los dos cambia el puntaje al publicarse: los ajustes los calcula `calcularAjustesDeExposiciones` (`src/shared/puntaje/evaluacionDeExposiciones.js`) y los publica `motor.cerrarSesion()` como `score.updated` (categorías `argumento` y `co_moderacion`) **antes** de `session.closed`, con la clave de idempotencia `evaluaciones-finales`.

Cuando **no queda ningún argumento pendiente de exposición** y todavía hay alguien que no tomó la palabra ni una vez, se le ofrece un turno hablado (`modo: "verbal"`).

Dos precisiones que el código respeta y conviene no perder de vista:

- **El argumento de ingreso no cuenta como haber tomado la palabra.** Se escribe antes de que empiece el debate y nadie lo escuchó: viaja con `esArgumentoDeIngreso: true` y el reducer no lo suma a `intervenciones`. Sin esa marca, todo el mundo entraba al debate con una intervención ya contada y el turno hablado no se ofrecía nunca.
- **Hay un margen de un minuto desde que arranca la fase** antes del primer turno hablado. Recién empezada la ronda nadie alcanzó a preparar nada, y ofrecer la palabra en ese instante sería empujar a hablar sin argumento en el primer segundo.



```
intervencion_verbal.registrada  { intervencionId, participantId, turnId, resumen }
intervencion_verbal.calificada  { intervencionId, coModeradorId, calidad: "buena" | "aceptable" | "insuficiente", nota }
```

Vale como la posición de menor valor con descuento de vía — sale de la fórmula única, así escala solo con el perfil de puntaje. Se acredita al registrarse (no depende de que existan co-moderadores) y la calificación posterior lo ajusta hacia arriba o hacia abajo.

Rechazar un turno **cuesta puntos**, y el botón de rechazar muestra el costo antes de confirmar.

```
turn.offered   { turnId, candidateId, ofrecidoEn, expiraEn, modo: "argumento" | "verbal" }
turn.accepted  { turnId, participantId }
turn.rejected  { turnId, participantId, totalRechazosDelParticipante }
turn.timeout   { turnId, candidateId }
turn.forced    { turnId, participantId }   // ya superó maxRechazosAntesDeForzar, no puede rechazar
turn.ended_by_host { turnId, participantId }   // el moderador da por terminado un turno que quedó abierto
turn.roulette_paused { motivo? }            // cortacircuitos (4 rechazos/timeouts seguidos) o pausa manual
turn.roulette_resumed {}                    // reanudación manual de la ruleta por el moderador
```

`turn.roulette_paused` se activa automáticamente cuando se acumulan 4 rechazos o timeouts consecutivos sin que ningún participante acepte el turno (o cuando el moderador la detiene manualmente desde su consola). Al estar pausada, el motor deja de emitir `turn.offered` para prevenir bucles infinitos de abstención. `turn.roulette_resumed` permite al moderador reiniciar el flujo cuando la sala está lista para continuar.

`turn.ended_by_host` existe porque el motor no ofrece otro turno mientras haya uno en curso: si quien hablaba cerró la pestaña o se olvidó de publicar, la ruleta quedaba bloqueada para siempre. Libera `turnoEnCurso` sin contarlo como intervención ni como rechazo, y conserva el `argumentoListo` de esa persona (si vuelve, puede recibir la palabra otra vez).

Flujo: `turn.offered` → dentro de `timeoutAceptacion` segundos llega `turn.accepted`, `turn.rejected` o (si no responde) `turn.timeout`. `rechazosAcumulados` de cada participante es la **racha** (vuelve a 0 al aceptar); el total de turnos rechazados sale del log `estado.turnos.rechazos`. Cualquier resultado distinto de `accepted` dispara un nuevo `turn.offered` a otro candidato (ruleta ponderada, excluye temporalmente a quien rechazó/no respondió).

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

Cuando el argumento se publica al exponerlo en su turno y su tipo tiene objetivo (contraargumento, refuerzo, dilema, conexión), el mismo cliente publica a continuación `link.created` con `sourceArgumentId` = el argumento nuevo y `targetArgumentId` = `argumentoObjetivoId` (y `tipoDeRelacion` = el tipo declarado). El bid aprobado hace lo mismo desde el motor del host. Sin ese evento el nodo queda suelto en la fila raíz del grafo.

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

El moderador puede publicarlo **en cualquier momento**, no solo al llegar a `cierre_y_ranking` (botón «Cerrar el debate ahora», con confirmación): el motor deja de sincronizar apenas la sesión está cerrada, así que se congelan turnos, bids y puntaje y el ranking queda como estaba. Sin cerrar, el ranking parcial se puede ver y exportar (JSON con `estadoDeLaSesion: "parcial"` y PDF con encabezado «Informe parcial»).

Al recibirlo, cada cliente vuelca su estado derivado (reconstruido desde el log completo de eventos que ya recibió) a un archivo JSON exportable — no requiere una llamada adicional a ningún servidor, el propio cliente ya tiene todo el historial por haber estado suscrito al canal.

## Principio de reconstrucción de estado

Ningún cliente confía en "memoria propia" no verificable: el grafo argumental, los puntajes y el estado de cada turno son siempre una función pura del log de eventos recibido hasta el momento (`estado = reduce(eventos, estadoInicial)`). Esto permite que un participante que se reconecta a mitad de sesión reconstruya el estado completo simplemente pidiendo el historial del canal a Ably (dentro de la ventana de retención), sin necesitar una base de datos.

## Resistencia a refrescos y cortes de conexión

El motor del host es la autoridad única y vive en la memoria de su pestaña. Si el docente
refresca o se le cierra el navegador, se crea un motor nuevo contra el estado reconstruido del
canal — y sin defensa, ese motor repetía todo lo que el anterior ya había hecho: volvía a
puntuar cada argumento, a repartir cada bono de co-moderación, a republicar el argumento de
cada bid aprobado (nodos duplicados en el grafo) y a mandar el debate de vuelta a la primera
fase del Programa.

Por eso **cada acción irrepetible del motor viaja con una `claveDeIdempotencia`** en el primer
evento que publica, y el reducer la registra en `estado.accionesDelMotor`:

```
puntaje-argumento:<argumentId>
validacion-comoderador:<argumentId>
penalidad-rechazo:<turnId>
puntaje-intervencion:<intervencionId>
calificacion-intervencion:<intervencionId>
evaluaciones-finales
bid-resuelto:<bidId>
topico-bids:<turnoPrincipalId>
sugerencias-groq:<tipoDeFase>:<iniciadaEn>
apertura-iniciada:<iniciadaEn>
apertura-ronda-cerrada:<iniciadaEn>:<ronda>
```

Un motor nuevo consulta esas marcas antes de actuar. En la misma línea:

- **El índice de fase se deduce del log** (`fase.historial` + `fase.actual` contra
  `programa.fases`), no de un contador en memoria que al refrescar arrancaba en −1.
- **El motor adopta la oferta de turno que encuentre huérfana**: el temporizador que la hace
  expirar vivía en la pestaña anterior, así que sin esto la oferta quedaba colgada para siempre
  y la ruleta no volvía a girar.
- **`programa.publicado` lleva un campo `origen`** (`arranque`, `configuracion`, `inicio`, `postura-aceptada`) que el reducer ignora y sirve para saber quién publicó cada versión del Programa. La configuración de la sala de espera se publica solo desde los controles que el moderador toca (siempre completa), nunca desde un efecto que compare el canal con el estado local: eso llegó a pisar el perfil de puntaje elegido con el de por defecto (ver `06-pendientes.md`).
- **El host no republica el Programa al reconectar** si el canal ya trae el de esta sesión: lo
  que tiene guardado es el archivo original, sin las posturas filtradas ni el perfil de puntaje
  que eligió, y republicarlo le pisaba al debate su propia configuración.

Del lado del cliente (cualquiera: participante, co-moderador o host):

- **Copia local del log en `localStorage`** por sala (`instantaneaLocal.js`), que se usa como
  punto de partida al abrir. Un F5 ya no depende de que el historial de Ably siga vivo.
- **Recuperación al reconectar**: se vuelve a leer el historial y se aplica lo que falte; los
  mensajes ya vistos se descartan por id, así que nunca se pisa lo que el cliente ya tenía.
- **Aviso en pantalla** cuando la conexión se cae, mientras se pone al día, y —de forma
  permanente— si quedó un hueco que ya nadie puede recuperar.
