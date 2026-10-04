# Control de lectura (actividad `control_de_lectura`)

> **Estado (4-oct-2026):** diseño aprobado por el docente y **hitos C1–C6 construidos y probados en local** (813 pruebas, build correcto). **Falta la verificación en producción**: no se pudo comprobar con Ably y Groq reales (ver «Pendiente» al final y `docs/06-pendientes.md`). Este documento es la fuente de verdad de la decisión.

## Qué es

Tercera actividad de la plataforma. Cada estudiante escribe **individualmente** un texto (uno o varios párrafos) sobre un tópico, durante un tiempo total, a partir de una lectura que hizo antes y por fuera. No hay posturas ni debate. Sirve para comprobar que leyó y para dar retroalimentación formativa; la nota es sumativa y solo la ve el docente.

Todos los participantes reciben **la misma consigna**. Lo que se evalúa es el tópico y la estructura, no la comprensión literal del texto: el texto de la lectura **no se sube ni se muestra**.

## Flujo por entrega

```
escribiendo → entregada → [revisión de pares] → docente califica (a ciegas) → devuelta → confirmada → podio
                  ↘ Groq sugiere nota y comentarios (anónimo) ↗
```

| Fase | Quién | Tiempo |
|---|---|---|
| Escritura (`control_de_lectura`) | Estudiantes, en celular, un solo cuadro de texto. Se entra tarde. Sin edición tras enviar. | Total y extendible. Al llegar a cero se envía el borrador (marca «enviado por tiempo»). |
| Revisión de pares (`revision_de_pares`, opcional) | Cada estudiante revisa 2 textos ajenos, anónimo, con la rúbrica y un comentario | Temporizador propio, extendible |
| Calificación y devolución (`cierre_y_ranking`) | Docente | Sin tiempo. La cola de calificación se abre desde la primera entrega, en paralelo a la escritura. |

- La devolución al estudiante lleva **solo los comentarios por criterio** de la rúbrica, un comentario general y, si hay revisión entre pares, los comentarios de compañeros que el docente aprobó. **La nota nunca llega al estudiante**: es un cálculo final que ve solo el docente y entra al informe.
- Con revisión de pares activa, la devolución se envía cuando termina esa fase (los botones de devolver se desactivan hasta entonces), para que nadie lea su devolución mientras revisa.
- El estudiante dispone de una **ventana de confirmación** (10 min por defecto, la fija el docente). Puede decir «De acuerdo» o «No estoy de acuerdo» con un motivo (el docente reconsidera una sola vez). Si no responde, el motor del host la **confirma sola** al vencer la ventana, con la calificación asignada y la marca «sin responder».
- Si el docente modifica la nota después de la confirmación, **no se reenvía nada** al estudiante; solo cambia lo que se descarga.

### Escenarios previstos

| Escenario | Qué pasa |
|---|---|
| Estudiante en desacuerdo | Escribe un motivo (lo ve solo el docente). El docente mantiene o cambia la calificación **una sola vez**; el estudiante recibe los comentarios actualizados («revisada») y la ventana original no se reabre. |
| Nunca confirma | Confirmación automática al vencer la ventana. |
| No entregó | Cuenta 0 y aparece como «sin entrega» en el informe. |
| Tiempo agotado con borrador | Se envía lo que haya, con la marca «enviado por tiempo». Se acepta hasta 2 minutos después del cierre; una entrega normal fuera de tiempo no entra. |
| Se desconecta tras entregar | Al volver ve su devolución: el canal privado conserva historial. |
| Groq falla o no hay cuota | El docente califica a mano; la cola no se bloquea. Hay «Reintentar» por entrega. |
| Revisor que no revisó | No gana puntos y no afecta al autor. |
| Se entra tarde | Puede entregar mientras la escritura siga abierta. Quien llega después de armarse el reparto de pares solo lo califica el docente. |
| Menos de 3 entregas con revisión de pares | No hay reparto; el panel lo avisa y el docente cierra la fase. |

## Anonimato del docente

El docente ve «Entrega K7F2», un **código derivado de un hash** de quien la escribió (no el orden de llegada: «Entrega 03» delataría a quien entregó tercero). El código no cambia mientras llegan otras entregas. Las pendientes van primero. **La identidad se revela solo al aprobar** la calificación. A Groq tampoco se le envían nombres. En «Quiénes todavía no entregan» solo aparecen quienes faltan, para no romper el anonimato de quien ya entregó.

