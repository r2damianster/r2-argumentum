# Control de lectura (actividad `control_de_lectura`)

> **Estado (4-oct-2026):** diseño aprobado por el docente y **hitos C1–C6 construidos y probados** (861 pruebas, build correcto). **Verificado en local con Ably y Groq reales** (servidor `/api` local + Chrome): los canales privados, la identidad inviolable, la sugerencia de Groq (en cola, anónima, sin que el estudiante la vea) y el flujo completo (entrega, calificación a ciegas, penalización por pegado y su reversión, revisión entre pares, devolución, desacuerdo, podio). **Falta**: la cuota de Groq con una sala de 40, el celular físico y la verificación en producción (ver «Pendiente» y `docs/06-pendientes.md`). Este documento es la fuente de verdad de la decisión.

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
| Tiempo agotado con borrador | Se envía lo que haya, con la marca «enviado por tiempo». Se acepta hasta 2 minutos después del cierre; una entrega normal fuera de tiempo no entra. El envío es **escalonado**: cada cliente espera un tiempo aleatorio (N²/300 s, tope de 75 s; ~5 s con 40 personas, ~21 s con 80) para no superar el límite de mensajes de Ably, y ve «Enviando tu texto…»; si falla, «Reintentar el envío». |
| Se desconecta tras entregar | Al volver ve su devolución: el canal privado conserva historial. |
| Groq falla o no hay cuota | El docente califica a mano; la cola no se bloquea. Hay «Reintentar» por entrega. |
| Revisor que no revisó | No gana puntos y no afecta al autor. |
| Se entra tarde | Puede entregar mientras la escritura siga abierta. Quien llega después de armarse el reparto de pares solo lo califica el docente. |
| Menos de 3 entregas con revisión de pares | No hay reparto; el panel lo avisa y el docente cierra la fase. |

## Salas grandes: modo de ahorro

El selector «Modo de ahorro» está en la configuración previa. **Automático** (por defecto): al iniciar, el host cuenta cuántas personas hay y fija el modo (menos de 50: sala pequeña; de 50 a 119: sala grande moderada; 120 o más: sala grande ahorro); queda registrado en el evento `sesion.modo_de_ahorro_fijado` y no cambia durante la sesión. Se puede forzar uno a mano. **El modo masivo solo se elige a mano y antes de abrir la sala** (el ingreso ya ocurre en la sala de espera). En la sala de espera el docente ve qué modo regiría con los conectados de ahora y, si eligió uno que no corresponde al tamaño de la sala, un aviso para cambiarlo.

| | Sala pequeña | Moderada | Ahorro | Masiva |
|---|---|---|---|---|
| Ingreso | Se publica en la sala; entra a la presencia | Igual | Igual | **Privado** (`entrega.ingreso`); el host lo anuncia en lote (`sesion.ingresos_registrados`); **sin presencia** |
| Aviso de cada entrega | Cada estudiante, al instante | **Lote** del host (`lectura.entregas_registradas`, ≤ 5 s) | Lote | Lote |
| Revisión enviada, respuesta a la devolución, devolución | Avisos sueltos | Sueltos | **Lote** (`lectura.revisiones_registradas`, `lectura.confirmaciones_registradas`, `lectura.devueltas_registradas`) | Lote |
| Confirmación automática al vencer la ventana | Un aviso por persona | Un aviso por persona | Un solo lote | Un solo lote |
| Sugerencias de la IA | Solas, a medida que llegan las entregas | Solas | **Solo cuando el docente las pide** (por entrega o «Pedir sugerencia de las N pendientes») | Por demanda |
| Razonamiento de Groq | Normal | `low` (~50 % menos tokens, medido) | `low` | `low` |
| Envío de borradores al vencer el tiempo | Escalonado según la sala (casi nulo si es chica) | Igual | Igual | Igual |
| Reintento de publicaciones rechazadas; cola de Groq que se pausa ante un 429 | Sí | Sí | Sí | Sí |

En los modos de lote, el estudiante ve **su propia** acción al instante (la pantalla recuerda lo que acaba de enviar); lo que ve de la sala llega con hasta ~5 s de retraso. En el modo masivo, al entrar el estudiante ve «Tu docente te deja pasar en unos segundos» hasta que el host anuncia su ingreso, y el docente **no ve quién está conectado** (solo quién ya ingresó). Todo lo que protagoniza una persona viaja por canales privados que solo lee el host; el estado público sigue sin llevar texto, comentarios, niveles ni notas.

