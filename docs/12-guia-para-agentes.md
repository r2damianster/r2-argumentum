# Guía para agentes y colaboradores (Antigravity, Claude Code, Copilot, personas)

Este proyecto se usa **en un aula real, con estudiantes en el celular, durante un debate en vivo**. Un botón que no se ve, una pantalla que se desborda o un despliegue roto no son detalles: son un debate arruinado. Esta guía existe porque los errores de abajo **ya ocurrieron**; cada uno tiene una prueba automática que lo vigila (`src/guardias/guardias.test.js`) y, cuando aplica, un script de navegador (`scripts/prueba-e2e/`).

> **Regla 0.** Si una prueba o guardia falla, arregla el código. **No borres la prueba, no le agregues excepciones para que pase, no uses `--no-verify`.**

## 1. Antes de escribir una línea

1. Lee `CLAUDE.md` (decisiones de arquitectura ya tomadas: **no se reabren sin un motivo nuevo**) y el índice de `README.md`.
2. Busca en `docs/06-pendientes.md` si lo que vas a hacer ya se cerró, se descartó o está pendiente de una decisión del docente.
3. Si lo que te piden contradice una decisión de `CLAUDE.md`, **pregunta antes**; no lo implementes «por si acaso».
4. Un cambio tuyo debe poder **alcanzarse desde la interfaz real** y **verse en un celular de 320 px de ancho**. Si no, no está terminado.

## 2. Las reglas (cada una nació de un error real)

### Regla 1 — Las acciones del turno tienen que verse SIEMPRE
Durante el debate el estudiante puede estar mirando el mapa, leyendo o haciendo scroll. Los botones **«Aceptar y defender mi argumento» / «Rechazar»** (oferta de turno), **«Ya lo expuse»** (exposición) y **«Terminé de hablar»** (turno hablado) son los momentos en que el debate depende de esa persona. Por eso:

- Van dentro de una **`<div className="barra-de-accion-fija">`**: barra pegada al borde inferior de la pantalla (`position: fixed`), visible aunque la persona haya hecho scroll a cualquier punto de la página.
- El botón principal es **`boton-accion-principal`** (verde sólido, ≥ 56 px de alto, ancho completo, borde oscuro, anillo que pulsa; sin animación con «reducir movimiento»). El rechazo es **`boton-accion-rechazo`** (rojo, borde grueso, fondo blanco). Contraste medido: 5,0:1 y 6,5:1.
- El componente usa **`useAtencionDelTurno`** (`src/player/useAtencionDelTurno.js`): centra la tarjeta, hace vibrar el celular y cambia el título de la pestaña mientras la acción esté pendiente.
- La cuenta atrás pasa a rojo (`cuenta-regresiva--urgente`) en los últimos 5 s.
- **Nunca** pongas estas acciones sin clase (queda el gris del navegador) ni con `boton-cambiar-programa` (el estilo más discreto). Si agregas una acción nueva de este tipo, usa las mismas clases y agrégala a la guardia «acciones del turno».
- Los botones que califican (co-moderadores) y los de votar bids usan los colores semánticos (`boton-exito`, `boton-secundario`, `boton-peligro`).

**Por qué:** se probó con capturas: «Aceptar» y «Ya lo expuse» salían como botones grises sin clase y «Rechazar» como un contorno gris pequeño; un estudiante podía no verlos y el turno vencía (y con 4 vencimientos seguidos se pausa la ruleta).

### Regla 2 — Móvil primero: 320 px
- Ningún elemento puede ensanchar el documento más que la pantalla (sin scroll horizontal). Los grupos de botones usan `flex-wrap: wrap`.
- Todo control táctil mide **al menos 44 px** de alto (botones, selects, campos, `✕`).
- Texto de contenido ≥ 13 px; etiquetas en mayúscula ≥ 12 px.
- Comprueba con `python scripts/prueba-e2e/moviles.py` (8 modelos, de 320 px a iPad) **y**, si puedes, en un celular real. La emulación no reproduce el teclado, el notch ni el rendimiento.
- Un elemento `position: fixed` (barra de acción, capa instruccional) no puede ocupar más del ~35 % del alto en 320×568.
- **Comprobar «visible» no basta:** si algo se lleva a la pantalla (`scrollIntoView`) o hay capas `sticky`/`fixed`, verifica con `document.elementFromPoint` que el control **recibe el toque** (ver `moviles.py`).

