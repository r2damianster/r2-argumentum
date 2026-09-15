# Pendientes y próximos pasos

Decisiones abiertas o trabajo técnico que todavía no se ha hecho. No empezar a escribir código de la aplicación (componentes React, etc.) hasta cerrar al menos el modelo de eventos.

## Próximo paso inmediato

- ~~Modelo de eventos completo~~ — cerrado, ver `09-modelo-de-eventos.md`.
- ~~Estructura de archivos del código~~ — cerrado. Scaffold funcional: `host.html`/`player.html` (Vite multi-page), `src/host` y `src/player` (React), `src/shared` (cliente Ably, nombres de eventos, fórmula de puntaje, colores, carga de Programa), `api/` (funciones serverless: `ably-token.js`, `groq-validar-argumento.js`, `groq-sugerir-conexiones.js`). `npm run build` y `npm run dev` verificados funcionando.
- ~~Variables de entorno en Vercel~~ — cerrado. `ABLY_API_KEY` y `GROQ_API_KEY` cargadas en Production y Preview; probadas en vivo contra `r2-argumentum` en Vercel: `/api/ably-token` genera tokens correctamente, `/api/groq-validar-argumento` distingue bien un argumento sin razón ("las personas son malas") de uno con razón, `/api/groq-sugerir-conexiones` devuelve sugerencias de relación entre dos argumentos.
- **Nota para el futuro — modelos de Groq:** el catálogo de modelos de Groq cambia; `llama-3.1-70b-versatile` y `llama-3.3-70b-versatile` estaban descontinuados/no disponibles al probar (sept. 2026). Modelos vigentes usados: `openai/gpt-oss-20b` (validación, checkpoint 1) y `openai/gpt-oss-120b` (sugerencia de conexiones, checkpoint 2) — ambos con soporte de `json_mode`. Si un endpoint empieza a fallar con `model_decommissioned` o `model_not_found`, consultar `GET https://api.groq.com/openai/v1/models` con la key activa para ver el catálogo vigente antes de asumir que la key es inválida.
- **Sigue pendiente, no bloqueante:** la `ABLY_API_KEY` en uso ahora mismo es una key **Root** (privilegios completos, sin restricción de canal) — funciona, pero no sigue el criterio de mínimo privilegio ya documentado en `07-acceso-y-paginas.md`. Reemplazarla por una key restringida a `debate:*` con solo Publish+Subscribe+Presence+History cuando haya oportunidad.

## Decisiones abiertas (no bloquean el arranque, pero hay que resolverlas pronto)

- Nombre definitivo del proyecto (provisional: "Argumentum").
- Tope máximo de co-moderadores para grupos grandes (la fórmula `ceil(n × 0.10)` no tiene techo definido todavía; ¿se limita a un máximo absoluto, ej. 6-8, independientemente del tamaño del curso?).
- Herramienta de visualización del grafo argumental: React Flow vs. Cytoscape.js — evaluar cuál es más simple de integrar para el MVP.
- Detalle técnico de la autenticación simple (nombre + apellido + emoji): cómo se generan y evitan colisiones de emoji/nombre dentro de una misma sesión.
- Valores concretos de `puntajeConexion` (aceptar sugerencia / conectar manual / corregir tras rechazo) — están definidos como parámetros en el Programa pero faltan números por defecto.
- Formato exacto del export PDF ("mapa de evolución argumentativa") — es una mecánica valiosa pero no crítica para el primer build funcional.

## Mecánicas de fases futuras (explícitamente fuera de v1)

- **Bid de tipo "agregar argumento nuevo"** (pedir turno para sumar un argumento propio sin apuntar a nadie, no solo desmontar/fortalecer) — se descartó de v1 por riesgo de perder profundidad en la discusión; posible v2 si el flujo de desmontar/fortalecer funciona bien en aula.
- Reconocimiento de voz en vivo (Web Speech API) como alternativa/complemento a escribir el argumento.
- Modo torneo (argumentos anónimos, adivinar autor/postura).
- "Argumento fantasma" (desafío del sistema tras una intervención).
- "Defiende lo contrario" (cambio forzado de postura a mitad de debate).
- Modo cooperativo sin equipos (construcción colectiva de un argumento único).
- Backend/base de datos para histórico institucional entre sesiones, más allá del archivo JSON del Programa y el export de sesión.
