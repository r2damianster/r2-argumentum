# Instrucciones del proyecto — Argumentum (Debate)

Contexto para cualquier sesión de Claude Code que trabaje en este repositorio. Este archivo cubre solo decisiones técnicas/convenciones de código. El diseño pedagógico completo está en `README.md` y `docs/`.

## Qué es esto

Plataforma de debate argumental en tiempo real para uso en aula (ULEAM). No es un simple debate lineal: registra relaciones entre argumentos (apoyo, contraargumento, dilema, conexión, reformulación, concesión) como un grafo que evoluciona en vivo.

## Decisiones de arquitectura ya tomadas — no reabrir sin motivo nuevo

- **Sin base de datos para el estado en vivo.** Ably es el "sistema nervioso" del debate (pub/sub + presence), nunca un registro académico permanente. Cada sesión se exporta a JSON/PDF al cierre.
- **Los "Programas de Debate"** (plantillas: tema, posturas, reglas de puntaje, ejemplos para Groq) se guardan como archivos JSON reutilizables — sin backend en v1.
- **Groq nunca es juez autoritativo.** Dos checkpoints controlados únicamente:
  1. Validación de forma al escribir un argumento (¿tiene claim + razón? criterio estructural — "porque/ya que/evidencia" —, nunca un juicio filosófico de "qué es un buen argumento").
  2. Sugerencia de conexiones en lote, disparada manualmente por el moderador al cerrar una fase — nunca por cada clic individual de conexión.
- **Todo el puntaje sigue una fórmula única** (ver `docs/05-reglas-de-puntaje.md`). Si se ajusta un valor, se ajusta la fórmula — no se parchean casos sueltos con números mágicos.
- **Reconocimiento de voz en vivo (Web Speech API) descartado para v1** — depende de Chrome/Edge y de red estable; riesgo de fallo alto en aula real. No reintroducir sin decisión explícita del usuario.
- **Idioma: todo en español.** Este proyecto no tiene i18n dual ES/EN previsto (a diferencia de otros proyectos educativos del usuario como DataViz Lab). No añadir textos en inglés ni una capa `t('clave')`/`translations.js` sin confirmar antes con el usuario.

## Convenciones de código

- Nombres descriptivos completos, nunca abreviaciones crípticas (`scenario` no `s`, `isVisible` no `flag`, `studentArgument` no `arg`).
- Si en algún momento se requiere texto visible en más de un idioma, usar `t('clave')` + `translations.js` (estándar heredado de otros proyectos educativos del usuario) — pero no asumir que aplica aquí sin confirmarlo primero.

## Control de costos (APIs gratuitas al inicio: Ably + Groq)

- Groq: nunca se llama en eventos de conexión libre (`link.created`). Solo en intentos de envío de argumento (máx. 2 por argumento, luego escala a co-moderador) y en el disparo manual de sugerencia de conexiones por ronda.
- Ably: los mensajes de conexión son livianos y están acotados por la regla "máx. 1 conexión saliente por argumento propio" — no requieren control adicional de cuota.
- Ronda 1/Ronda 2 con cupos decrecientes también acota naturalmente el número de intentos de validación Groq por estudiante por sesión.

## Próximo paso pendiente

Modelo de eventos completo (`turn.*`, `argument.*`, `link.*`, `score.*`) y estructura de archivos del código — ver `docs/06-pendientes.md`. No empezar a escribir componentes de React hasta que el modelo de eventos esté cerrado.
