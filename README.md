# Argumentum — Laboratorio de Debate Argumental en Tiempo Real

Plataforma educativa para debates estructurados en tiempo real. El objetivo no es solo participar o votar quién "gana", sino construir en vivo una red de relaciones entre los argumentos de los estudiantes (apoyos, contraargumentos, dilemas, conexiones).

## Estado del proyecto

**Motor de debate real construido y desplegado en producción** (`r2-argumentum.vercel.app`): login del host, selector de Programa de Debate por categorías, sala con código+QR y link corto, **ingreso obligatorio con argumento** (Groq valida la forma y clasifica la postura) con **asignación de posturas balanceada y sorteo de co-moderadores, **ruleta de turnos con priorización de posturas en Ronda 1**, cortacircuitos anti-bucle infinito y pausado/reanudación para el moderador, calificación de exposiciones por co-moderadores (promedio), evaluación opcional del moderador y ajustes de puntaje al cerrar (con turno hablado de respaldo), perfiles de puntaje (Liviano / Estándar / Estricto), **módulo de contraargumentación para oyentes**, **interfaz accesible WCAG 2.1 AA** con tarjetas de vista previa de argumento completo (`.vista-previa-argumento-completo`), **doble podio diferenciado** (en pantalla: 1.º Podio de Posturas con ejemplos centralizados $\rightarrow$ 2.º Podio de Estudiantes; en informe PDF/JSON: 1.º Lista Individual de Estudiantes incluyendo quienes tienen 0 puntos $\rightarrow$ 2.º Lista por Postura), grafo argumental en vivo (React Flow + dagre), conexión libre, sugerencias de conexión por Groq, bids de intervención con voto de co-moderadores, panel de co-moderador, capa instruccional, vista espejo y modo proyección para el host, argumento destacado en grande al recibir la palabra, export a JSON e informe en PDF, y recuperación de identidad y borrador ante cierres de pestaña.

Probado de punta a punta contra producción en varias sesiones de prueba manual (ver `docs/10-guia-prueba-manual-chrome.md` para el procedimiento y `docs/06-pendientes.md` para el detalle de lo cerrado). Cuenta con una suite de pruebas automatizadas en Vitest (**278 tests pasando en 27 archivos de prueba** (incluye las guardias contra errores ya cometidos), ejecutables con `npm test`; `npm run verificar` corre pruebas + build, y `npm run instalar-hooks` activa un hook `pre-push` que lo exige antes de subir; GitHub Actions lo corre en cada push).

Cada debate se juega en **español (por defecto) o en inglés**, a elección del docente al configurar la sala: cambia el corrector ortográfico de los campos de texto y el idioma en que Groq valida los argumentos. La interfaz sigue siempre en español (no hay capa de traducción).

## Idea central

No se registra solo quién habla, sino cómo se relacionan los argumentos entre sí. El debate se convierte en un grafo argumental dinámico que el profesor puede proyectar en vivo mientras los estudiantes participan desde el celular.

## Stack previsto

| Componente | Tecnología |
|---|---|
| Frontend | React + Vite (mobile-first para estudiantes, `host.html`/`player.html` multi-page) |
| Tiempo real | Ably (canales pub/sub + presence), event-sourcing puro — sin base de datos para el estado de la sesión en vivo. Historial retenido ~2 min por defecto (ver `docs/02-arquitectura.md`) |
| IA asistencial | Groq (`openai/gpt-oss-20b` para validar forma y clasificar postura, `openai/gpt-oss-120b` para sugerir conexiones) — nunca puntúa de forma autoritativa sin confirmación humana. La función serverless reintenta ante fallos transitorios |
| Persistencia de sesión | Event log de Ably (con copia local en `localStorage` de cada cliente, más identidad y borrador del participante) + export a JSON e informe imprimible a PDF, parciales o finales |
| Persistencia de plantillas | "Programas de Debate" como archivos JSON exportables/importables, catálogo por categoría en la consola del host |

## Por qué no hay base de datos ni reconocimiento de voz en v1

Ver `docs/02-arquitectura.md` — decisión deliberada para reducir puntos de fallo en una demo de aula real y mantener costo de APIs gratuitas bajo control.

## Documentación

- [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) — problema, idea central, qué entra y qué no en el MVP
- [`docs/02-arquitectura.md`](docs/02-arquitectura.md) — stack, por qué sin BD, cómo se usa Groq, control de costos
- [`docs/03-programa-de-debate.md`](docs/03-programa-de-debate.md) — esquema completo de la plantilla de configuración de cada debate
- [`docs/04-roles-y-turnos.md`](docs/04-roles-y-turnos.md) — roles, flujo de turnos (ruleta, aceptar/rechazar), conexión libre
- [`docs/05-reglas-de-puntaje.md`](docs/05-reglas-de-puntaje.md) — fórmula única de puntaje para estudiantes y co-moderadores
- [`docs/06-pendientes.md`](docs/06-pendientes.md) — qué está cerrado, decisiones abiertas y próximos pasos técnicos
- [`docs/07-acceso-y-paginas.md`](docs/07-acceso-y-paginas.md) — estructura de páginas, acceso del host y de participantes
- [`docs/08-identidad-visual.md`](docs/08-identidad-visual.md) — color de marca y paleta semántica del grafo
- [`docs/09-modelo-de-eventos.md`](docs/09-modelo-de-eventos.md) — eventos del canal de Ably (event sourcing)
- [`docs/10-guia-prueba-manual-chrome.md`](docs/10-guia-prueba-manual-chrome.md) — guía de prueba manual multi-ventana contra producción
- [`docs/11-auditoria-antigravity-2026-09.md`](docs/11-auditoria-antigravity-2026-09.md) — auditoría del 24-sep-2026: diagnóstico, decisiones aplicadas y verificación en navegador
- [`docs/12-guia-para-agentes.md`](docs/12-guia-para-agentes.md) — **guía para agentes y colaboradores** (Antigravity, Claude Code…): reglas, errores ya cometidos y cómo probar; resumen en [`AGENTS.md`](AGENTS.md)
- [`scripts/prueba-e2e/`](scripts/prueba-e2e/README.md) — prueba automatizada en navegador (Playwright) contra producción

## Autoría

**Arturo Rodríguez** — docente, investigador y vibe coder · ORCID [0000-0002-7017-9443](https://orcid.org/0000-0002-7017-9443). Recurso creado con el apoyo de **Claude** (Anthropic) y **Antigravity**.
