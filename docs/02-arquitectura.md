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
  3. **Identidad y borrador del participante en el navegador**: el `participantId` se guarda en `localStorage` (además de `sessionStorage`) y, al volver a la sala, se ofrece «Continuar como X» con un clic — no se aplica solo para no confundir identidades en un dispositivo compartido. El borrador del argumento en preparación también se guarda ahí. Nombre y emoji viajan además en `ingreso.confirmado`, así el host recupera los nombres de quien ya se desconectó aunque presencia de Ably los haya olvidado.
  4. **Idempotencia del motor sobre el log**: cada acción irrepetible del motor viaja con una `claveDeIdempotencia` que queda registrada en el estado, así un motor nuevo (host que refrescó) sabe qué se hizo antes de él.

## Por qué no hay reconocimiento de voz en v1

Web Speech API depende de navegadores Chrome/Edge y de conexión estable a los servidores de Google. En un aula real con ruido ambiente y redes variables, es un punto de fallo alto para una demo en vivo frente a un grupo. Se pospone a una fase posterior, como mecánica opcional, no como dependencia del flujo principal.

## Cómo se usa Groq — dos checkpoints controlados, nunca juez en vivo sin supervisión

1. **Validación de forma y clasificación de postura**, al revisar un argumento (en el ingreso y al prepararlo para la ruleta): ¿tiene una afirmación (claim) y al menos una razón (conector como "porque", "ya que", "esto se debe a", evidencia, ejemplo o una relación causa-efecto identificable)? El criterio es **estructural**, no un juicio filosófico de "qué tan bueno es el argumento" — esto evita que la IA sea inconsistente y tome decisiones que un profesor no pueda justificar dos veces de la misma forma ante un estudiante. En la misma llamada Groq devuelve `posturaDetectada`, `esPosturaNueva` y `confianza`; `decidirValidacion.js` los traduce a una decisión y aplica el principio rector: **ante la duda se aprueba**. Reglas de esa decisión:
   - Con `temperature: 0` y semilla fija, el mismo texto da el mismo veredicto.
   - Por debajo de 0.6 de confianza no se le contradice al estudiante la postura que eligió.
   - Una postura marcada `esMatizada: true` en el Programa nunca se contradice: por definición critica o concede algo a los dos polos, y su argumento puede sonar a cualquiera de los otros bandos.
   - Si el argumento no encaja en ninguna postura, se ofrece proponerla al moderador (solo con `permitirPosturasNuevas`) o se pide reescribir.
   - La revisión va por HTTP directo a `/api/groq-validar-argumento`, sin publicar nada a Ably: corregir el borrador las veces que haga falta no gasta cuota de mensajes.
   - **Fiabilidad**: la función serverless reintenta hasta 3 veces (con espera corta, respetando `retry-after`) ante 429, 5xx, error de red o JSON cortado, y usa `max_tokens: 1500` porque el modelo razona antes de responder. Los 4xx distintos de 429 no se reintentan. Con varios estudiantes revisando a la vez, esto evita el "el validador no respondió" que se veía con ráfagas.
2. **Sugerencia de conexiones en lote**: se dispara una sola vez por ronda, cuando el moderador cierra la fase de escritura. Groq analiza todos los argumentos de la ronda juntos y propone relaciones candidatas (origen, destino, tipo, confianza). Solo los estudiantes involucrados en cada sugerencia la ven; aceptan, la rechazan y conectan manualmente, o reescriben su argumento si la sugerencia reveló que estaba mal planteado.

Antes del checkpoint 1 corren dos **filtros deterministas locales** que no son Groq: `api/_revisarFormaMinima.js` (menos de 5 palabras, o un conector causal como «porque» sin razón real detrás — el caso «Este texto no debería presentarse porque ....») y `buscarArgumentoParecido.js` (argumento casi igual a otro ya publicado, por similitud de vocabulario con contenido; se ofrece convertirlo en refuerzo). Ahorran llamadas a Groq y no juzgan contenido. La ortografía queda a cargo del corrector del navegador (`lang="es"`, `spellCheck`); una ayuda con IA sería solo una sugerencia aceptable, nunca automática.

Groq nunca asigna puntaje directamente ni decide de forma final sin que un humano (el propio estudiante o el co-moderador) confirme.

## Zoom del navegador

El zoom de Chrome/Edge se guarda por sitio y afecta por igual al host, a los participantes y a la ventana de proyección. Cuando `outerWidth / innerWidth` cae por debajo de 0,8 la página se amplía sola con la propiedad CSS `zoom` sobre `<html>` (factor inverso, tope ×4; no se aplica con puntero táctil) y la barra ámbar lo explica. Las unidades `vh` se escalan junto con `zoom`, por eso el alto de la ventana se expone compensado en `--alto-de-ventana` y el mapa usa `factorDeCompensacionActual()`. Ver `src/shared/navegador/`.

## Proyección en otra ventana

La consola del host es la **única** que corre el motor de turnos. «Proyectar en otra ventana» abre `/host.html?proyeccion=<sala>`, que no se conecta a Ably: la consola le manda su estado ya calculado por un `BroadcastChannel` (`src/host/proyeccion/canalDeProyeccion.js`), agrupando los cambios en ráfaga. Así no hay segundo motor ni mensajes extra en Ably. Limitación: solo entre pestañas del mismo navegador, que es el caso de una laptop con el proyector como segunda pantalla.

## Control de costos (cuotas gratuitas de Ably y Groq)

- Groq solo se llama en: (a) revisiones de un argumento — máximo 2 intentos automáticos por argumento, al tercer fallo escala a un co-moderador humano —, y (b) el disparo manual de sugerencia de conexiones, una vez por ronda. Los reintentos internos de la función serverless ante un fallo transitorio no cuentan como intentos del estudiante.
- Groq **nunca** se llama en eventos de conexión libre (`link.created`) — esa conexión la valida el co-moderador manualmente, sin costo de API.
- El límite de "1 conexión saliente por argumento propio" acota el volumen de mensajes de Ably de forma natural: el total de conexiones posibles nunca puede superar el total de argumentos existentes en la sesión.
- El sistema de rondas con cupos decrecientes (ver `05-reglas-de-puntaje.md`) también acota el número máximo de intentos de validación Groq por estudiante por sesión — el costo es predecible desde el diseño del Programa, no depende de comportamiento errático de los usuarios.
