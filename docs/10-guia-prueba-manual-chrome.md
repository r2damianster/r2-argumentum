# Guía de prueba manual — R2 Argumentum (motor real, multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: correr un debate real de punta a punta (login del host, Programa, sala, turnos, argumentos validados por Groq, conexiones, bids, co-moderación, puntaje, ranking y export) contra producción, y devolver una lista de fallos/problemas detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe.

## 0. Entorno

- Usar **producción**: `https://r2-argumentum.vercel.app/`.
  - Host: `/host.html` (o la raíz `/` sin parámetros, redirige ahí) — Usuario `arturo.rodriguez@uleam.edu.ec` · Clave `R2ironmaiden`.
  - Participante: `/player.html`, o el link corto `/?sala=XXXX` (raíz con el código) — redirige a `/player.html?sala=XXXX`. Este es el que genera el QR y el botón "Copiar link" del host, pensado para pegar en WhatsApp.
- **No probar contra local (`npm run dev` / `vercel dev`)**: `ABLY_API_KEY` y `GROQ_API_KEY` son variables "Sensitive" en Vercel — nunca se pueden recuperar vía CLI, solo corren en la infraestructura de Vercel. Local no puede ejercitar Groq/Ably.

## 1. Restricción operativa crítica — leer antes de empezar

**Ably retiene el historial del canal solo ~2 minutos por defecto** (`docs/02-arquitectura.md`). Esto no es un bug, es la arquitectura elegida ("sin base de datos"). Implicaciones para la prueba:

- **Movete rápido entre pasos.** Si te tomás varios minutos pensando/debuggeando entre acciones, al refrescar o reconectar una pestaña el historial ya expiró y la sesión aparece vacía (host: "La sesión todavía no empezó", puntajes en 0; participante: mensaje "No se pudo recuperar la sesión..."). **Esto NO es un fallo a reportar** si pasaron varios minutos — es el límite documentado. Si pasa con **menos de ~90 segundos** de por medio, sí es sospechoso y merece reportarse.
- Si una pestaña de host se pierde/recarga y no podés recuperar la sesión, lo más simple es arrancar una sesión **nueva** (nuevo código de sala) y hacer que los participantes reingresen con `?sala={codigoNuevo}`, en vez de pelear por recuperar la vieja.
- No dejes pasar tiempo muerto largo entre "Iniciar sesión" en el host y que los participantes actúen.

## 2. Qué SÍ está implementado — el motor real completo

