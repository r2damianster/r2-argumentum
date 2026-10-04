# Foro escrito y núcleo reutilizable

> **Estado (4-oct-2026):** plan aprobado por el docente y **H1–H9 construidos y probados en local** (613 pruebas, build correcto). **H10 queda por hacer en producción**: la prueba de punta a punta (`scripts/prueba-e2e/foro.py`), el celular físico y la verificación del canal privado de integridad con Ably real, que desde local no se pueden comprobar. Detalle en `docs/06-pendientes.md`. Este documento es la fuente de verdad de la decisión.

## Qué se agrega

Una segunda **actividad** además del debate hablado: el **foro escrito sincrónico**. Nadie habla; se escriben posts y réplicas durante un tiempo total (por ejemplo 20 minutos). El moderador elige la actividad antes de elegir el Programa, y el Programa lleva el campo `actividad` (`debate_hablado` por defecto, así los Programas existentes siguen funcionando).

Al mismo tiempo se extrae un **núcleo de funciones independientes de cualquier actividad** para que futuras actividades se compongan con las mismas piezas.

## Decisiones (todas aprobadas)

| Tema | Decisión |
|---|---|
| Groq | **Solo sugiere** (completo / incompleto / posibles falacias). Nunca puntúa. Es el mismo checkpoint 1, ampliado: sin llamada extra. |
| Quién decide si un aporte cuenta | Co-moderadores y moderador. Tres niveles: *cuenta completo*, *parcial* (50 %), *no cuenta*. El moderador manda; si no interviene, rige la mayoría de los co-moderadores. |
| Sin revisión | El aporte **cuenta completo** (el puntaje base no depende de una revisión, ver `05`). |
| Co-moderadores | Modo reglamentario (por defecto, `ceil(10 %)`) / número fijo / sin co-moderadores. **Mínimo de 6 participantes** para co-moderar. Designación por sorteo o manual, en la sala de espera, cuando ya ingresaron. |
| Integridad | **Sin evaluación (por defecto)** / con advertencias / restrictiva. |
| Tiempo | Solo la duración total de la actividad. Nada de tiempos por respuesta. |
| Ingreso al foro | Nombre, avatar y postura. **No exige argumento previo.** Se puede entrar durante todo el foro. |
| Tope de puntaje | 3 posts nuevos (posiciones 1–3) + hasta 5 réplicas puntuadas (valor de la posición 3). Los extras se publican y valen 0. |
| Reacciones | «Me convenció», «Me hizo dudar», «Aporta evidencia». Sin puntos en v1; el **convencimiento cruzado** (reacción «me convenció» de alguien de la postura contraria) se cuenta y se muestra al moderador y en el informe. |
| Puntaje de co-moderadores | Por **porcentaje de acierto**, no todo o nada (ver abajo). Aplica a las dos actividades. |

## Puntaje de co-moderadores: acierto relativo

Reemplaza al «coincide exactamente → +5» de las exposiciones y bids, y a los bonos sueltos de reclasificar y marcar falta (que se pagaban sin pasar por el moderador y eran farmeables).

1. **Referencia de cada aporte revisado:** la decisión del moderador (peso 1); si no intervino, el consenso de los co-moderadores, es decir el nivel que rige al cerrar, con al menos dos votos (peso 0,6); si no hay ninguna, el aporte no entra en el acierto. Si el moderador descartó las revisiones de un aporte, no cuenta ni como acierto ni como esfuerzo.
2. **Cercanía** de un voto: `1 − |nivel − nivel de referencia| / rango de la escala`. Sirve para cualquier escala.
3. **Acierto** = promedio ponderado de la cercanía, corregido por azar: `max(0, (promedio − 0,5) / 0,5)`. Votar al azar da 0. Sin ninguna referencia disponible vale 0,5 (reconocimiento de esfuerzo).
4. **Esfuerzo** = `min(1, aportes revisados / revisionesObjetivo)`, con `revisionesObjetivo = 7`.
5. **Puntos** = `suma de valoresBasePosicion del perfil × acierto × esfuerzo`. El tope es lo que puede ganar un debatiente con sus posiciones, así que el rol es comparable al de argumentar y escala solo con el perfil. El total nunca baja de cero.

