# Pendientes y próximos pasos

Decisiones abiertas o trabajo técnico que todavía no se ha hecho. No empezar a escribir código de la aplicación (componentes React, etc.) hasta cerrar al menos el modelo de eventos.

## Próximo paso inmediato

- ~~Modelo de eventos completo~~ — cerrado, ver `09-modelo-de-eventos.md`.
- ~~Estructura de archivos del código~~ — cerrado. Scaffold funcional: `host.html`/`player.html` (Vite multi-page), `src/host` y `src/player` (React), `src/shared` (cliente Ably, nombres de eventos, fórmula de puntaje, colores, carga de Programa), `api/` (funciones serverless: `ably-token.js`, `groq-validar-argumento.js`, `groq-sugerir-conexiones.js`). `npm run build` y `npm run dev` verificados funcionando.
- **Pendiente crítico y bloqueante para probar tiempo real:** crear la key de Ably correcta (Publish+Subscribe+Presence+History, restringida a `debate:*`, ver `07-acceso-y-paginas.md`) y cargarla como `ABLY_API_KEY` en Vercel. Las dos keys creadas antes (Subscribe-only y Root) quedaron expuestas en el chat de esta sesión — deben revocarse en el dashboard de Ably si no se ha hecho ya, sin importar cuál se use finalmente.
- **Pendiente relacionado:** cargar `GROQ_API_KEY` en Vercel (console.groq.com) para que `/api/groq-validar-argumento` y `/api/groq-sugerir-conexiones` funcionen.
- Sin estas dos variables de entorno, el scaffold actual compila y las pantallas de login/ingreso funcionan, pero no hay conexión real a Ably ni validación real de Groq — son los siguientes dos requisitos para pasar de scaffold a MVP funcional.

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
