# Visión y alcance

> **Estado:** el alcance descrito acá ya está construido y desplegado (ver `README.md` y `docs/06-pendientes.md` para el detalle de qué está cerrado y qué falta).

## Problema que resuelve

Los debates estudiantiles tradicionales premian quién habla más o quién "gana" una votación superficial. Esta plataforma registra la **estructura argumental** — cómo se relacionan los argumentos entre sí — no solo la participación.

## Idea central

No registrar solo intervenciones; registrar relaciones entre argumentos: apoyo, contraargumento, dilema, conexión, reformulación, concesión. El debate se convierte en un grafo argumental dinámico que el profesor puede proyectar en vivo mientras los estudiantes participan desde el celular.

## Alcance de la v1 (MVP)

Incluye:

- 3 roles: **Moderador** (profesor), **Co-moderador** (sorteado entre participantes), **Participante** (estudiante).
- Autenticación simple sin login: nombre + apellido + emoji aleatorio.
- Turnos por ruleta ponderada (favorece a quien ha hablado menos), con opción de **aceptar o rechazar** el turno ofrecido.
- Escritura de argumentos en rondas con cupos y puntaje decreciente, validados en forma por IA (Groq) antes de publicarse.
- **Conexión libre** entre argumentos, disponible en todo momento (sin necesidad de turno), limitada a **1 conexión saliente por argumento propio**.
- Sugerencia de conexiones en lote por IA (Groq), disparada por el moderador al cerrar una fase — el estudiante confirma, rechaza o reescribe.
- Postura fija por debate (a favor / en contra / otras), usada para un ranking segmentado por postura, no un puntaje numérico expuesto públicamente.
- Cada debate se configura mediante un **Programa de Debate** (plantilla reutilizable) — ver `03-programa-de-debate.md`.
- Exportación de la sesión completa a JSON (y opcionalmente PDF) al cierre.

No incluye en v1 (mecánicas de fases futuras, no descartadas, solo pospuestas):

- Reconocimiento de voz en vivo (Web Speech API) — depende de Chrome/Edge y de red estable; riesgo de fallo alto en una demo de aula real con ruido.
- Modo torneo, "argumento fantasma", "defiende lo contrario", modo cooperativo sin equipos.
- Backend/base de datos para histórico institucional entre sesiones (más allá del archivo JSON del Programa).

## Nombre del proyecto

Provisional: **Argumentum**. Pendiente de confirmación definitiva por el usuario antes de fijarlo en código/branding.