Verificado en vivo (4-oct-2026) en los cuatro modos con Ably y Groq reales (`lectura-vivo-local.mjs`, variable `MODO_DE_AHORRO`). Carga del modo masivo y el límite de conexiones del plan de Ably: `06-pendientes.md`.

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
| `modoDeAhorro` | `automatico` (por defecto), `pequena`, `moderada`, `ahorro` o `masivo`: cómo se cuidan los mensajes de Ably y los tokens de Groq según el tamaño de la sala (ver «Salas grandes» abajo y `nucleo/capacidad/modosDeAhorro.js`) |
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

### Muestra pedagógica de la estructura

Para que el docente la explique y la clase sepa qué se espera, la estructura elegida se **muestra con su definición y un ejemplo resuelto** (`src/shared/componentes/lectura/MuestraPedagogicaDeLaEstructura.jsx`, datos en `estructurasDeEscritura.js`: `queEs` y `ejemplo` de PEEL, SPRE, PREP y CER):
- **Docente, al configurar** (`PantallaDeConfiguracionDeLectura`): «¿Qué es PEEL?» y, debajo, el ejemplo; cambia al elegir otra estructura.
- **Docente, en la sala de espera** (`ResumenDeConfiguracionDeLectura`): la misma muestra con el título «para explicar a la clase», pensada para proyectarla antes de empezar.
- **Estudiante, antes de entrar** (`IngresoAlControlDeLectura`): ve qué es la estructura, sus partes y el ejemplo.

El ejemplo usa **otro tema** (no la consigna) para que sirva de forma sin dar la respuesta, y se adapta a la distribución: `compacta` (todo en un párrafo, una parte por oración) o `desarrollada` (una parte por párrafo). Con una estructura propia del Programa se muestran sus partes sin ejemplo; con `libre` solo hay una orientación («una idea clara, algo que la sostenga y un cierre»).

## Rúbrica y nota

- 4 niveles por criterio: Excelente (3), Bueno (2), Aceptable (1), Insuficiente (0).
- Criterios de serie: pertinencia a la consigna (25), estructura (25), desarrollo del tópico (25), claridad y cohesión (15), corrección lingüística (10).
- **Nota sobre 10 con decimales** = `10 × Σ(peso × nivel/3) / Σ pesos`, redondeada a 2 decimales. Un criterio sin evaluar cuenta 0; para aprobar hay que marcar todos.
- Con un descuento por integridad (automático por pegado o decidido por el docente), **nota final = nota de la rúbrica − descuento** (nunca bajo 0).
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
- El estudiante **nunca** ve la sugerencia. El docente la ve anónima y decide: «Usar como punto de partida», «Aprobar tal cual» (si es completa) o, en lote, «Aprobar las N sugerencias claras» (con confirmación; la IA no aprueba nada sola).
- **Qué entra al lote:** sugerencia completa, confianza ≥ 80 %, **nota sugerida ≥ 6** y **sin marcas de integridad**. Lo comprobó la prueba con Groq real: la «confianza» que informa el modelo mide qué tan seguro está, no qué tan bueno es el texto, y es inestable (el mismo texto flojo dio 20 %, 30 %, 80 % y 90 % en distintas corridas). Por eso una nota baja o una posible copia las mira el docente una por una, aunque Groq diga estar seguro.
- Las llamadas salen **a medida que llegan las entregas**, en cola con 2 a la vez; un fallo se reintenta una vez tras 15 s y queda para «Reintentar». Con 40+ estudiantes son unas 40 llamadas de ~2.000 tokens (~80.000 en total), sin ráfaga al cerrar. La sugerencia queda en el canal privado del docente: un refresco no repite llamadas.
- **Menos tokens por sugerencia:** el modelo se llama con `reasoning_effort: 'low'`. Medido con Groq real el 4-oct-2026: ~900–1.000 tokens por sugerencia en vez de ~1.500–2.400, con los mismos niveles en los textos bueno y flojo (en el texto fuera de tema cambiaron 2 criterios de formato). Con 8.000 tokens por minuto caben unas 8 sugerencias por minuto.
- **Límite por minuto de Groq:** el plan gratuito da 8.000 tokens por minuto, unas 5 sugerencias por minuto. Cuando Groq responde 429, el endpoint lo devuelve con la espera pedida y la **cola se pausa** ese tiempo (5–70 s) y sigue sola; esos choques no cuentan como fallo de la entrega, que muestra «En espera: la IA alcanzó su límite por minuto».
- **Si Groq falla o no hay cuota, no se bloquea nada:** la entrega queda «sin sugerencia» con el aviso «No se pudo obtener la sugerencia. Puedes calificar a mano» y un «Reintentar». El docente califica a mano y el podio y el informe salen igual (regla 9c de `12-guia-para-agentes.md`).
- Esto **no cambia** «Groq no es juez autoritativo»: es una sugerencia que el docente aprueba o corrige. Se actualizó la línea correspondiente de `CLAUDE.md`.