### Regla 3 — Nunca subas código que no compila ni pasa las pruebas
- `npm run verificar` (pruebas + build) **antes de cada push**. Actívate el hook con `npm run instalar-hooks`: `git push` se cancela si falla.
- GitHub Actions repite la verificación en cada push y PR; **Vercel despliega a producción en cada push a `main`**, así que un push roto rompe el sitio en vivo.
- Cambios grandes (más de ~10 archivos): rama aparte y Preview de Vercel; a `main` solo con el build verde.
- **Nunca** `--no-verify`, `--force` en `main` ni `git reset --hard` sin instrucción explícita del docente.

### Regla 4 — Revisa tu propio diff buscando restos de fusión
Antigravity dejó, mezcladas, líneas viejas y nuevas: imports duplicados, `<h3>` repetidos, JSX sin cerrar, `color: var(--x)` sin comillas, botones idénticos seguidos, claves repetidas en objetos. Antes de commitear: `git diff` completo, sin saltarte archivos, y `npm test` (las guardias buscan marcadores de conflicto, botones y líneas repetidas).

### Regla 5 — La documentación describe el código que existe
- No cites funciones, eventos, archivos ni umbrales sin comprobarlos (`grep`). Se documentaron `priorizarPosturasSinExponer`, `oyente.contraargumento_enviado` y un semáforo «al 50 % / 20 %» que **no existían** (lo real era `elegirCandidatoParaTurno`, tres eventos ya existentes y 60 s / 30 s).
- Un cambio de comportamiento actualiza **en el mismo commit**: `docs/04` (reglas de turno), `docs/09` (eventos), `docs/06` (registro de lo cerrado/pendiente), y `docs/10` si cambia lo que se prueba a mano.
- Cuando quites una función, quítala también de la documentación viva (el historial va en `docs/06` y `docs/11`).

### Regla 6 — Los secretos no van en el repositorio (es público)
- Ninguna clave, token ni contraseña en código, docs, scripts ni capturas. Viven en variables de entorno de Vercel (`ABLY_API_KEY`, `GROQ_API_KEY`, `HOST_USER`, `HOST_PASSWORD`).
- La clave del host estuvo en `src/host/App.jsx` **y** en `docs/10`, en un repositorio público. Hoy el login se verifica en el servidor (`api/host-login.js`).
- Si tu cambio necesita una variable de entorno nueva, **créala en Vercel antes de commitear**: el auto-push despliega enseguida y sin ella el sitio responde 503.

### Regla 7 — Nada de funciones inalcanzables
La «apertura simultánea» (temporizador con semáforo y selector de tiempo) se construyó, se documentó y se dio por cerrada, pero **ningún Programa la usaba y quien no confirmaba el ingreso era oyente al instante**: nadie podía verla. Se retiró. Antes de dar por terminada una función: recórrela en un navegador con un Programa de ejemplo real, como host y como participante.

### Regla 8 — Convenciones de texto y código
- Español latinoamericano neutro; **nada de voseo** (`Escribe`, no `Escribí`; `aquí`, no `acá`). Aplica a interfaz, comentarios y docs.
- Sin i18n ni textos en inglés (no hay `t('clave')` en este proyecto).
- Nombres descriptivos completos (`studentArgument`, no `arg`).
- Sin reconocimiento de voz (Web Speech API): descartado para la v1.

