# Argumentum — Laboratorio de Debate Argumental en Tiempo Real

Plataforma educativa para debates estructurados en tiempo real. El objetivo no es solo participar o votar quién "gana", sino construir en vivo una red de relaciones entre los argumentos de los estudiantes (apoyos, contraargumentos, dilemas, conexiones).

## Estado del proyecto

**Motor de debate real construido y desplegado en producción** (`r2-argumentum.vercel.app`): login del host, selector de Programa de Debate por categorías, sala con código+QR, sorteo de posturas y co-moderadores, ruleta de turnos, escritura de argumentos validada por Groq, grafo argumental en vivo (React Flow), conexión libre, sugerencias de conexión por Groq, bids de intervención con voto de co-moderadores, panel de co-moderador, puntaje en vivo y ranking final con export a JSON.

Probado de punta a punta contra producción en una sesión de prueba manual — ver `docs/10-guia-prueba-manual-chrome.md` para el detalle. Pendientes conocidos en `docs/06-pendientes.md` (el más relevante: el puntaje de conexiones todavía no está implementado).

## Idea central

No se registra solo quién habla, sino cómo se relacionan los argumentos entre sí. El debate se convierte en un grafo argumental dinámico que el profesor puede proyectar en vivo mientras los estudiantes participan desde el celular.

## Stack previsto

| Componente | Tecnología |
|---|---|
| Frontend | React + Vite (mobile-first para estudiantes, `host.html`/`player.html` multi-page) |
| Tiempo real | Ably (canales pub/sub + presence), event-sourcing puro — sin base de datos para el estado de la sesión en vivo. Historial retenido ~2 min por defecto (ver `docs/02-arquitectura.md`) |
| IA asistencial | Groq (`openai/gpt-oss-20b` para validar, `openai/gpt-oss-120b` para sugerir conexiones) — nunca puntúa de forma autoritativa sin confirmación humana |
| Persistencia de sesión | Event log de Ably + export a JSON al cierre (PDF todavía no implementado) |
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