## Integridad (activada por defecto, solo advertencia)

Tres fuentes deterministas, ninguna detecta «texto de IA»:
1. **Señales de redacción** (pegado, arrastre, velocidad imposible, cambio de pestaña), del núcleo. Al enviar, quien escribe ve «el moderador verá esta marca» y elige enviar igual o reescribir. Al llegar el tiempo, el borrador se envía sin esperar esa decisión (las señales se registran igual).
2. **Parecido entre entregas** de la sala: secuencias de 5 palabras; qué porcentaje de lo escrito ya estaba en otra entrega. Lo que va entre comillas no cuenta.
3. **Parecido a los ejemplos del Programa y al `textoDeReferencia`** si lo hay.

**Semáforo** por porcentaje de parecido (umbrales editables en la configuración): sin indicio < 20 %, atención 20–40 %, alto 40–60 %, probable copia ≥ 60 %. Una señal alta de redacción pesa como «alto»; una media, como «atención»; una baja (cambiar de pestaña en el celular es normal) no alerta sola. Con otra entrega solo se muestra su **código anónimo**, nunca quién es.

### Penalización automática por texto pegado (reversible)

Regla del docente, activa por defecto con la integridad encendida (`penalizacionPorPegado: { activa, descuentoMaximo: 5 }`):
1. **Aviso al instante.** Apenas se pega (o arrastra) un bloque de 20 caracteres o más, el estudiante ve «Detectamos texto pegado» y un **color de verde a rojo**. **Nunca ve un número ni el descuento.** Al ingresar ya se le dijo que no debe copiar y pegar.
2. **Quien ve el aviso y borra recupera casi toda su oportunidad, pero no llega a cero.** La parte «pegada» = lo pegado que sigue en el texto + el **20 %** de lo pegado y luego borrado, sobre todo lo que se escribió, pegó y quitó. Pegar todo y borrarlo todo deja un residuo de 1 punto con el máximo por defecto (5), en un color todavía verde pero más bajito; reescribir a mano lo diluye sin eliminarlo. La curva del color es suave al principio para que ese residuo se distinga bien de un pegado fuerte.
3. **Descuento automático** = parte pegada × descuento máximo (5 puntos por defecto, hasta 10; configurable). Se aplica solo a la nota final.
4. **El docente lo revierte**: «Descartar la marca» o «Dejar una observación» lo dejan en 0; «Aplicar un descuento» lo reemplaza por su cifra. En la entrega ve «Descuento automático por texto pegado: −X».
5. Con el nivel «restrictiva» pegar está bloqueado, así que no llega a haber descuento.

El cálculo lo hace el cliente del estudiante y llega por el canal privado de integridad: un estudiante técnico podría falsearlo. Es una advertencia, no una prueba.

El docente decide: **descartar la marca**, **dejar una observación** (no cambia la nota) o **aplicar un descuento** manual (0 a 10 puntos) con motivo obligatorio. **No hay anulación ni nulidad.** Al ingresar se avisa que se registran señales. Las marcas viajan por `debate:integridad:{sala}` (nunca por el canal de la sala) y se descargan en un **anexo aparte** (`…-integridad.json`); no van en el informe general.

## Privacidad: canales

Todo lo que viaja por `debate:sala:*` lo puede leer cualquier participante con las herramientas del navegador. Por eso:

| Canal | Quién publica | Quién lee | Qué viaja |
|---|---|---|---|
| `debate:sala:{sala}` (público) | todos | todos | Solo estados y contadores: `lectura.entregas_registradas` (lo publica el host en lote cada ~5 s: palabras y párrafos, sin texto; antes, un `lectura.entrega_registrada` por estudiante), `lectura.revision_enviada`, `lectura.devuelta`, `lectura.confirmada`, `lectura.podio_publicado` (posiciones, sin notas ni puntos) |
| `debate:entrega:{sala}` | participantes (solo publicar, por REST) | host | El texto de la entrega, la respuesta a la devolución con su motivo, las revisiones de pares |
| `debate:docente:{sala}` | host | host | Calificaciones, sugerencias de Groq, reparto de pares, decisiones sobre revisiones e integridad (su estado privado) |
| `debate:devolucion:{clientId}:{sala}` | host (por REST) | solo ese cliente | Comentarios por criterio, textos que le toca revisar (sin autor) y cómo le fue como revisor |

El host reconstruye su estado privado desde el historial de `entrega` y `docente` y de una copia local del navegador (12 h), como ya hace con la integridad. El estado público nunca contiene textos, comentarios, niveles ni notas (hay pruebas que lo verifican). Las capacidades de cada token están en `api/ably-token.js`.

**Identidad inviolable (resuelto).** El `clientId` ya no se puede suplantar copiándolo de la presencia: se **deriva de un secreto** que solo conoce su dueño (`clientId = «p-» + SHA-256(secreto)[0..32]`). El secreto lo genera el navegador al ingresar, se guarda con la identidad recordada y viaja solo en una cabecera al pedir el token; `/api/ably-token` recalcula y compara (sin base de datos). Pruebas con Ably real: otro participante que pide el token con el id de Ana recibe 401. Efecto: identidades guardadas **antes** de este cambio dejan de servir y hay que ingresar de nuevo (conviene desplegarlo entre clases).

**Límites conocidos de esta capa:**
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

## Verificado con Ably real (4-oct-2026, en local)

Servidor `/api` local con la clave de Ably y un navegador real con 1 host y 3 participantes: el host recibe lo que publican los participantes por REST con el `clientId` puesto por Ably; un participante **no** puede leer `debate:entrega`, `debate:docente` ni la devolución de otro, ni publicar en el canal del docente; el historial de `devolucion` se recupera; la suplantación de identidad se rechaza; y el flujo completo (entrega, calificación a ciegas, penalización por pegado y su reversión, parecido entre entregas, reparto de pares, revisión, aprobación, devolución sin nota, desacuerdo y reconsideración, podio sin notas, resultado del revisor) funciona.

## Pendiente

- **Groq real, verificado en local (4-oct-2026):** el modelo distingue un texto bueno (todo «excelente», 4 de 4 partes de PEEL detectadas), uno flojo (todo «insuficiente») y uno fuera de tema; los comentarios por criterio son útiles y se dirigen a la persona; responde en ~1 s por entrega. La «confianza» resultó inestable, por eso el lote exige además nota sugerida ≥ 6 y sin marcas. Falta ver la **cuota con una sala de 40** (con el plan gratuito algunas entregas podrían recibir 429: no bloquea, quedan para calificar a mano o «Reintentar») y repetirlo en producción.
- **En producción:** repetir la prueba tras el despliegue (login del host, ingreso, canales privados).
- **Celular físico:** escribir 2 párrafos (teclado, borrador, cuenta atrás) y revisar a 320 px.
- **Prueba automática:** `node scripts/prueba-e2e/lectura-vivo-local.mjs` recorre en Chrome, **en local**, la configuración, la sala de espera, 3 entregas, las sugerencias de Groq en cola y el lote (necesita `.env.local` con las claves, el servidor `/api` local y `vite`; ver el encabezado de `foro-vivo-local.mjs`). No hay todavía un script contra producción: usa el procedimiento de `docs/10-guia-prueba-manual-chrome.md`.
- **Fuera de alcance de esta versión:** lectura grupal (otra actividad futura), «Revisión entre pares» de textos traídos de fuera (se compone con el módulo ya construido), segunda versión del texto.