- **Login + selector de Programa de Debate**: catálogo por categoría (Política, Filosofía) o carga de `.json` propio, con tarjeta de resumen (título/tema/posturas) antes de generar sala. El login ahora se recuerda en `localStorage` — no debería pedir usuario/clave de nuevo en el mismo navegador aunque se cierre la pestaña (antes se perdía con cualquier refresh).
- **Sala de configuración previa**: tras elegir Programa, todo lo de "antes de arrancar" (código+QR, participantes conectados, selector de posturas, botón "Iniciar sesión") vive en una sola tarjeta con fondo distinto — se comparte el link ahí para que se vayan conectando mientras se configura. El feed de actividad y el grafo NO aparecen todavía en esta pantalla, solo después de "Iniciar sesión".
- **Selector de posturas** (solo si el Programa tiene más de 2): dentro de la sala de configuración previa, checklist con todas las posturas tildadas por defecto — el moderador puede destildar las que no quiere debatir esa sesión (mínimo 2). El nuevo ejemplo "¿Qué hace único al ser humano?" (categoría Filosofía) tiene 12 posturas candidatas, pensado justo para esto.
- **"Iniciar sesión"** (botón del host): sortea co-moderadores (`ceil(n×0.10)`, mínimo 1) y asigna posturas (solo las elegidas en el selector) al resto, arranca la fase **`Apertura simultánea`** (no directo a la ruleta de turnos).
- **Autoselección de postura**: si el Programa tiene `asignacionPostura: "libre"` (el de 12 posturas filosóficas la usa), el participante ve una pantalla bloqueante "Elegí la postura que vas a defender" en vez de que se la asignen al azar — no puede hacer nada más hasta elegir. Los co-moderadores nunca la ven.
- **Fase de apertura simultánea** (nueva): todos los participantes (no co-moderadores) escriben su argumento inicial AL MISMO TIEMPO, sin turno — siempre tipo "nuevo", sin selector de tipo/objetivo (no hay nada previo a lo que responder). El feed muestra "✍️ Todos escriben su argumento inicial — N/M ya enviaron el suyo". La fase se cierra sola cuando todos terminaron, o al agotar el tiempo límite del Programa (4-5 min en los ejemplos) — lo que pase primero. Al cerrarse dispara Groq-conexiones sobre todo el lote antes de pasar a la ruleta de reacciones.
- **Ruleta de turnos** (arranca después de la apertura): prioridad absoluta a quien no tuvo turno, timeout de aceptación (reoferta a otro), tope de rechazos (fuerza el turno). Ver casos borde en la sección 5.
- **Escritura de argumento**: tipo (nuevo/contra/refuerzo/dilema/pregunta/concesión) + objetivo si aplica + texto → validación Groq (checkpoint 1: ¿tiene claim + razón?). Si rechaza, muestra motivo y permite reintentar (máx. 2 intentos); al agotar intentos, escala directo a co-moderador (`viaCoModerador: true`).
- **Grafo argumental en vivo** (React Flow): un nodo por argumento, columnas por postura, color semántico por tipo (`docs/08-identidad-visual.md`), aristas por conexión.
- **Conexión libre**: un participante conecta uno de sus propios argumentos (sin salida previa) con el de otro, eligiendo tipo de relación.
- **"Cerrar fase actual"** (host): al cerrar una fase de escritura, dispara automáticamente UNA llamada a Groq (checkpoint 2, sugerencia de conexiones en lote) y avanza a la siguiente fase del Programa.
- **Sugerencias de Groq**: visibles solo a los 2 participantes dueños de los argumentos involucrados, con botones Aceptar/Rechazar.
- **Bids de intervención**: mientras alguien tiene el turno, otro participante puede lanzar un bid (Desmontar/Fortalecer) sobre uno de sus argumentos; co-moderadores votan aprueba/rechaza; el host da el veredicto final (`PanelDeDecisionDeBids`), que publica el argumento resultante + puntaje.
- **Panel de co-moderador**: valida argumentos pendientes (confirma/corrige tipo, marca falta, nota) y vota bids abiertos.
- **Puntaje en vivo**: el host ve un marcador ordenado por puntaje con medallas 🥇🥈🥉 (no una lista plana), calculado por la fórmula única (`docs/05-reglas-de-puntaje.md`).
- **Grafo proyectable en el host**: el host ahora ve el mismo mapa argumental que los participantes, visible durante toda la sesión (antes solo aparecía al cierre) — es lo que se proyectaría en el salón mientras se debate.
- **Feed de actividad narrado** (host y player): banner "🗣️ {nombre} está hablando ahora" mientras alguien tiene el turno en curso, "⏳ Se le ofreció el turno a {nombre}…" mientras espera aceptación, y una lista de "Actividad reciente" ("💬 {nombre} agregó un contraargumento", "🔗 {nombre} conectó su argumento (refuerzo)"). Instrucciones explícitas en el turno ofrecido ("Aceptá para escribir un argumento nuevo…") y en el formulario de argumento (qué tipos podés usar). Aviso de anonimidad en el panel de co-moderador al votar bids y validar argumentos.
- **Cierre de sesión + Ranking**: al llegar a la fase `cierre_y_ranking`, el host ve ranking por postura con tiers (🥇 Sólido / 🥈 Consistente / 🥉 En desarrollo) y botón para descargar la sesión completa en `.json`. El participante ve su propio resultado (puntaje + tier).

## 3. Bugs ya encontrados y arreglados — verificar que NO reaparezcan (regresión), no "redescubrirlos"

Estos 12 ya se arreglaron en sesiones de prueba anteriores. Si alguno reaparece, es una regresión real y sí va en la tabla de fallos:

**Primera ronda (motor base):**
1. Historial de Ably no cargaba (incompatibilidad `direction:forwards` + `untilAttach`).
2. Validación Groq fallaba casi siempre por `max_tokens` insuficiente (truncaba el JSON).
3. Un error HTTP del validador se mostraba como mensaje de error vacío.
4. Nodo de argumento "nuevo" se pintaba gris en vez de azul (mismatch de clave de color).
5. **Deadlock de turnos**: si el único participante elegible dejaba expirar su oferta de turno, quedaba excluido para siempre y la ruleta nunca volvía a ofrecer nada.

**Segunda ronda (bids, grafo, nombres, Groq):**
6. **Bids nunca se resolvían** — no había forma de cerrar el "tópico" de bids ni de que el host viera el veredicto. Ahora se cierra solo cuando todos los co-moderadores votaron (o expiraron), y el host tiene botón "Cerrar tópico de bids ahora" para cortarlo antes. **El más importante de re-verificar**: lanzar un bid, votarlo desde el co-moderador, y confirmar que el host lo ve para dar veredicto.
7. **Grafo con nodos superpuestos/ilegibles** — el espaciado vertical entre nodos de la misma columna era menor que la altura real del contenido. Con 3+ argumentos en la misma postura, confirmar que los nodos NO se tapan entre sí.
8. **Nombres reemplazados por IDs internos** (`participante-1789...`) en el grafo, el ranking y el export — confirmar que en las 3 vistas aparece el nombre elegido por el participante, no un ID técnico.
9. Validación Groq exigía la palabra literal "porque"/"ya que" y rechazaba argumentos con razón causal válida pero redactada distinto (ej. "...lo que retrasa la respuesta del mercado."). Confirmar con un argumento así que ahora se acepta.
10. Dos botones "Cerrar sesión" con significados distintos (logout del host vs. cerrar el debate) — el de la pantalla de ranking ahora dice "Cerrar debate".

**Tercera ronda (probada con 11 participantes reales):**
11. **Nombre reemplazado por ID técnico al desconectarse un participante** — al perder la conexión un momento, su nombre desaparecía de `presencia` y el grafo/ranking mostraban el ID técnico en TODOS los demás clientes hasta que volvía a entrar. Ahora el nombre sobrevive a un blip de conexión. Para probarlo: cerrar y reabrir la pestaña de un participante que ya tenga un argumento publicado, y confirmar en OTRA pestaña que su nombre sigue viéndose (no un ID) durante la desconexión, no solo después de reconectar.
12. El banner decía "Esperando que el MODERADOR ofrezca el próximo turno…", dando a entender que el moderador aprieta algo por cada turno — es automático (ruleta), el moderador no hace nada por turno individual. Texto corregido a "Esperando que se ofrezca el próximo turno…".

**Features nuevas, sin probar todavía — verificar por primera vez:**