## Programa: campos propios

| Campo | Contenido |
|---|---|
| `actividad` | `control_de_lectura` |
| `consigna` | Lo que deben escribir |
| `estructura` | `"peel"`, `"spre"`, `"prep"`, `"cer"`, `"libre"` o una propia `{ nombre, partes: [{ nombre, descripcion }] }` (textos simples o `{ es, en }`) |
| `distribucion` | `compacta` (la estructura completa dentro de cada párrafo, una parte por oración) o `desarrollada` (una parte por párrafo) |
| `numeroDeParrafos` | Se fija de antemano. En `desarrollada` se ajusta al múltiplo del número de partes. |
| `rubrica` | Criterios `{ id, nombre, descripcion, peso }`; sin ella rige la base de serie. Se complementa con `criteriosDeLaConsigna` (texto o `{ nombre, peso }`) |
| `clavesDeLaLectura` | Opcional, markdown. **Solo host**: se retira del Programa que se publica y solo lo usa el host al llamar a Groq. |
| `textoDeReferencia` | Opcional. **Solo host**: sirve para detectar copia literal de la lectura. No se envía a Groq. |
| `revisionDePares` | `{ activa, revisionesPorPersona: 2, duracionMin: 10 }` |
| `ventanaDeConfirmacionMin` | 10 por defecto |
| `umbralesDeSimilitud` | `{ atencion: 20, alto: 40, probableCopia: 60 }` |
| `integridad` | `{ nivel }`; **con advertencias por defecto** en esta actividad |

No hay `posturas`: el Programa las trae vacías (`cargarPrograma` no las exige para esta actividad). Idioma, integridad y duración se ajustan en la configuración previa (`PantallaDeConfiguracionDeLectura`). Los Programas se pueden escribir en el código (`src/shared/programa/ejemplos/`) o cargar como `.json` con `"actividad": "control_de_lectura"`, igual que las demás actividades. Hay un ejemplo: `lectura-formacion-en-investigacion.json`.

### Estructuras de serie

| Id | Partes (ES) | Partes (EN) |
|---|---|---|
| `peel` | Punto, Evidencia, Explicación, Enlace | Point, Evidence, Explain, Link |
| `spre` | Situación, Problema, Respuesta, Evaluación | Situation, Problem, Response, Evaluation |
| `prep` | Punto, Razón, Ejemplo, Punto | Point, Reason, Example, Point |
| `cer` | Afirmación, Evidencia, Razonamiento | Claim, Evidence, Reasoning |
| `libre` | — | — |

La app **no restringe** lo que se escribe: solo cuenta palabras y párrafos y muestra la guía de la estructura. Que el texto la siga lo sugiere Groq y lo decide el docente. (Los nombres en inglés son los de la estructura cuando el ejercicio se hace en inglés; el resto de la interfaz sigue en español.)

## Rúbrica y nota

- 4 niveles por criterio: Excelente (3), Bueno (2), Aceptable (1), Insuficiente (0).
- Criterios de serie: pertinencia a la consigna (25), estructura (25), desarrollo del tópico (25), claridad y cohesión (15), corrección lingüística (10).
- **Nota sobre 10 con decimales** = `10 × Σ(peso × nivel/3) / Σ pesos`, redondeada a 2 decimales. Un criterio sin evaluar cuenta 0; para aprobar hay que marcar todos.
- Con un descuento por integridad decidido por el docente, **nota final = nota de la rúbrica − descuento** (nunca bajo 0).
- **Podio:** solo los 5 primeros lugares. Empate exacto comparte lugar. **No se muestra la nota** (ni en la sala ni al estudiante). Puntuación del podio = nota final + puntos de revisión entre pares.

## Revisión de pares (módulo del núcleo: `nucleo/revisionEntrePares`)

