# Pendientes y próximos pasos

Decisiones abiertas o trabajo técnico que todavía no se ha hecho, y registro de lo que ya se cerró.

## Cerrado

- ~~Modelo de eventos completo~~ — ver `09-modelo-de-eventos.md`. Implementado tal cual, con un agregado no documentado originalmente: evento `programa.publicado` (el host lo emite al abrir la sala para que el participante, que solo conoce el código de 4 dígitos, reciba el Programa completo sin necesitar backend). Canal real usado: `debate:sala:{codigoDeSala}` (no `debate:{programId}:{sessionId}` como decía el doc original — el player no tiene forma de conocer el `programId` sin backend).
- ~~Estructura de archivos del código~~ — scaffold + motor real completos: `host.html`/`player.html` (Vite multi-page), `src/host` (consola, `motorDeSesion.js` = autoridad única de turnos/fases/puntaje/bids), `src/player` (formulario de argumento, grafo, paneles de bid/co-moderador/conexión), `src/shared/estado` (reducer + hook de event-sourcing), `api/` (`ably-token.js`, `groq-validar-argumento.js`, `groq-sugerir-conexiones.js`).
- ~~Variables de entorno en Vercel~~ — `ABLY_API_KEY` y `GROQ_API_KEY` son variables **Sensitive** en Production (no recuperables vía CLI, solo corren en la infraestructura de Vercel — probar cambios contra producción, no local).
- ~~Key Root de Ably~~ — revocada, key restringida a `debate:*` en uso.
- ~~Herramienta de visualización del grafo argumental~~ — **React Flow** (`@xyflow/react`), no Cytoscape. Un nodo por argumento coloreado por tipo semántico, columnas por postura, aristas por conexión.
- ~~Motor de debate real~~ (turnos, escritura de argumentos + validación Groq, co-moderación, bids, puntaje en vivo, ranking, export JSON) — construido y probado contra producción en dos sesiones de prueba en vivo; ver `10-guia-prueba-manual-chrome.md` para el detalle de qué se verificó y los 10 bugs encontrados/corregidos. De la segunda ronda: los bids ahora **sí se resuelven** (cierre automático de tópico cuando todos los co-moderadores votaron, + botón manual del host), el grafo ya no superpone nodos, y el grafo/ranking/export muestran el nombre del participante en vez de su ID interno.
- ~~Selector de posturas por sesión~~ — un Programa puede definir más de 2-3 posturas "candidatas" (ej. el nuevo ejemplo de Filosofía con 12: homo faber, homo ludens, animal symbolicum...) y el moderador elige, al "Iniciar sesión", cuáles se debaten esa vez (checklist, todas tildadas por defecto, mínimo 2). El Programa se republica al canal con solo esas posturas — grafo, ranking y export siguen la fuente de verdad del canal, no el JSON original.

**Nota para el futuro — modelos de Groq:** el catálogo cambia. Modelos vigentes: `openai/gpt-oss-20b` (validación, checkpoint 1, `max_tokens: 600`) y `openai/gpt-oss-120b` (sugerencia de conexiones, checkpoint 2, `max_tokens: 1500`) — ambos gastan tokens en razonamiento interno antes de emitir el JSON incluso en `json_mode`; un `max_tokens` bajo produce `json_validate_failed` casi siempre (bug real encontrado y corregido en sept. 2026). Si un endpoint falla con `model_decommissioned`, consultar `GET https://api.groq.com/openai/v1/models`. El prompt de validación (checkpoint 1) también se corrigió porque rechazaba argumentos con razón causal válida si no usaban literalmente "porque"/"ya que" — ahora evalúa estructura causal en general.

## Decisiones abiertas (no bloquean el uso actual, pero hay que resolverlas pronto)

- **Puntaje de conexiones no implementado.** El esquema del Programa define `puntajeConexion` (aceptar sugerencia / conectar manual / corregir tras rechazo) pero el motor (`motorDeSesion.js`) todavía no publica ningún `score.updated` cuando se crea un `link.created` o se resuelve una sugerencia — hoy solo puntúan argumentos y bids. Hace falta decidir los valores y agregar esa reacción al motor.
- Nombre definitivo del proyecto (provisional: "Argumentum" / marca "R2 Argumentum").
- Tope máximo de co-moderadores para grupos grandes (la fórmula `ceil(n × 0.10)` no tiene techo definido; el Programa ya soporta `topeMaximoCoModeradores` pero no hay UI para configurarlo desde el host, solo desde el JSON).
- Formato exacto del export PDF ("mapa de evolución argumentativa") — hoy solo hay export JSON.
- Bonos de co-moderador no automatizables con el modelo de eventos actual: `FEEDBACK_USADO_PARA_REFORMULAR` y `CONSISTENCIA_EN_REVISION_CRUZADA` (existen como constantes en `formulaDePuntaje.js` pero el motor nunca los dispara — requieren señales que hoy no se capturan).
- Sin UI en el host para configurar `timeoutAceptacion`, `tiempoLimiteEvaluacionBid`, etc. por sesión — se usan siempre los valores del Programa cargado.

## Mecánicas de fases futuras (explícitamente fuera de v1)

- **Bid de tipo "agregar argumento nuevo"** (no solo desmontar/fortalecer) — posible v2.
- Reconocimiento de voz en vivo (Web Speech API).
- Modo torneo, "argumento fantasma", "defiende lo contrario", modo cooperativo sin equipos.
- "Revisión cruzada aleatoria" de co-moderadores (auditoría automática de consistencia).
- Backend/base de datos para histórico institucional entre sesiones, más allá del JSON del Programa y el export de sesión.
