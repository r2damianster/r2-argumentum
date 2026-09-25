# Auditoría de la ronda de trabajo con Antigravity (20–23 de septiembre de 2026)

Auditoría hecha el 24 de septiembre de 2026 sobre GitHub (`r2damianster/r2-argumentum`, rama `main`), Vercel (proyecto `r2-argumentum`) y el código local. Se contrastó lo hecho contra las decisiones de `CLAUDE.md`, `docs/` y el estado real del código.

## 1. Cronología

| Fecha | Commit | Qué hizo | Deploy en Vercel |
|---|---|---|---|
| 20-sep | `3748e4d` | Cortacircuitos de la ruleta de turnos + pausa/reanudación manual | READY |
| 20-sep | `e9e099e` | Flujo del moderador en 3 etapas + guía pedagógica en la pantalla QR | READY |
| 23-sep | `1b031ae` | Accesibilidad, semáforo de apertura, cobertura de posturas, doble podio, módulo de oyentes (25 archivos) | **ERROR** |
| 23-sep | `3c01433` | Tiempo de apertura en la tarjeta resumen del host | **ERROR** |
| 23-sep | `a606b95` | Corrige fragmentos JSX y declaraciones duplicadas | READY (producción vigente) |

Desde el 14 de septiembre hay 80 commits, todos de un solo autor de git (`Arturo`); 23 son `chore: auto-commit` del hook global `Stop`.

## 2. Diagnóstico

### 2.1 Producción rota durante ~4 horas (resuelto)
`1b031ae` dejó el código con **restos de fusión**: líneas viejas y nuevas mezcladas (imports duplicados, `<h3>` duplicados, JSX sin cerrar, `color: var(--…)` sin comillas, fragmentos `<>` ausentes). Los dos deploys siguientes fallaron en el build. `a606b95` limpió el desastre. Estado hoy: `npm test` → **221/221 pruebas verdes**, `vite build` correcto, deploy `dpl_7s4t7yBM…` READY.

**Causa de fondo:** el push a `main` despliega directo a producción sin `npm test` ni `vite build` previos. Un commit de 25 archivos llegó sin ninguna verificación.

### 2.2 Errores de runtime
Solo un grupo en 7 días: `DEP0169 url.parse()` en `/api/ably-token` (46 veces). Es una advertencia del SDK de Ably/Node, no un fallo de la aplicación. Sin errores 5xx.

### 2.3 Coherencia con las decisiones de arquitectura
| Decisión | Resultado |
|---|---|
| Sin base de datos para el estado en vivo | Cumple |
| Proyección por `BroadcastChannel`, sin segundo motor | Cumple |
| Groq solo en validación de forma y sugerencia en lote | Cumple: 5 llamadas a `groq-validar-argumento` y 1 a `groq-sugerir-conexiones`, ninguna en `link.created` |
| Sin reconocimiento de voz | Cumple (no hay `SpeechRecognition`) |
| Sin i18n / sin textos en inglés | Cumple |
| Sin voseo | **Incumplía en 5 comentarios (`acá`)** → corregido |
| Puntaje con fórmula única | Sin hallazgos nuevos |

### 2.4 Documentación que no coincidía con el código (corregido)
- `docs/04` y `docs/06` citaban una función `priorizarPosturasSinExponer` que **no existe**: la lógica está dentro de `elegirCandidatoParaTurno` (`src/host/motorDeSesion.js:58`).
- Ambos citaban un evento `oyente.contraargumento_enviado` que **no existe**: el formulario de oyentes publica `argument.submitted` + `link.created` + `ingreso.confirmado`.
- `docs/06` decía que el tiempo de apertura se elige en `ControlDeFases.jsx`; se elige en `PantallaDeConfiguracionInicial.jsx`.
- `a606b95` borró de `IngresoConArgumento.jsx` los comentarios que explicaban por qué existe `esArgumentoDeIngreso` → restaurados (y corregido el typo «offeredía»).

## 3. Hallazgos (decididos y aplicados el 24-sep; ver §4)