### Regla 9 — Las decisiones de arquitectura no se reabren
Sin base de datos para el estado en vivo (Ably). La proyección usa `BroadcastChannel`, no otro cliente de Ably. Groq **nunca** es juez: solo valida la forma al escribir y sugiere conexiones en lote cuando el moderador lo pide. Un solo esquema de puntaje. Detalle y motivos en `CLAUDE.md`.

### Regla 9b — Créditos y podio final
- Los créditos (nombre, ORCID, herramientas de IA, foto) salen **solo** de `src/shared/creditos.js` y del componente `Creditos`; no copies el ORCID ni el nombre a mano. Se muestran **solo al ingresar y en el podio final**, nunca durante el debate.
- La foto es `public/autor.webp` (10 KB). No cargues `public/avatar.png` (3,2 MB) en pantallas de estudiantes.
- El podio final del participante solo aparece con `estado.sesion.cerrada`, es saltable y respeta «reducir movimiento». El guion vive en `src/player/podio/etapasDelPodio.js` (con pruebas); no metas temporizadores sueltos en el componente.

### Regla 10 — Commits solo cuando te lo piden
El hook global `auto-commit` de Claude Code ignora este repositorio (existe `.no-auto-commit`). No commitees ni empujes por iniciativa propia; cuando te lo pidan, mensajes claros y con el pie de coautoría.

## 3. Errores ya cometidos — catálogo

| Fecha | Qué pasó | Causa | Cómo se detectó | Qué lo impide hoy |
|---|---|---|---|---|
| 23-sep | 2 despliegues de producción en `ERROR` (~4 h con el sitio roto) | Commit de 25 archivos con restos de fusión (imports, JSX, declaraciones duplicadas) sin `npm run build` | Vercel + auditoría | Regla 3 y 4; hook pre-push; GitHub Action; guardias de fusión |
| 23-sep | Botones de envío **duplicados** en `PanelDeBid` y `PanelDeConexionLibre` | Restos de fusión: la línea vieja y la nueva quedaron juntas | Lectura de código durante el e2e | Guardia «dos botones seguidos con el mismo texto» |
| 23-sep | `turnId` **repetido** dos líneas seguidas en `IntervencionVerbal` | Igual | Auditoría | Guardia «líneas idénticas consecutivas» |
| 23-sep | Comentarios técnicos borrados al «limpiar» (`esArgumentoDeIngreso`) | Limpieza sin entender por qué existían | Diff de `a606b95` | Regla 5: no borres comentarios de «por qué» |
| 20–23-sep | La documentación citaba código inexistente | Se documentó de memoria | Comparación docs ↔ código | Regla 5; guardia de identificadores inexistentes |
| 20-sep | Umbrales del semáforo mal documentados (50 %/20 % vs 60 s/30 s) | Ídem | Prueba en navegador | Regla 5 |
| 14–24-sep | **Clave del host en el repo público** (código y `docs/10`) | «Credencial hardcodeada» aceptada como criterio de otro proyecto | Auditoría | Regla 6; login en servidor; guardia de credenciales |
| 17–24-sep | **Apertura simultánea inalcanzable** (selector sin efecto, contador «2 de 2» con 3 conectados) | Función construida sin recorrerla con un Programa real | Prueba en navegador | Regla 7; guardia de funciones retiradas |
| 24-sep | Botones «Aceptar / Rechazar / Ya lo expuse» **sin énfasis** (grises) | Sin clase o con la clase más discreta | Revisión visual del docente | Regla 1; guardia «acciones del turno» |
| 24-sep | Panel de co-moderador **desbordado** a 320–360 px (381 px en 360) | 4 botones en una fila sin `flex-wrap` | `moviles.py` | Regla 2; guardia de `flex-wrap` |
| 24-sep | «Volver a configuración» abría una sala con **otro código** sin avisar | Diseño sin advertencia | `volver_config.py` | Confirmación en la interfaz |
| 24-sep | Reparto de posturas 1/3/4 con 8 personas en asignación aleatoria | Cada cliente calculaba con conteos viejos | e2e | Cupo por postura al confirmar (`verificarCupoDePostura`) |
| 24-sep | `/api/host-login` respondió 503 tras un push | El auto-push desplegó antes de crear las variables de entorno | Producción | Regla 6 |
| 25-sep | Podio final: al llevarlo a la pantalla, la **capa instruccional fija** tapaba su primera línea y el botón «Saltar la animación» no recibía el toque | `scrollIntoView` sin contar con elementos `sticky`/`fixed`; la comprobación «está en pantalla» (`y ≥ 0`) no detectaba el solapamiento | `moviles.py` (Playwright: «intercepts pointer events») | Con el debate cerrado la capa va sin fijar; las pruebas verifican con `elementFromPoint` que el botón recibe el toque |
| 24-sep | Falso «zoom 30 %» en un navegador automatizado (tapaba botones) | `viewport` fijo en una ventana con otro tamaño | Capturas del e2e | El script usa `no_viewport` |