- Reparto en **anillo barajado**, anónimo: nadie se revisa a sí mismo y cada texto recibe tantas revisiones como cada persona hace (2 por defecto, máximo `n − 1`). Mínimo 3 entregas. El host lo hace una sola vez al empezar la fase y lo guarda en su canal privado; cada revisor recibe sus textos **sin el autor**, identificados solo por un índice.
- Mismo formato que el docente: nivel por criterio y comentarios. Solo revisa quien entregó.
- **El docente decide qué llega al autor:** cada revisión se aprueba (con los comentarios que él deje, editados o no), se descarta, o se aprueban todas las pendientes de una vez. Los niveles del par **nunca** llegan al autor, y la revisión no entra en la nota del autor (evita colusión).
- **Puntos del revisor** (máximo 1 por texto asignado, 2 con los valores por defecto): `1 × textos asignados × acierto × esfuerzo`. El acierto es la cercanía con la calificación final del docente (media ponderada por el peso de cada criterio), corregida por azar (cercanía 0,5 = 0). El esfuerzo es la fracción de revisiones válidas. Sin calificación del docente con qué comparar, el acierto es neutro (0,5). Una revisión que el docente descartó no cuenta como acierto ni como esfuerzo.
- **Feedback del porqué** al revisor, determinista (sin Groq) y enviado al cerrar: por criterio, «coincidió con la evaluación del docente» / «difirió en N niveles». No revela el nivel ni la nota del autor.
- Es una pieza del núcleo: más adelante puede componerse una actividad «Revisión entre pares» de textos traídos de fuera.

## Groq (solo sugiere)

- Por cada entrega, el host consulta a Groq (`api/groq-sugerir-calificacion.js`): nivel sugerido por criterio, comentarios por criterio, partes de la estructura detectadas, comentario general y confianza. Todo se valida: criterios y niveles inexistentes se descartan.
- **Solo el host puede pedirlo** (exige el token de su sesión): protege la cuota y las claves de la lectura. Un texto de menos de 5 palabras no gasta una llamada.
- El estudiante **nunca** ve la sugerencia. El docente la ve anónima y decide: «Usar como punto de partida», «Aprobar tal cual» (si es completa) o, en lote, «Aprobar las N sugerencias de confianza alta» (≥ 80 %, con confirmación; la IA no aprueba nada sola).
- Las llamadas salen **a medida que llegan las entregas**, en cola con 2 a la vez; un fallo se reintenta una vez tras 15 s y queda para «Reintentar». Con 40+ estudiantes son unas 40 llamadas de ~2.000 tokens (~80.000 en total), sin ráfaga al cerrar. La sugerencia queda en el canal privado del docente: un refresco no repite llamadas.
- Esto **no cambia** «Groq no es juez autoritativo»: es una sugerencia que el docente aprueba o corrige. Se actualizó la línea correspondiente de `CLAUDE.md`.

## Integridad (activada por defecto, solo advertencia)

Tres fuentes deterministas, ninguna detecta «texto de IA»:
1. **Señales de redacción** (pegado, arrastre, velocidad imposible, cambio de pestaña), del núcleo. Al enviar, quien escribe ve «el moderador verá esta marca» y elige enviar igual o reescribir. Al llegar el tiempo, el borrador se envía sin esperar esa decisión (las señales se registran igual).
2. **Parecido entre entregas** de la sala: secuencias de 5 palabras; qué porcentaje de lo escrito ya estaba en otra entrega. Lo que va entre comillas no cuenta.
3. **Parecido a los ejemplos del Programa y al `textoDeReferencia`** si lo hay.

**Semáforo** por porcentaje de parecido (umbrales editables en la configuración): sin indicio < 20 %, atención 20–40 %, alto 40–60 %, probable copia ≥ 60 %. Una señal alta de redacción pesa como «alto»; una media, como «atención»; una baja (cambiar de pestaña en el celular es normal) no alerta sola. Con otra entrega solo se muestra su **código anónimo**, nunca quién es.

El docente decide: **descartar la marca**, **dejar una observación** (no cambia la nota) o **aplicar un descuento** manual (0 a 10 puntos) con motivo obligatorio. **No hay sanción automática ni nulidad.** Al ingresar se avisa que se registran señales. Las marcas viajan por `debate:integridad:{sala}` (nunca por el canal de la sala) y se descargan en un **anexo aparte** (`…-integridad.json`); no van en el informe general.

## Privacidad: canales

Todo lo que viaja por `debate:sala:*` lo puede leer cualquier participante con las herramientas del navegador. Por eso:

| Canal | Quién publica | Quién lee | Qué viaja |
|---|---|---|---|
| `debate:sala:{sala}` (público) | todos | todos | Solo estados y contadores: `lectura.entrega_registrada` (palabras y párrafos, sin texto), `lectura.revision_enviada`, `lectura.devuelta`, `lectura.confirmada`, `lectura.podio_publicado` (posiciones, sin notas ni puntos) |
| `debate:entrega:{sala}` | participantes (solo publicar, por REST) | host | El texto de la entrega, la respuesta a la devolución con su motivo, las revisiones de pares |
| `debate:docente:{sala}` | host | host | Calificaciones, sugerencias de Groq, reparto de pares, decisiones sobre revisiones e integridad (su estado privado) |
| `debate:devolucion:{clientId}:{sala}` | host (por REST) | solo ese cliente | Comentarios por criterio, textos que le toca revisar (sin autor) y cómo le fue como revisor |

