# Arquitectura

## Principio rector

Sistema basado en eventos, no un CRUD de estudiantes/argumentos/calificaciones. Ably actúa como bus de eventos; la persistencia es un módulo intercambiable — hoy es un export JSON al cierre de sesión, mañana puede ser un backend opcional sin tocar el núcleo del sistema.

## Componentes

| Componente | Tecnología | Rol |
|---|---|---|
| Frontend estudiante | React + Vite, mobile-first | Botones grandes, bottom sheets, escritura de argumentos |
| Frontend profesor | React + Vite | Proyección: grafo en vivo, ranking por postura, control de fases |
| Tiempo real | Ably (canales, presence) | Sincroniza turnos, argumentos y conexiones entre todos los clientes conectados |
| IA asistencial | Groq (`openai/gpt-oss-20b` / `openai/gpt-oss-120b`) | Valida forma de un argumento; sugiere conexiones en lote |
| Persistencia de sesión | Ninguna — event log de Ably + export JSON/PDF al cierre | Evita dependencia de base de datos en el MVP |
| Persistencia de Programas | Archivo JSON exportable/importable | Plantillas reutilizables entre sesiones y cursos |

## Por qué no hay base de datos en v1

- Reduce fricción de despliegue: no hay backend con estado que mantener ni migrar.
- Ably ya resuelve sincronización en tiempo real y presencia (quién está conectado, útil para la ruleta de turnos).
- El historial de mensajes de Ably tiene retención limitada por diseño — no se debe confundir con un archivo académico permanente. Por eso la sesión se exporta explícitamente al cierre, no se deja "flotando" en Ably.
- Esa retención corta es el punto frágil del aula real: un celular bloqueado unos minutos, un F5 o una pestaña cerrada dejaban a ese cliente sin poder reconstruir el debate. Tres defensas, ninguna de ellas una base de datos:
  1. **Copia local del log** en `localStorage`, por sala (`instantaneaLocal.js`). Como el estado es una función pura del log de eventos, guardar el log alcanza para volver a levantarlo sin servidor. Sobrevive a cerrar la pestaña y al navegador; se descarta sola a las 12 horas y si el canal dice que el debate en curso es otro.
  2. **Recuperación al reconectar**: al volver de una caída se vuelve a leer el historial y se rellena lo que falte (los mensajes ya aplicados se descartan por id). Si quedó un hueco irrecuperable, se dice en pantalla en vez de seguir en silencio.
  3. **Idempotencia del motor sobre el log**: cada acción irrepetible del motor viaja con una `claveDeIdempotencia` que queda registrada en el estado, así un motor nuevo (host que refrescó) sabe qué se hizo antes de él.

## Por qué no hay reconocimiento de voz en v1

Web Speech API depende de navegadores Chrome/Edge y de conexión estable a los servidores de Google. En un aula real con ruido ambiente y redes variables, es un punto de fallo alto para una demo en vivo frente a un grupo. Se pospone a una fase posterior, como mecánica opcional, no como dependencia del flujo principal.

## Cómo se usa Groq — dos checkpoints controlados, nunca juez en vivo sin supervisión

1. **Validación de forma**, al enviar un argumento: ¿tiene una afirmación (claim) y al menos una razón (conector como "porque", "ya que", "esto se debe a", evidencia o ejemplo)? El criterio es **estructural**, no un juicio filosófico de "qué tan bueno es el argumento" — esto evita que la IA sea inconsistente y tome decisiones que un profesor no pueda justificar dos veces de la misma forma ante un estudiante.
2. **Sugerencia de conexiones en lote**: se dispara una sola vez por ronda, cuando el moderador cierra la fase de escritura. Groq analiza todos los argumentos de la ronda juntos y propone relaciones candidatas (origen, destino, tipo, confianza). Solo los estudiantes involucrados en cada sugerencia la ven; aceptan, la rechazan y conectan manualmente, o reescriben su argumento si la sugerencia reveló que estaba mal planteado.

Groq nunca asigna puntaje directamente ni decide de forma final sin que un humano (el propio estudiante o el co-moderador) confirme.

## Control de costos (cuotas gratuitas de Ably y Groq)

- Groq solo se llama en: (a) intentos de envío de un argumento — máximo 2 intentos automáticos por argumento, al tercer fallo escala a un co-moderador humano —, y (b) el disparo manual de sugerencia de conexiones, una vez por ronda.
- Groq **nunca** se llama en eventos de conexión libre (`link.created`) — esa conexión la valida el co-moderador manualmente, sin costo de API.
- El límite de "1 conexión saliente por argumento propio" acota el volumen de mensajes de Ably de forma natural: el total de conexiones posibles nunca puede superar el total de argumentos existentes en la sesión.
- El sistema de rondas con cupos decrecientes (ver `05-reglas-de-puntaje.md`) también acota el número máximo de intentos de validación Groq por estudiante por sesión — el costo es predecible desde el diseño del Programa, no depende de comportamiento errático de los usuarios.
