# Instrucciones del proyecto — Argumentum (Debate)

Contexto para cualquier sesión de Claude Code que trabaje en este repositorio. Este archivo cubre solo decisiones técnicas/convenciones de código. El diseño pedagógico completo está en `README.md` y `docs/`.

## Qué es esto

Plataforma de debate argumental en tiempo real para uso en aula (ULEAM). No es un simple debate lineal: registra relaciones entre argumentos (apoyo, contraargumento, dilema, conexión, reformulación, concesión) como un grafo que evoluciona en vivo.

## Decisiones de arquitectura ya tomadas — no reabrir sin motivo nuevo

- **Sin base de datos para el estado en vivo.** Ably es el "sistema nervioso" del debate (pub/sub + presence), nunca un registro académico permanente. Cada sesión se exporta a JSON/PDF al cierre.
- **La proyección en otra ventana no abre otra conexión a Ably ni otro motor**: la consola del host (única que corre `motorDeSesion.js`) le pasa su estado por `BroadcastChannel`. No reintroducir un segundo cliente completo: dos motores publicarían decisiones duplicadas.
- **Los "Programas de Debate"** (plantillas: tema, posturas, reglas de puntaje, ejemplos para Groq) se guardan como archivos JSON reutilizables — sin backend en v1.
- **Groq nunca es juez autoritativo.** Dos checkpoints controlados únicamente:
  1. Validación de forma al escribir un argumento (¿tiene claim + razón? criterio estructural — "porque/ya que/evidencia" —, nunca un juicio filosófico de "qué es un buen argumento").
  2. Sugerencia de conexiones en lote, disparada manualmente por el moderador al cerrar una fase — nunca por cada clic individual de conexión.
- **Filtros locales previos a Groq (no cuentan como un tercer checkpoint)**: `api/_revisarFormaMinima.js` (texto muy corto o conector «porque»/«ya que»… sin razón detrás) y `src/shared/argumentos/buscarArgumentoParecido.js` (argumento casi igual a otro ya publicado). Son deterministas, no juzgan el contenido y ahorran llamadas a Groq. Ninguna corrección ortográfica ni de redacción es automática: si algún día se agrega ayuda con IA, solo **sugiere** y la persona decide (ver `docs/06-pendientes.md`).
- **Todo el puntaje sigue una fórmula única** (ver `docs/05-reglas-de-puntaje.md`). Si se ajusta un valor, se ajusta la fórmula — no se parchean casos sueltos con números mágicos.
- **Reconocimiento de voz en vivo (Web Speech API) descartado para v1** — depende de Chrome/Edge y de red estable; riesgo de fallo alto en aula real. No reintroducir sin decisión explícita del usuario.
- **Idioma: todo en español latinoamericano neutro.** Este proyecto no tiene i18n dual ES/EN previsto (a diferencia de otros proyectos educativos del usuario como DataViz Lab). No añadir textos en inglés ni una capa `t('clave')`/`translations.js` sin confirmar antes con el usuario.
- **Nada de voseo rioplatense.** El público es ecuatoriano (ULEAM). Usar formas de "tú", no de "vos": `Escribe` (no `Escribí`), `Elige` (no `Elegí`), `puedes` (no `podés`), `tienes` (no `tenés`), `aquí` (no `acá`), `Pídele` (no `Pedile`), `Acepta`/`Rechaza` (no `Aceptá`/`Rechazá`). Aplica a todo el texto visible por el estudiante o el docente, a los `instruccionesParaEstudiantes` de los Programas de ejemplo, a los comentarios del código y a la documentación.

## Convenciones de código

- Nombres descriptivos completos, nunca abreviaciones crípticas (`scenario` no `s`, `isVisible` no `flag`, `studentArgument` no `arg`).
- Si en algún momento se requiere texto visible en más de un idioma, usar `t('clave')` + `translations.js` (estándar heredado de otros proyectos educativos del usuario) — pero no asumir que aplica aquí sin confirmarlo primero.

## Control de costos (APIs gratuitas al inicio: Ably + Groq)

- Groq: nunca se llama en eventos de conexión libre (`link.created`). Solo en intentos de envío de argumento (máx. 2 por argumento, luego escala a co-moderador) y en el disparo manual de sugerencia de conexiones por ronda.
- Ably: los mensajes de conexión son livianos y están acotados por la regla "máx. 1 conexión saliente por argumento propio" — no requieren control adicional de cuota.
- Ronda 1/Ronda 2 con cupos decrecientes también acota naturalmente el número de intentos de validación Groq por estudiante por sesión.

## Estado actual y próximos pasos

El modelo de eventos y el motor ya están construidos y desplegados (`docs/09-modelo-de-eventos.md`, `src/host/motorDeSesion.js`). Ya no aplica la regla de "no escribir componentes hasta cerrar el modelo de eventos". Lo que sigue y las decisiones abiertas están en `docs/06-pendientes.md`; el procedimiento de prueba manual en producción, con el elenco de actores, en `docs/10-guia-prueba-manual-chrome.md`. Tests de la lógica pura: `npm test`.