El host reconstruye su estado privado desde el historial de `entrega` y `docente` y de una copia local del navegador (12 h), como ya hace con la integridad. El estado público nunca contiene textos, comentarios, niveles ni notas (hay pruebas que lo verifican). Las capacidades de cada token están en `api/ably-token.js`.

**Límites conocidos de esta capa:**
- Cualquiera puede pedir un token con el `clientId` de otra persona (solo `host` está protegido). Un estudiante técnico podría leer la devolución de otro (comentarios, nunca notas) o entregar a su nombre. Es el mismo límite que ya tenía el resto de la plataforma; se mitiga porque el `participantId` no se muestra y no es adivinable, no porque esté impedido.
- Los mensajes de Ably tienen un tope de 64 KB: la entrega acepta hasta 20.000 caracteres y cada revisor recibe sus textos en un solo mensaje (con 2 a 3 textos de tamaño normal no hay problema).
- La retención del historial de Ably es corta: si la clase se prolonga mucho, el estudiante que vuelve tarde puede no ver su devolución (la copia local del host sí sobrevive a un refresco).

## Informe

- **JSON** (confidencial): por persona, estado de la entrega, texto, niveles, comentarios, nota de la rúbrica, descuento, nota final, respuesta a la devolución y motivo del desacuerdo.
- **CSV** para el registro de notas (abre en Excel con tildes).
- **Resumen de notas imprimible** (PDF por el diálogo del navegador): nombre, entrega, nota y respuesta.
- **Anexo de integridad** (JSON, aparte).
- Todo se arma en el navegador del docente: sin contenido en servidor.

## Proyección

Sin nombres ni textos ni notas: consigna y estructura, cuenta atrás y contadores (en la sala, entregaron, faltan, revisiones, devueltas, confirmadas). Al final, el podio.

## Cómo quedó construido

- `src/shared/nucleo/escritura/` (conteos y estructuras), `rubrica/`, `podio/`, `revisionEntrePares/` (reparto, puntos), `entregas/` (estado público y privado, canales, revisiones de pares, integridad de las entregas), `integridad/similitudDeTextos.js`, `sugerenciaDeIA/` (cliente y cola de consultas).
- `src/actividades/controlDeLectura/`: definición, Programa, motor (tiempo de fases, confirmación automática, podio al cerrar), informe.
- Contrato de actividad: se agregó el gancho `antesDeCerrarLaSesion` (publica el podio justo antes de `session.closed`) y el motor base acepta `estadoPrivado`.
- Pantallas: `src/player/componentes/lectura/` y `src/host/componentes/lectura/`; hooks `useEstadoPrivadoDelHost`, `useSugerenciasDeCalificacion`, `useAsignacionDePares` y `useMensajesPrivadosDelEstudiante`.
- Eventos públicos nuevos: `lectura.entrega_registrada`, `lectura.revision_enviada`, `lectura.devuelta`, `lectura.confirmada`, `lectura.podio_publicado` (ver `09`). El reducer acepta cada uno solo si lo publicó quien dice ser.

## Pendiente (hito C6, verificación en producción)

- **Canales privados con Ably real:** que el host reciba lo que los participantes publican por REST, que un participante **no** pueda suscribirse a `entrega` ni leer el canal de otra persona, y que el historial de `devolucion` se recupere al reconectar. Es lo más incierto, igual que el canal de integridad del foro.
- **Groq real:** calidad de la sugerencia y cuota con una sala grande.
- **Celular físico:** escribir 2 párrafos (teclado, borrador, cuenta atrás) y revisar a 320 px.
- No hay script E2E (`scripts/prueba-e2e/`) para esta actividad: se podría escribir cuando haya una sala de prueba; mientras tanto, usa el procedimiento de `docs/10-guia-prueba-manual-chrome.md`.
- **Fuera de alcance de esta versión:** lectura grupal (otra actividad futura), «Revisión entre pares» de textos traídos de fuera (se compone con el módulo ya construido), segunda versión del texto.
