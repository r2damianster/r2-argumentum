# Argumentum — Laboratorio de Debate Argumental en Tiempo Real

Plataforma educativa para debates estructurados en tiempo real. El objetivo no es solo participar o votar quién "gana", sino construir en vivo una red de relaciones entre los argumentos de los estudiantes (apoyos, contraargumentos, dilemas, conexiones).

## Estado del proyecto

Fase de diseño — sin código todavía. Este README y la carpeta `docs/` contienen las decisiones de arquitectura, reglas de puntaje y flujo pedagógico acordadas hasta ahora. Próximo paso: modelo de eventos completo y primer build.

## Idea central

No se registra solo quién habla, sino cómo se relacionan los argumentos entre sí. El debate se convierte en un grafo argumental dinámico que el profesor puede proyectar en vivo mientras los estudiantes participan desde el celular.

## Stack previsto

| Componente | Tecnología |
|---|---|
| Frontend | React + Vite (mobile-first para estudiantes, pantalla de proyección para el profesor) |
| Tiempo real | Ably (canales pub/sub + presence) — sin base de datos para el estado de la sesión en vivo |
| IA asistencial | Groq (`openai/gpt-oss-20b` para validar, `openai/gpt-oss-120b` para sugerir conexiones) — nunca puntúa de forma autoritativa sin confirmación humana |
| Persistencia de sesión | Event log de Ably + export JSON/PDF al cierre |
| Persistencia de plantillas | "Programas de Debate" como archivos JSON exportables/importables (v1, sin backend) |

## Por qué no hay base de datos ni reconocimiento de voz en v1

Ver `docs/02-arquitectura.md` — decisión deliberada para reducir puntos de fallo en una demo de aula real y mantener costo de APIs gratuitas bajo control.

## Documentación

- [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) — problema, idea central, qué entra y qué no en el MVP
- [`docs/02-arquitectura.md`](docs/02-arquitectura.md) — stack, por qué sin BD, cómo se usa Groq, control de costos
- [`docs/03-programa-de-debate.md`](docs/03-programa-de-debate.md) — esquema completo de la plantilla de configuración de cada debate
- [`docs/04-roles-y-turnos.md`](docs/04-roles-y-turnos.md) — roles, flujo de turnos (ruleta, aceptar/rechazar), conexión libre
- [`docs/05-reglas-de-puntaje.md`](docs/05-reglas-de-puntaje.md) — fórmula única de puntaje para estudiantes y co-moderadores
- [`docs/06-pendientes.md`](docs/06-pendientes.md) — decisiones abiertas y próximos pasos técnicos