Sin moderador que evalúe, los co-moderadores igual puntúan, por consenso entre ellos.

## Arquitectura: núcleo y actividades

```
src/shared/nucleo/
  coModeracion/    cuántos co-moderadores, sorteo, validación de designación manual
  revision/        referencia, cercanía, puntaje de revisores, asignación de revisores
  sugerenciaDeIA/  adaptador de Groq: { completitud, falacias, confianza } (la IA propone)
  integridad/      señales de redacción, niveles, canal privado
  conciencia/      métricas de participación y aportes sin debatir
  reacciones/      registro, conteos, convencimiento cruzado
  temporizador/    tiempo restante, cierre y extensión deducidos del log
  informe/         desglose de puntaje y secciones comunes del informe
  (puntaje)        sigue en src/shared/puntaje/
src/actividades/
  registroDeActividades.js
  debateHablado/   (envuelve lo existente, sin cambiar comportamiento)
  foroEscrito/
```

**Contrato de actividad:** `definirActividad({ id, etiqueta, descripcion, modulosQueUsa, reductor, motor: { alIniciar, alSincronizar, alCerrar }, vistaDelParticipante, vistaDelModerador, camposDelPrograma })`.

**Reglas de migración:**
- Funciones puras, sin conocer ninguna actividad: reciben datos y parámetros, devuelven resultados.
- El debate hablado se envuelve con paridad exacta: `sesionCompleta.test.js` y el resto de la suite siguen verdes sin editarse (salvo los de puntaje de revisores, que cambian a propósito).
- Los eventos antiguos (`exposicion.calificada`, `exposicion.evaluada_moderador`…) siguen entendiéndose: los logs de sesiones previas no se rompen.
- Eventos nuevos en español con prefijo de módulo: `revision.*`, `reaccion.*`, `integridad.*`, `aporte.ocultado`, `fase.extendida`.

## Foro escrito: especificación

- **Configuración en la sala de espera** (se republica como el perfil): duración total, perfil, idioma, moderación, integridad.
- **Publicar:** nuevo post o réplica en cualquier momento. Groq sugiere; quien escribe lo ve y puede reescribir (tope de 2 intentos). Se publica siempre, salvo el filtro local de textos vacíos. Las etiquetas de la IA las ven el autor, los co-moderadores y el moderador; los pares no.
- **Ocultar:** co-moderadores y moderador; solo el moderador revierte. El post sigue en el log y vale 0.
- **Cierre:** aviso a los 2 minutos; al llegar a cero se cierra la escritura y sigue una fase de revisión final donde se sigue decidiendo hasta que el moderador pulse «Cerrar y calcular». Puede extender (+5 min) o cerrar antes.
- **Puntaje:** provisional al publicar; la revisión humana ajusta una sola vez al cierre, con clave de idempotencia.
- **Revisión:** cada aporte se asigna a 2 co-moderadores por hash estable (sin eventos); cualquiera puede revisar más. La cola va primero con lo que Groq marcó. El moderador ve el consenso agregado, nunca quién votó qué. Sin co-moderadores, la revisión del moderador es opcional.
- **Pantalla:** cabecera con cuenta atrás; franja de métricas (posts, posts por persona, réplicas promedio por post, porcentaje sin responder); aviso «Hay N posts sin debatir» (el más antiguo primero, con preferencia por postura contraria); bandeja «Te respondieron»; hilos en el celular y grafo en proyección; compositor fijo abajo.

## Integridad

| Nivel | Qué ocurre |
|---|---|
| Sin evaluación | No se registra nada y no se crea canal privado. |
| Con advertencias | Se registran señales. El autor ve «el moderador verá esta marca» y elige «Enviar igual» o «Reescribir». Solo el moderador ve las marcas. |
| Restrictivo | Se bloquean pegar y arrastrar; se registran los intentos y el autor lo sabe. |