## 4. Cómo probar

| Qué | Comando | Cubre |
|---|---|---|
| Lógica pura + guardias | `npm test` | reducer, motor, puntaje, reglas de ingreso, API, guardias |
| Pruebas + build | `npm run verificar` | lo anterior + `vite build` |
| Hook local | `npm run instalar-hooks` (una vez) | cancela el push si falla |
| Flujo central en navegador | `python scripts/prueba-e2e/e2e_flujo.py` | ingreso, turnos, co-moderadores, bids, conexión libre, F5 del host, cierre, ranking |
| Oyentes, cortacircuitos, podio | `python scripts/prueba-e2e/e2e.py` | |
| Reparto de posturas | `bandos.py`, `confirmaciones_simultaneas.py` | |
| Volver a configuración | `volver_config.py` | |
| Móviles | `python scripts/prueba-e2e/moviles.py` | 8 modelos, táctil, teclado, horizontal |

Los scripts manejan **producción** (Ably y Groq solo existen en Vercel) y consumen unas pocas llamadas reales. El login del host lo escribe el docente (o `login_host.py` con la clave que él entregue); ver `scripts/prueba-e2e/README.md`.

## 5. Proceso de un cambio

1. Lee lo relevante (sección 1) y confirma que no contradice una decisión.
2. Cambia el código **y** su documentación en el mismo commit.
3. `git diff` completo → busca restos de fusión → `npm run verificar`.
4. Si toca la interfaz: mírala en 320 px (`moviles.py` o el modo dispositivo de Chrome) y, si toca turnos, con `e2e_flujo.py`.
5. Si necesitas variables de entorno nuevas: créalas en Vercel primero.
6. Commit con mensaje descriptivo (qué y por qué); push solo si te lo piden; después revisa el Action y el despliegue.

## 6. Mapa rápido del código

| Dónde | Qué vive ahí |
|---|---|
| `src/host/motorDeSesion.js` | Autoridad del debate: turnos, puntaje, fases (solo corre en la consola del host) |
| `src/shared/estado/reducirEventos.js` | Estado derivado del log de eventos (event sourcing) |
| `src/shared/eventos/nombresDeEventos.js` | Catálogo de eventos (documentado en `docs/09`) |
| `src/shared/ingreso/reglasDeIngreso.js` | Oyentes vs participantes, reparto de posturas, cupo |
| `src/player/` | Pantallas del participante (celular) |
| `src/host/` | Consola del moderador |
| `src/shared/estilos/base.css`, `sesion.css` | Estilos; los botones de acción del turno están en `base.css` |
| `api/` | Funciones de Vercel: token de Ably, login del host, Groq |
| `scripts/prueba-e2e/` | Pruebas en navegador contra producción |
| `src/guardias/guardias.test.js` | Guardias de este documento |

## 7. Si una guardia falla

Lee su mensaje: dice qué archivo y qué línea. Corrige el código. Si de verdad la regla ya no aplica (por una decisión nueva del docente), actualiza **esta guía, `CLAUDE.md` y la guardia juntos** en el mismo commit y explica el motivo; nunca solo la guardia.
