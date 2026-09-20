# Visión y alcance

> **Estado:** el alcance descrito aquí ya está construido y desplegado (ver `README.md` y `docs/06-pendientes.md` para el detalle de qué está cerrado y qué falta).

## Problema que resuelve

Los debates estudiantiles tradicionales premian quién habla más o quién "gana" una votación superficial. Esta plataforma registra la **estructura argumental** — cómo se relacionan los argumentos entre sí — no solo la participación.

## Idea central

No registrar solo intervenciones; registrar relaciones entre argumentos: apoyo, contraargumento, dilema, conexión, reformulación, concesión. El debate se convierte en un grafo argumental dinámico que el profesor puede proyectar en vivo mientras los estudiantes participan desde el celular.

## Alcance de la v1 (MVP)

Incluye:

- 3 roles: **Moderador** (profesor), **Co-moderador** (sorteado entre participantes), **Participante** (estudiante).
- Autenticación simple sin login: código de sala + nombre + emoji. **El argumento es requisito para entrar**: quien no lo confirma antes de que el moderador inicie la sesión queda como oyente.
- Turnos por ruleta ponderada (favorece a quien ha hablado menos) **solo para quien ya tiene un argumento publicado pendiente de exponer**: el argumento entra al mapa y puntúa apenas Groq lo aprueba, y el turno sirve para exponerlo en voz alta, no para escribirlo contra reloj. Se puede **aceptar o rechazar** (rechazar resta puntos de los que ya ganó); al exponerlo, los co-moderadores lo califican y el moderador puede evaluarlo, con los ajustes aplicados al cerrar. Si nadie tiene nada preparado y alguien aún no habló, se ofrece un turno hablado de respaldo.
- Argumentos con puntaje decreciente por posición y ronda, validados en forma por IA (Groq) antes de publicarse. Groq además clasifica la postura que defiende el texto, sin ser nunca juez autoritativo.
- Perfiles de puntaje elegibles por el docente (Liviano / Estándar / Estricto), capa instruccional para cada participante, vista espejo, avisos automáticos y modo proyección para el moderador (en la misma pestaña o en una ventana aparte para el proyector, con el argumento de quien habla destacado en grande unos segundos).
- **Conexión libre** entre argumentos, disponible en todo momento (sin necesidad de turno), limitada a **1 conexión saliente por argumento propio**.
- Sugerencia de conexiones en lote por IA (Groq), disparada por el moderador al cerrar una fase — el estudiante confirma, rechaza o reescribe.
- Postura fija por debate (a favor / en contra / otras), usada para un ranking segmentado por postura, no un puntaje numérico expuesto públicamente.
- Cada debate se configura mediante un **Programa de Debate** (plantilla reutilizable) — ver `03-programa-de-debate.md`.
- Exportación de la sesión completa a JSON y un informe imprimible (PDF mediante la impresión del navegador). El moderador puede ver el ranking parcial y bajar ambos archivos en cualquier momento, o cerrar el debate antes de tiempo.
- Resiliencia de aula: si a alguien se le cierra la pestaña, recupera su identidad y su borrador; si quien tiene la palabra desaparece, el moderador libera la ruleta; los argumentos vacíos ("…porque ....") o casi copiados de otro se filtran antes de publicarse.

No incluye en v1 (mecánicas de fases futuras, no descartadas, solo pospuestas):

- Reconocimiento de voz en vivo (Web Speech API) — depende de Chrome/Edge y de red estable; riesgo de fallo alto en una demo de aula real con ruido.
- Modo torneo, "argumento fantasma", "defiende lo contrario", modo cooperativo sin equipos.
- Backend/base de datos para histórico institucional entre sesiones (más allá del archivo JSON del Programa).

## Nombre del proyecto

Provisional: **Argumentum**. Pendiente de confirmación definitiva por el usuario antes de fijarlo en código/branding.