**Señales:** pegado (`insertFromPaste`), arrastre (`insertFromDrop`), velocidad imposible de escritura, cambio de pestaña (gravedad baja: en el celular es normal), parecido a otro post y parecido a los ejemplos del Programa. **No hay detector de «texto de IA»**: es poco fiable y perjudica a quien escribe en un segundo idioma. El dictado por voz y el autocorrector insertan en bloque y se marcan como bajo, no como pegado. Restaurar el borrador guardado no cuenta como pegado.

**Privacidad:** las marcas viajan por `debate:integridad:{sala}`, donde los participantes solo pueden publicar y únicamente el host puede suscribirse (capacidades del token en `api/ably-token.js`). Los co-moderadores no las ven. Con el nivel activado, el ingreso avisa que se registran señales. Son una advertencia al instructor, no una prueba.

## Informe final: JSON y PDF

El informe es **por actividad** pero arma sus secciones con piezas comunes del núcleo (`nucleo/informe`). Como hoy, se puede bajar en cualquier momento (parcial) y al cierre (final), con el mismo nombre de archivo descriptivo.

**Desglose del puntaje (común a las dos actividades).** Hoy el informe muestra solo el total. Se agrega, por persona, de dónde sale cada punto, derivado de los `score.updated` del log según su `motivo` y `categoria`: puntaje base de aportes, penalidades, ajustes por revisión o exposición, y bonos de co-moderación.

**JSON** (`exportarSesion`), además de lo actual:
- `actividad`.
- `desglosePorParticipante`: total y componentes.
- `revisionDeAportes`: por aporte, sugerencia de la IA, revisiones (co-moderadores en agregado y decisión del moderador), nivel final y ajuste aplicado.
- `evaluacionDeCoModeradores`: por co-moderador, aportes revisados, acierto, esfuerzo y puntos.
- `metricasDeParticipacion`: posts, réplicas, porcentaje sin responder, personas sin intervenir.
- `reacciones`: conteos por aporte y convencimiento cruzado.
- `anexoDeIntegridad`: **solo si el nivel estaba activo**, y en un archivo aparte (`…-integridad.json`) para que no viaje en el informe general.

**PDF** (vista de impresión, sin librería, como hoy): se conservan la lista individual y la lista por postura, y se agregan tabla de desglose del puntaje, resultado de los co-moderadores con su acierto y esfuerzo, métricas del foro y reacciones. La integridad **no se imprime por defecto**: va en un anexo opcional («Incluir anexo de integridad»), porque el informe puede proyectarse. Las etiquetas de falacia de la IA tampoco se muestran contra nombres en el PDF general; solo en agregado.

## Cómo quedó construido (resumen técnico)

- **Núcleo** (`src/shared/nucleo/`): `coModeracion`, `revision` (referencia, cercanía, puntaje de revisores, cola de revisión y reparto estable), `temporizador`, `conciencia` (métricas, hilos, «sin debatir»), `reacciones`, `sugerenciaDeIA`, `integridad` e `informe` (desglose del puntaje y evaluación de co-moderadores). Funciones puras, sin conocer ninguna actividad; el puntaje de aportes vive en `src/shared/puntaje/puntajeDeAportes.js`.
- **Actividades** (`src/actividades/`): `definirActividad` (contrato), `registroDeActividades` y las carpetas `debateHablado/` (lo extraído del motor, con paridad) y `foroEscrito/` (motor, cierre, informe). El motor base (`src/host/motorDeSesion.js`) delega en la actividad del Programa. Las pantallas no están en el contrato: cada app asocia el id de la actividad con sus componentes.
- **Eventos nuevos:** `fase.extendida`, `reaccion.registrada`, `aporte.ocultado`, `aporte.restaurado`, `revision.registrada` y `revision.decidida_moderador` (ver `09`). El reducer **solo acepta** las decisiones del moderador, las revisiones de co-moderadores, las reacciones y los ocultamientos si los publicó quien dice ser (el `clientId` real que pone Ably y que `useEstadoDeSesion` ya le pasa). Un estudiante no puede falsificar la decisión del moderador.
- **Sugerencia de IA:** `api/groq-sugerir-evaluacion.js` (mismo checkpoint 1, ampliado). Descarta falacias con tipo inventado, con confianza menor a 0,6 o cuyo fragmento no está en el texto. **Si Groq falla (cuota, error, sin red), el aporte se publica igual** y quien escribe ve «no fue pre-revisado por límites de la IA» (`CompositorDeAporte.jsx`); la IA nunca condiciona participar.
- **Integridad:** apagada por defecto. El host lee `debate:integridad:{sala}`; los participantes publican **por REST** (una petición HTTP con su token) porque su token solo permite `publish` en ese canal. Cada marca se valida antes de aceptarse (debe haberla publicado quien dice ser).
- **Informe:** el JSON y el PDF traen el desglose del puntaje de cada persona (de dónde sale cada punto), el resultado de los co-moderadores y, en el foro, la participación, las reacciones, un resumen agregado de las sugerencias de la IA y la revisión aporte por aporte. La integridad va en un archivo aparte y no se imprime salvo que el moderador marque la casilla.