1. **Oyente que contraargumenta hereda la postura del argumento que rebate** (`FormularioDeContraargumentoParaOyentes.jsx`, `stanceId = argumentoObjetivo.stanceId`). Un contraargumento suele ser de la postura contraria, así que el ranking por postura lo suma al bando equivocado. Además publica `ingreso.confirmado`, con lo que el oyente pasa a participante en plena sesión, y `docs/09` (línea 82) todavía dice que un oyente solo puede convertirse en participante *antes* de iniciar la sesión. Decidir: ¿el oyente elige postura? ¿sigue siendo oyente y solo puntúa el contraargumento?
2. **El formulario de oyentes publica `aprobado: true` fijo** y usa la última respuesta de Groq sin comprobar que sea del texto actual. Riesgo bajo, pero conviene atarlo al texto revisado.
3. **`/api/ably-token` emite tokens con la capacidad completa de la clave** y acepta cualquier `clientId` sin validar. Recomendado: limitar la capacidad a los canales `sala:*` y validar la longitud/formato del `clientId`. No se tocó porque requiere conocer el patrón exacto de canales y probar contra Ably real.
4. **Bundle `sesion` de 635 kB** (196 kB gzip; aviso de Vite). Aceptable en aula con buena red; mejora posible con `manualChunks` (React Flow/dagre por separado).
5. **Hook `auto-commit` global + auto-push**: cada fin de turno crea un commit y despliega. Contradice la regla «no commitear sin instrucción» de tu `CLAUDE.md` global y fue lo que permitió desplegar código sin verificar. Sugerencia: excluir este repo del hook o agregar un paso `npm test && vite build` antes del push.
6. ~~Sin verificar en navegador~~ → verificado el 24-sep-2026 (ver §4B).

## 4. Mejoras aplicadas en esta auditoría
- 5 comentarios con voseo → tuteo (`motorDeSesion.test.js`, `IngresoConArgumento.jsx`, `groq-sugerir-conexiones.js`, `groq-validar-argumento.js` ×2).
- Comentarios técnicos restaurados en `IngresoConArgumento.jsx`.
- Referencias erróneas corregidas en `docs/04` y `docs/06`.
- Este informe (`docs/11`).

### Aplicado tras las decisiones del docente
- **Oyente con contraargumento** (§3.1 y §3.2): el formulario ahora pide elegir postura, ya no hereda la del objetivo, y solo permite publicar el texto exactamente igual al que Groq aprobó. `docs/04` y `docs/09` actualizados.
- **`/api/ably-token`** (§3.3): valida `clientId` (`^[A-Za-z0-9_-]{1,64}$`, `api/_clienteIdValido.js` con pruebas) y responde 400 si no cumple. No se limitaron capacidades de canal (pendiente, requiere probar contra Ably real).
- **Bundle** (§3.4): `manualChunks` separa `mapa-de-argumentos` (React Flow + dagre, 375 kB), `ably` (212 kB) y el resto (`sesion`, 47 kB): se cachean por separado.
- **Hook `auto-commit`** (§3.5): ignora los repos con un archivo `.no-auto-commit` en la raíz; este repo lo tiene. Desde ahora, commit y push solo por instrucción explícita.
- `npm run verificar`: 224/224 pruebas y build correcto.

## 4B. Verificación en navegador (24-sep-2026)

Playwright contra producción, 1 host + 4 participantes (`scripts/prueba-e2e/`). Detalle en `docs/10` §6B. Resumen:
- ✅ Cortacircuitos, alerta y «Reanudar ruleta».
- ✅ Doble podio (ranking en vivo e informe, con orden diferenciado).
- ✅ Formulario de oyentes con el cambio nuevo (postura elegida, texto atado a la revisión).
- ✅ Semáforo del host (verde → amarillo a 01:00 → rojo a 00:30 → agotado) — funcionaba, pero se retiró por inalcanzable en el flujo real.
- ⚠️ **Hallazgos nuevos** (resueltos en §4C): (1) ningún Programa de ejemplo tiene fase de apertura; (2) con el ingreso obligatorio, quien no confirma antes de iniciar es oyente al instante y nunca ve su semáforo; (3) el contador «X de Y» solo contaba confirmados; (4) «3 de 4 en la misma postura», que resultó ser un error del script.
- 🔴 **Hallazgo crítico de seguridad:** el repositorio es público y la clave del host estaba en el código del cliente y en texto plano en `docs/10`. Resuelto en §4C (verificación en servidor); la clave vieja sigue en el historial de git y hay que darla por comprometida.

## 4C. Resolución de los hallazgos (24-sep-2026)

Decisiones del docente y lo hecho:

| Hallazgo | Decisión | Resultado |
|---|---|---|
| Clave del host en repo público | Verificar en servidor | `api/host-login.js` + token HMAC de 7 días; la identidad `host` de Ably exige ese token; clave retirada del código y de `docs/10`. **Pendiente del docente: crear `HOST_USER`/`HOST_PASSWORD` en Vercel con una clave nueva.** |
| Apertura simultánea inalcanzable | Retirarla | Eliminadas fase, eventos, estado, selector y semáforo; Programas antiguos con la fase se cargan igual. |
| Contador «X de Y» engañoso | (solo aplicaba a la apertura) | Desaparece con ella. |
| Reparto de posturas | Repetir la prueba | 3 salas × 6 en paralelo: 2/2/2. El caso «3 de 4» era un error del script de prueba. |
| Tokens de Ably sin restringir | Limitar y probar | Capacidad `debate:*` y `clientId` validado, con pruebas. |

Pruebas automáticas: 230/230 (eran 224). Verificado en producción tras el despliegue (`4ff122c` + redespliegue con las variables nuevas): login 200 / clave mala 401 / clave vieja 401, token de host con y sin sesión (200/401), capacidad `debate:*` en tokens de participante, y e2e en navegador 17 PASS / 0 FAIL.

**Nota de proceso:** el hook `auto-push` empujó el commit apenas se creó, antes de que existieran las variables; hubo que redesplegar (`vercel redeploy`) para que `/api/host-login` dejara de responder 503. Con cambios que dependen de variables de entorno nuevas, créalas **antes** de commitear.

## 4D. Ampliación de la verificación (24-sep-2026, tarde)

Decisiones del docente: ampliar el e2e a turnos/co-moderadores/bids/conexión libre/sugerencias/F5/móvil, dejar GitHub Action **y** hook pre-push, actualizar `ably`, probar «Volver a configuración» y cubrir `sesionDelHost`; **no** tocar el historial de git.

- **Flujo central: 24 PASS / 0 FAIL** en producción (detalle en `docs/10` §6B).
- **Hallazgo 1 — botones de envío duplicados** en `PanelDeBid` y `PanelDeConexionLibre` (restos de la fusión de Antigravity, invisibles en las pruebas de lógica). Corregido; una búsqueda automática de botones idénticos consecutivos en todo `src/**/*.jsx` no encontró más.
- **Hallazgo 2 — «Volver a configuración» dejaba varados a los participantes** (abre sala con código nuevo, sin aviso). Corregido con una confirmación.
- **Hallazgo 3 — reparto de posturas sensible a confirmaciones casi simultáneas** (1/3/4 con 8 en una corrida sin esperas). **Corregido** con un cupo por postura al confirmar, solo en asignación aleatoria (decisión del docente: en «libre» y «postura propia» no se fuerza nada). Verificado: 3/2/3 con 8 personas confirmando a la vez, dos rondas.
- **Proceso:** GitHub Action verde en los dos commits siguientes; el hook pre-push corrió tests+build al hacer push. `ably` 2.28.0 → 2.29.0. `npm audit --omit=dev`: 0 vulnerabilidades.
- **Historial de git:** se deja como está (la clave vieja ya no sirve).

## 4E. Vulnerabilidades de dependencias y móviles (24-sep-2026, noche)

- **`npm audit`: de 5 a 0.** Todas venían de herramientas de desarrollo (vite 5, esbuild, vitest 2 y su UI) y exigían un salto de versión mayor: vite 8.3.1, vitest 5.0.1, plugin-react 6.1.1. Se regeneró el `package-lock.json`; 244 pruebas, build, servidor de desarrollo, GitHub Action y despliegue de Vercel correctos.
- **Móviles emulados (8 modelos):** un fallo real (panel de co-moderador desbordado a 320–360 px) y dos ajustes menores (objetivo táctil de 31 → 44 px; etiquetas de 11,2 → 12 px). Reverificado. **Sigue pendiente una pasada con celulares físicos.**

## 5. Recomendaciones de proceso
1. Antes de cada push a `main`: `npm test && npm run build` (un script `npm run verificar` lo automatiza).
2. Trabajo de agentes externos en ramas y Preview de Vercel; fusionar a `main` solo con build verde.
3. Diffs grandes (más de ~10 archivos) revisarlos con `git diff --check` y buscar líneas duplicadas antes del commit.