- **Selector de posturas.** Cargar el Programa "¿Qué hace único al ser humano?" (categoría Filosofía, 12 posturas) en vez del de Política. Antes de "Iniciar sesión" debe aparecer un checklist con las 12 tildadas por defecto. Destildar todas menos 2-3, confirmar que el botón "Iniciar sesión" se deshabilita si quedan menos de 2 tildadas, e iniciar con 2-3. Verificar que SOLO esas posturas se asignan a los participantes, aparecen en el grafo/ranking, y el resto de las 12 no aparece en ningún lado.
- **Feed de actividad narrado + grafo en vivo en el host.** Antes el host no veía nada del contenido del debate mientras pasaba (solo lista de participantes y control de fases) — ahora debería verse como pantalla proyectable real. Verificar en el HOST, durante la fase de escritura: (a) mientras alguien tiene el turno en curso, aparece el banner "🗣️ {nombre} está hablando ahora"; (b) mientras se le ofrece el turno a alguien y todavía no acepta, aparece "⏳ Se le ofreció el turno a {nombre}…"; (c) la lista "Actividad reciente" muestra cada argumento publicado ("💬 {nombre} agregó un [tipo]") y cada conexión ("🔗 {nombre} conectó su argumento (tipo)"), más reciente primero, máximo 6; (d) el mapa argumental (grafo) está visible en el host desde que arranca la sesión, no solo al cierre. Verificar también en el PLAYER que ve el mismo feed (le sirve para saber cuándo esperar) y que el formulario de argumento y la pantalla de turno ofrecido tienen instrucciones explícitas de qué puede hacer (no solo un formulario vacío). Verificar que el panel de co-moderador muestra el aviso de anonimidad al votar bids y al validar argumentos.
- **Login persistente del host.** Loguearse, cerrar la pestaña (no "Cerrar sesión"), abrir `/host.html` de nuevo en el mismo navegador → debería entrar directo al selector de Programa sin pedir usuario/clave. "Cerrar sesión" sí debe volver a pedirla la próxima vez.
- **Sala de configuración previa como pantalla propia.** Confirmar que antes de "Iniciar sesión" NO aparecen el feed de actividad ni el grafo (estarían vacíos, no corresponde mostrarlos todavía) — solo código/QR, participantes conectados y el selector de posturas + botón, todo agrupado con un fondo distinto ("Sala de configuración previa").
- **Autoselección de postura.** Usar el Programa "¿Qué hace único al ser humano?" (ahora es `asignacionPostura: "libre"`). Tras "Iniciar sesión", cada participante NO co-moderador debe ver una pantalla bloqueante "Elegí la postura que vas a defender" con las posturas elegidas por el host como botones — nada de formulario de argumento ni feed hasta elegir. Confirmar que el co-moderador nunca ve esta pantalla.
- **Fase de apertura simultánea (mecánica nueva completa).** Tras "Iniciar sesión", TODOS los participantes (no co-moderadores) deben poder escribir su argumento inicial a la vez, sin esperar turno ni ver "¡Te tocó el turno!" — el formulario no tiene selector de tipo (siempre es "nuevo"). Con el Programa `asignacionPostura:"libre"`, si un participante tarda en elegir postura, confirmar que la fase NO se cierra hasta que también él escriba (no debe poder cerrarse "dejándolo afuera"). Confirmar que al escribir todos (o agotarse el tiempo configurado — 4-5 min según el Programa), la fase cierra sola, se dispara Groq-conexiones sobre el lote completo, y recién ahí aparece la primera oferta de turno de la ruleta de reacciones.
- **Link corto compartible (`/?sala=XXXX`).** En la sala de configuración previa del host, confirmar que el texto bajo el QR muestra un link con la forma `https://r2-argumentum.vercel.app/?sala=XXXX` (no `/player.html?sala=XXXX`), que el botón "📋 Copiar link para compartir" copia ese link (cambia a "✅ Copiado" 2 segundos) y que pegarlo en una pestaña nueva redirige correctamente a `/player.html?sala=XXXX` con el código prellenado. Confirmar también que abrir la raíz `https://r2-argumentum.vercel.app/` SIN parámetro sigue yendo al login del host, como antes.

## 4. Escenario multi-ventana (mínimo 4 pestañas: 1 host + 3 participantes)

Con solo 2 participantes, `ceil(2×0.10)`=1 co-moderador deja apenas 1 argumentador — insuficiente para probar bids (hace falta alguien con turno + alguien más para lanzar el bid + el co-moderador para votar). Usar 3 participantes da más margen.

