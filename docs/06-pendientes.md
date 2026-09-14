# Pendientes y próximos pasos

Decisiones abiertas o trabajo técnico que todavía no se ha hecho. No empezar a escribir código de la aplicación (componentes React, etc.) hasta cerrar al menos el modelo de eventos.

## Próximo paso inmediato

- **Modelo de eventos completo** sobre Ably: `turn.offered`, `turn.accepted`, `turn.rejected`, `turn.timeout`, `argument.submit_attempt`, `argument.submitted`, `argument.validated`, `link.created`, `link.suggested`, `score.updated`, más los eventos de cambio de fase (`phase.started`, `phase.closed`). Definir payload exacto de cada uno.
- **Estructura de archivos del código** (carpetas de frontend estudiante/profesor, módulo de conexión a Ably, módulo de llamadas a Groq, módulo de carga/validación de Programa).

## Decisiones abiertas (no bloquean el arranque, pero hay que resolverlas pronto)

- Nombre definitivo del proyecto (provisional: "Argumentum").
- Tope máximo de co-moderadores para grupos grandes (la fórmula `ceil(n × 0.10)` no tiene techo definido todavía; ¿se limita a un máximo absoluto, ej. 6-8, independientemente del tamaño del curso?).
- Herramienta de visualización del grafo argumental: React Flow vs. Cytoscape.js — evaluar cuál es más simple de integrar para el MVP.
- Detalle técnico de la autenticación simple (nombre + apellido + emoji): cómo se generan y evitan colisiones de emoji/nombre dentro de una misma sesión.
- Valores concretos de `puntajeConexion` (aceptar sugerencia / conectar manual / corregir tras rechazo) — están definidos como parámetros en el Programa pero faltan números por defecto.
- Formato exacto del export PDF ("mapa de evolución argumentativa") — es una mecánica valiosa pero no crítica para el primer build funcional.

## Mecánicas de fases futuras (explícitamente fuera de v1)

- Reconocimiento de voz en vivo (Web Speech API) como alternativa/complemento a escribir el argumento.
- Modo torneo (argumentos anónimos, adivinar autor/postura).
- "Argumento fantasma" (desafío del sistema tras una intervención).
- "Defiende lo contrario" (cambio forzado de postura a mitad de debate).
- Modo cooperativo sin equipos (construcción colectiva de un argumento único).
- Backend/base de datos para histórico institucional entre sesiones, más allá del archivo JSON del Programa y el export de sesión.