### Límites conocidos de esta primera versión

- **Corrección del tipo de relación** como campo de la revisión: no se implementó. Un aporte ya trae el tipo que su autor eligió y el puntaje no depende de él.
- **Reloj de los equipos:** la cuenta atrás usa la hora de cada dispositivo (hay un parámetro de desfase listo, pero no se alimenta con la hora del servidor de Ably). Un equipo con la hora mal puesta verá un tiempo distinto.
- **Canal privado de integridad:** verificado con Ably real **en local** el 4-oct-2026 (`scripts/prueba-e2e/foro-vivo-local.mjs`, 1 host + 6 participantes en Chrome, 23 comprobaciones en verde, incluida la sugerencia real de Groq): el host recibe la marca de pegado, ningún participante ve el panel y el anexo se descarga aparte. Falta repetirlo **en producción** (hito H10).
- **Proyección del foro:** muestra tiempo, métricas y los 5 hilos más recientes; no incluye el mapa de argumentos.
- El pegado y borrado completo de un texto reinicia las señales; escribir encima de lo pegado sin borrar todo las conserva.

## Plan por hitos

| Hito | Contenido | Criterio de aceptación |
|---|---|---|
| H1 ✅ | Núcleo puro: `coModeracion` (y arreglo del rol fantasma en el reducer), `revision`, `temporizador`, `conciencia`, puntaje de aporte | Pruebas nuevas; suite actual intacta |
| H2 ✅ | Puntaje de revisores unificado en el debate hablado; retiro de la cola «Confirmar validación»; panel de revisión del moderador | `05` actualizado; pruebas migradas |
| H3 ✅ | Contrato de actividad, registro, selector de actividad, hablado envuelto | `sesionCompleta.test.js` verde sin editarlo |
| H4 ✅ | Configuración de moderación y designación en la sala de espera | Pruebas con 3, 6 y 12 participantes |
| H5 ✅ | Foro: Programa de ejemplo, fase, reductor, vistas de participante y host | Sesión completa en local |
| H6 ✅ | Sugerencia de IA, cola de revisión del foro, cierre | Revisión con y sin moderador |
| H7 ✅ | Integridad: recolector, niveles, canal privado y token, panel | Pruebas de capacidades del token |
| H8 ✅ | Métricas, avisos, reacciones y proyección | Revisión a 320 px |
| H9 ✅ | **Informe final del foro (JSON y PDF)** con desglose de puntaje | Archivos generados y revisados a mano |
| H10 ⏳ | E2E en producción (`scripts/prueba-e2e/foro.py`), 8 móviles, guía en `10`, documentación (`02`, `03`, `04`, `05`, `09`, `12`, `AGENTS.md`) | `npm run verificar` verde; 0 hallazgos graves |

## Riesgos conocidos

- Refactor de `motorDeSesion.js` (887 líneas) y del reducer (708): se migra por paridad, con las pruebas actuales.
- Reloj de los equipos: la cuenta atrás usa `terminaEn` absoluto; conviene corregir con la hora del servidor de Ably.
- Ráfaga a Groq: ~25 personas en 20 minutos son unas 200 llamadas; revisar la cuota antes de una sala grande.
- Un commit despliega solo (hook de auto-push): el cambio de capacidades del token se prueba antes de commitear.
- Las guardias de `src/guardias/guardias.test.js` no se tocan.