1. **Host**: login → Programa "Izquierda o derecha" (categoría Política) → anotar código de sala.
2. **Participantes** (3 pestañas): entrar con nombres "Ana", "Luis", "Marta", emojis distintos, mismo código.
3. **Host**: "Iniciar sesión". Confirmar: 1 co-moderador sorteado, los otros 2 con postura asignada, fase **"Apertura simultánea"** activa (no "Escritura de argumentos" todavía).
4. Ambos participantes NO co-moderadores escriben su argumento inicial en paralelo (sin esperar turno): uno escribe un argumento **malo** (sin "porque"/razón) → confirmar rechazo de Groq con motivo → reintentar con uno **bueno** (con razón/evidencia); el otro escribe directamente uno bueno. Confirmar que ambos se publican y aparecen en el grafo con el color correcto según su tipo, y que la fase cierra sola (o esperar el timer) pasando a "Escritura de argumentos · Ronda 1".
5. El co-moderador: confirmar que ve el argumento en "Argumentos por validar", confirmar la validación → verificar que el puntaje aparece en vivo en el host (fórmula: posición 1, ronda 1, sin descuento = 10 pts).
6. Repetir turno con el otro participante para tener 2+ argumentos.
7. **Bid**: mientras alguien tiene el turno, el tercer participante lanza un bid (Desmontar o Fortalecer) sobre un argumento de quien tiene el turno. El co-moderador vota (aprueba/rechaza). Con 1 solo co-moderador, apenas vota, el tópico se cierra SOLO (confirmar que aparece en "Bids esperando veredicto del moderador" en el host sin que haga falta tocar nada) — si por algo no se cierra solo, probar el botón "Cerrar tópico de bids ahora". El host da veredicto (Aprobar/Rechazar) → confirmar que se publica el argumento resultante y el puntaje de quien votó coincidente con la decisión.
8. **Host**: "Cerrar fase actual" → confirmar (sin errores en consola) que se dispara la llamada a Groq de sugerencias y que aparecen `link.suggested` solo para los 2 dueños involucrados (si hay al menos 2 argumentos).
9. Un participante: aceptar o rechazar una sugerencia visible.
10. Conexión libre: un participante conecta un argumento propio ya publicado (sin salida) con el de otro, elige tipo de relación → confirmar arista nueva en el grafo.
11. Avanzar fases (el Programa tiene Ronda 1 → Ronda 2 → conexión libre → cierre y ranking) hasta llegar a `cierre_y_ranking`. Host: confirmar pantalla de ranking por postura con tiers (con los NOMBRES de los participantes, no IDs), botón "Cerrar debate", luego "Descargar sesión (.json)" → confirmar que el archivo descargado tiene `eventLogCompleto`, `mapaArgumental`, `rankingPorPostura`, `perfilPorEstudiante` (este último con `nombre`/`emoji`, no solo `participantId`).
12. Participantes: confirmar que ven su propio resultado (puntaje + tier) en vez del formulario de argumento.

## 5. Casos borde importantes

- **Deadlock de turnos (regresión del bug #5)**: dejá expirar una oferta de turno sin aceptar ni rechazar (esperá el timeout, `timeoutAceptacion` del Programa — normalmente 20s) cuando quede un solo participante elegible. Confirmar que la ruleta SÍ vuelve a ofrecerle el turno después (no debe quedar trabada para siempre).
- Escribir un argumento malo 2 veces seguidas (agotar `maxIntentosGroqPorArgumento`, normalmente 2) → confirmar que escala automáticamente (`viaCoModerador: true`) y aparece marcado como tal en el panel de co-moderador.
- Refrescar (F5) una pestaña de participante **antes** de que pase mucho tiempo (dentro de ~1 minuto) → debe reconstruir el estado completo sin perder nada. Si pasó mucho tiempo, ver sección 1 (esperado, no reportar).
- Intentar conectar el mismo argumento propio dos veces (ya tiene salida) → no debe permitirlo / no debe aparecer como opción disponible.
- Cargar un `.json` de Programa inválido en el host → mensaje de error, no debe avanzar.
- Responsive: reducir el viewport en la pestaña de participante (entran desde celular vía QR).

## 6. Formato de reporte de fallos

Tabla en markdown, más grave primero:

| # | Pantalla | Pasos para reproducir | Esperado | Obtenido | Severidad (alta/media/baja) |
|---|----------|------------------------|----------|----------|------------------------------|
| 1 | ... | ... | ... | ... | ... |

- Si algo falla por historial de Ably expirado tras varios minutos de por medio, no lo pongas en la tabla — anotalo aparte como "esperado por retención de Ably".
- Si alguno de los 12 bugs de la sección 3 reaparece, marcalo como "REGRESIÓN" y ponelo primero en la tabla, severidad alta.
- Si no hay fallos reales, decilo explícitamente: "Sin fallos detectados en el alcance actual". No inventes hallazgos.

## 7. Cierre

Sección "Resumen" de máximo 4 líneas: cuántos fallos por severidad, si hubo regresiones de la sección 3, y si el ciclo completo (turno → argumento → validación → puntaje → bid → cierre → ranking → export) se completó de punta a punta o dónde se cortó.
