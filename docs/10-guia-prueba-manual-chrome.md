# Guía de prueba manual — R2 Argumentum (motor real, multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: correr un debate real de punta a punta contra producción y devolver una lista de fallos detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe.

> **Esta guía cubre el rediseño grande de septiembre 2026.** El flujo cambió de raíz: el argumento ahora es requisito para entrar, el turno sirve para defender lo ya escrito (no para escribir contra reloj), y hay capa instruccional, perfiles de puntaje, vista espejo e informe imprimible. Si lo que ves en pantalla se parece más a la versión anterior (fase de "apertura simultánea", turno que abre un formulario en blanco), **el deploy no tomó los cambios**: avisa y no sigas.

## 0. Entorno

- Usar **producción**: `https://r2-argumentum.vercel.app/`.
  - Host: `/host.html` (o la raíz `/` sin parámetros, redirige ahí) — Usuario `arturo.rodriguez@uleam.edu.ec` · Clave `R2ironmaiden`.
  - Participante: `/player.html`, o el link corto `/?sala=XXXX` — es el que generan el QR y el botón "Copiar link".
- **Antes de empezar, revisa el zoom del navegador y déjalo al 100 % (`Ctrl+0`).** El zoom de Chrome se guarda **por sitio**: host y participantes comparten origen (`r2-argumentum.vercel.app`), así que si una pestaña quedó en 33 % (`window.devicePixelRatio` ≈ 0,31–0,33) todas las demás abren igual de diminutas. En la ronda anterior pasó justo eso: los clics y el scroll por coordenadas no funcionaban y hubo que manejar la interfaz por el DOM, lo que limitó lo que se pudo comprobar visualmente. La app **detecta** el zoom por debajo de ~80 % y **se amplía sola** en proporción inversa (propiedad CSS `zoom` sobre `<html>`, tope ×4) para que la interfaz salga a tamaño normal desde el primer momento, y muestra arriba una barra ámbar («El zoom del navegador está en X %, así que ampliamos la página… pulsa Ctrl + 0»). Aun así **deja el zoom al 100 % antes de empezar**: es lo que se prueba de verdad. Con la ampliación automática, comprueba que nada quede desbordado ni cortado (barra ámbar, capa instruccional fija, mapa, ventana de argumento destacado) y que al pulsar Ctrl+0 la página vuelva sola a su tamaño y desaparezca la barra. Si el zoom está bajo, **no** aparece la barra y todo se ve diminuto, anótalo como fallo. En celulares y tabletas (puntero táctil) no se aplica ninguna ampliación.
- **No cierres la sesión del host ni escribas su clave.** Si la pestaña del host ya tiene la sesión iniciada, no hace falta la clave; y para empezar otro debate ya no hay que cerrar sesión: el ranking final tiene «➕ Iniciar un debate nuevo». Si por algún motivo el host te pide la clave, **no la teclees tú**: pídele al usuario que la escriba y espera. (En la ronda anterior se tecleó la clave para volver a entrar tras un «Cerrar sesión»; ese desvío ya no debería hacer falta.)
- **No probar contra local** (`npm run dev`): `ABLY_API_KEY` y `GROQ_API_KEY` son variables "Sensitive" en Vercel, no se pueden recuperar vía CLI. Local no puede ejercitar Groq ni Ably.

## 1. Restricciones operativas — leer antes de empezar

**Ably retiene el historial del canal ~2 minutos.** No es un bug, es la arquitectura ("sin base de datos"). Desde esta ronda hay tres defensas encima (copia local del log, recuperación al reconectar y aviso en pantalla), así que las reglas cambian:

- **Refrescar una pestaña ya NO debería vaciar la sesión**, aunque hayan pasado más de dos minutos: el cliente guarda el log en `localStorage` y arranca de ahí. Si tras un F5 aparece "No se pudo recuperar la sesión" o el debate sale vacío, **eso sí es un fallo** — antes no lo era.
- Lo que sigue sin poder recuperarse es lo que pasó **mientras un cliente estaba desconectado** más tiempo del que Ably retiene. En ese caso debe aparecer el aviso ámbar de estado incompleto; si el cliente sigue como si nada, es un fallo.
- Si pierdes una sesión igual, abre una **nueva** (nuevo código) en vez de pelear por recuperar la vieja.

**Cierra las pestañas de sesiones anteriores.** Cada sesión marca sus eventos con un `identificadorDeSesion` y el historial viejo se descarta al reconstruir el estado, pero ese filtro no alcanza a los eventos **en vivo** de una pestaña de host anterior que siga publicando sobre el mismo código de sala.

## 2. Qué SÍ está implementado

### Configuración (host)

- **Login persistente** (`localStorage`) + catálogo de Programas por categoría o carga de `.json` propio.
- **Solo se restaura automáticamente una sesión ya iniciada.** Si quedó a medio configurar sin iniciar, al recargar vuelve a la lista de Programas. Si estaba iniciada y la pestaña conserva su copia local, un F5 **reconstruye el debate** (también con el debate ya cerrado: el informe no se pierde por un refresco, es intencional). Solo si no hay copia local **y** el historial de Ably ya expiró vuelve a la lista de Programas, con código nuevo al elegir uno; nunca debe reabrir una sala de configuración con el código viejo. Para empezar otro debate está «➕ Iniciar un debate nuevo» en el ranking final.
- **Sala de configuración previa**: código + QR + link corto, participantes conectados, y la configuración de la sesión.
- **Selector de posturas** (si el Programa tiene más de 2): checklist, todas tildadas por defecto, mínimo 2.
- **Modo de calificación** (nuevo): Liviano (10/8/3), Estándar (100/80/30) o Estricto (1000/800/300). Cambia la escala y qué tan caro sale demorarse o rechazar un turno, pero **la proporción entre posiciones se mantiene**.
- **"Permitir posturas nuevas"** (nuevo): casilla, **desactivada por defecto**. La configuración (posturas, modo de calificación y esta casilla) se **republica en vivo mientras la sala está en espera**, no solo al iniciar: los estudiantes ingresan antes de que el moderador arranque, así que tiene que llegarles al toque.

### Ingreso del estudiante — el cambio más grande

El argumento es **requisito para entrar**. El flujo es: nombre + avatar → conecta al canal **sin aparecer en la sala** → elige postura → escribe argumento → lo revisa con Groq → confirma ingreso → **recién ahí aparece en el roster**.

- Con `asignacionPostura: "libre"` el estudiante elige postura; con `"aleatoria"` se le asigna la menos representada, para que los bandos queden parejos. La asignación **se recalcula mientras el estudiante no haya escrito nada** y los empates se reparten por el lugar de cada quien en la sala, no al azar: entrando ocho a la vez los bandos deben quedar parejos.
- Groq hace dos cosas: valida forma (claim + razón) **y clasifica a qué postura pertenece** el argumento. Ante un fallo transitorio la función reintenta sola hasta 3 veces. Quien eligió la postura **Matizada** nunca es contradicho por la clasificación.
- Si propone una **postura nueva**, ve la respuesta del moderador en su pantalla: al aceptarla se le asigna esa postura.
- **Filtros previos a Groq** (nuevo): un texto de menos de 5 palabras, o con «porque»/«ya que»/«dado que»/«debido a»/«puesto que» sin razón detrás (p. ej. «Este texto no debería presentarse porque ....»), se rechaza al instante con su motivo, sin llamar a Groq. Un argumento **casi igual a otro ya publicado** avisa «se parece mucho al de X» y pide reescribirlo con palabras propias. La ortografía **no bloquea**: sin tildes ni mayúsculas debe aprobarse (el corrector del navegador subraya las faltas).
- **Volver tras cerrar la pestaña** (nuevo): con el mismo link `/?sala=XXXX` aparece «Ya habías entrado… Continuar como X»; al continuar conserva puntos, rol y argumentos. Si elige ser otra persona, la identidad anterior no se recupera.
- Quien no confirma antes de que el host inicie queda como **oyente**: ve todo, no recibe turnos, no puntúa.
- **La fase de apertura simultánea ya no existe** en los Programas de ejemplo: el ingreso la reemplaza.

### Durante el debate

- **El turno es para defender lo ya escrito.** El estudiante prepara su argumento mientras escucha ("Revisar y ponerme en la ruleta"); al aprobarse entra a la ruleta. **Sin argumento preparado no se le ofrece la palabra.**
- **Rechazar el turno cuesta puntos** y el botón muestra el costo antes de confirmar.
- **Un argumento preparado con objetivo** (contraargumento, refuerzo, dilema o conexión) **sale conectado**: al exponerlo se publica también la arista hacia el argumento elegido. La lista de objetivos solo ofrece argumentos **ajenos**.
- **Al preparar un argumento parecido a otro**: aviso «se parece mucho al de X» con el botón «Usarlo como refuerzo de ese argumento» (al aplicarlo, tipo y objetivo se rellenan y el aviso no vuelve a saltar). **El borrador se guarda en el navegador**: cerrar la pestaña o refrescar no lo pierde.
- **Los formularios avisan qué falta**: "Revisar y ponerme en la ruleta" y "Lanzar bid" muestran un mensaje si falta el objetivo o el texto, en vez de no hacer nada.
- **Turno hablado de respaldo**: si no queda ningún argumento preparado por exponer y alguien no ha hablado nunca, se le ofrece intervenir de viva voz. Vale poco, y un co-moderador la califica después. El **argumento de ingreso no cuenta** como haber tomado la palabra, y hay **un minuto de margen** desde el inicio de la fase antes de la primera oferta hablada.
- **El co-moderador nunca se califica a sí mismo**: su propio argumento, su propia intervención hablada y sus propios bids no aparecen en su cola.
- **Capa instruccional** (nueva): bloque siempre visible con AHORA / PUEDES / TIENES QUE. En vertical queda fijo arriba y se colapsa a una línea al scrollear.
- **Bids, conexión libre, sugerencias de Groq y panel de co-moderador**: igual que antes.
- **Vista espejo** (nueva, host): ver qué tiene en pantalla cualquier participante. Solo lectura. Muestra el **total** de turnos rechazados y, entre paréntesis, la racha si la hay.
- **Avisos automáticos** (nuevo, host): quién no confirmó ingreso, quién no preparó argumento, quién no ha hablado. **En Cierre y ranking no hay avisos.**
- **Modo proyección** (host): dos botones. «📽️ Proyectar aquí» agranda todo y esconde los controles en la misma pestaña. «🪟 Proyectar en otra ventana» abre una ventana pensada para el proyector que se actualiza sola mientras la consola conserva los controles (la ventana no se conecta a Ably: recibe el estado de la pestaña del host por `BroadcastChannel`, así que **solo funciona en el mismo navegador** y la pestaña del host debe seguir abierta).
- **Argumento destacado** (nuevo): cuando alguien recibe la palabra, el texto que va a defender aparece **en grande unos 12 s** en el host, la proyección y los celulares (no en el de quien habla), se cierra con un toque, y después queda en tamaño normal bajo «X está hablando ahora».
- **Terminar el turno** (nuevo, host): botón «⏭️ Terminar el turno de X» para liberar la ruleta si quien tenía la palabra cerró la pestaña o no puede seguir; el panel de avisos lo advierte solo cuando esa persona queda sin conexión.

### Grafo

- **Layout automático** (dagre): cada argumento se ubica debajo de aquel al que responde.
- Leyenda de colores, minimapa (solo con 6+ nodos) y botones de zoom. **El mapa arranca compacto (~240 px con 1–3 argumentos) y crece con el debate** hasta 560 px en la consola (62 % del alto de la ventana en proyección). **El scroll ya no zoomea el grafo sin querer.**
- **En celular vertical el grafo se reemplaza por una lista** agrupada por postura.

### Cierre

- Ranking por postura con tiers (**los co-moderadores no aparecen a propósito**: no defienden postura), y **informe imprimible**. **El cierre ya no hay que esperarlo**: durante todo el debate el host tiene «📊 Ver ranking parcial» (solo lectura, no detiene nada) y «⏹️ Cerrar el debate ahora» (con confirmación). Desde el ranking, parcial o final, se baja el **PDF** (diálogo de impresión → «Guardar como PDF», con nombre de archivo descriptivo y encabezado «Informe parcial» si el debate sigue) y el **JSON** (`estadoDeLaSesion: "parcial"` o `"cerrada"`).

## 3. Bugs ya arreglados — verificar que NO reaparezcan

Si alguno reaparece es una **regresión real**, va primero en la tabla, severidad alta.

**Arreglados en la última ronda (reporte de la prueba con 8 participantes, 11 puntos):**

A1. **Argumento preparado que apuntaba a otro quedaba suelto en el grafo** (severidad media-alta). Contraargumentos, refuerzos y dilemas publicados al exponer el turno salían sin arista: 13 nodos y solo 3 aristas. **Cómo verificar**: preparar un contraargumento, un refuerzo y un dilema eligiendo "Argumento al que apunta", ganar el turno y publicar cada uno; contar `.react-flow__edge` — debe haber una arista por cada uno, y cada nodo debe quedar **debajo** del que responde, no en la fila raíz.
A2. **"El validador no respondió, inténtalo de nuevo"** con varias revisiones a la vez. La función reintenta y el tope de tokens subió. **Cómo verificar**: que 5–7 participantes pulsen "Revisar" casi a la vez; no debería aparecer ese mensaje (si aparece una vez y al reintentar funciona, anótalo como media y di cuántos revisaban a la vez).
A3. **Postura Matizada rechazada** ("Groq lo clasifica como Más mercado"). **Cómo verificar**: con el Programa de política y asignación que le dé la postura Matizada a alguien, escribir un argumento que critique el libre mercado; debe aprobarse. Para cualquier otra postura la contradicción sigue vigente.
A4. **Formularios sin mensaje**: "Revisar y ponerme en la ruleta" sin objetivo o sin texto, y "Lanzar bid" con objetivo o texto vacíos. **Cómo verificar**: pulsar con cada campo vacío; debe aparecer un aviso rojo que diga qué falta.
A5. **Postura nueva aceptada sin aviso**: al aceptarla el host, la pantalla del estudiante seguía en "Espera su respuesta". **Cómo verificar**: caso borde de posturas nuevas (sección 5), mirando la pantalla del estudiante.
A6. **Vista espejo con "Turnos rechazados: 0"** tras haber rechazado. **Cómo verificar**: que alguien rechace un turno y luego acepte otro; la vista espejo debe decir "Turnos rechazados: 1".
A7. **Avisos operativos en Cierre y ranking** ("6 sin argumento preparado", "5 casos esperando revisión"). **Cómo verificar**: avanzar a `cierre_y_ranking` con casos pendientes; el panel de avisos no debe mostrar nada.
A8. **El objetivo de un contraargumento incluía el argumento propio.** **Cómo verificar**: abrir "Argumento al que apunta" con argumentos propios ya publicados; no deben aparecer.
A9. **F5 del host con el debate cerrado** volvía a la sala de configuración con el mismo código. **Cómo verificar**: cerrar el debate y refrescar el host: debe reconstruir el informe cerrado desde la copia local (**ya no** vuelve a la lista de Programas: cambió a propósito) y nunca reabrir una sala de configuración con el código viejo. Para salir, «➕ Iniciar un debate nuevo».

**Arreglados en la ronda del reporte de 7 actores (verificar que la corrección aguanta):**

B1. **Nombre reemplazado por ID tras cerrar una pestaña y refrescar el host** (alta). Un participante con puntaje cerraba su pestaña, entraba otro con el mismo nombre, el host refrescaba, y el original desaparecía del marcador y salía como `participante-…` en el mapa y el informe. **Cómo verificar**: ver la variante «Mateo» del elenco de actores (sección 4B). El original debe seguir con nombre, emoji, puntos y marca «Sin conexión».
B2. **«Este texto no debería presentarse porque ....» pasaba como argumento.** Ahora un filtro previo a Groq lo rechaza al instante («Después de «porque» no explicas la razón»), igual que los textos de menos de 5 palabras. **Cómo verificar**: mandarlo en el ingreso y en «Prepara tu próximo argumento»; no debe aparecer nunca en el mapa ni en el feed.
B3. **Turno bloqueado si quien hablaba cerraba la pestaña.** La ruleta no avanzaba nunca. **Cómo verificar**: variante «cierra teniendo la palabra» del elenco.
B4. **Argumento «listo» sin texto tras cerrar la pestaña.** El borrador ahora se recupera. **Cómo verificar**: variante «cierra con el argumento ya aprobado» del elenco.

**Arreglados en la ronda anterior (los 10 del reporte de 8 participantes previo):**

1. **El turno hablado de respaldo no se ofrecía nunca.** El argumento de ingreso contaba como "ya tomó la palabra", así que nadie quedaba nunca sin intervenir. Ahora no cuenta, y hay un minuto de margen desde el inicio de la fase antes de la primera oferta hablada. **Cómo verificar**: sesión con varios participantes, que nadie prepare argumento, esperar algo más de un minuto en `escritura_argumentos` — debe ofrecerse un turno en **modo verbal** a alguien que no habló.
2. **El grafo no dibujaba ninguna arista.** Los nodos salían bien ubicados pero contar `.react-flow__edge` daba 0: React Flow medía los conectores en el DOM y, si el mapa se monta en un contenedor sin caja (pestaña en segundo plano, iframe sin alto), descartaba todas las aristas. Los nodos ahora declaran sus conectores. **Cómo verificar**: con conexiones publicadas, contar `.react-flow__edge` — debe coincidir con la cantidad de conexiones, **también** si el grafo se renderizó en una pestaña que estuvo en segundo plano o dentro de un iframe.
3. **"Permitir posturas nuevas" no llegaba a los estudiantes.** El Programa se republicaba recién al pulsar "Iniciar sesión", y el ingreso ocurre antes: validaban contra la configuración por defecto. Además el aviso mostraba el id crudo de la postura (`homo_scientificus`). **Cómo verificar**: ver el caso borde de posturas nuevas en la sección 5.
4. **Bandos desparejos con asignación aleatoria.** Con 8 entrando a la vez quedaron 5/2/1, y con 2 ambas en el mismo bando. **Cómo verificar**: abrir varias pestañas de participante casi simultáneas con un Programa de asignación `aleatoria` y confirmar que las posturas asignadas se reparten parejo (diferencia máxima de 1 entre bandos).
5. **El co-moderador tenía su propio argumento en su cola de validación.** **Cómo verificar**: quien salga co-moderador no debe ver ningún caso propio en su panel.
6. **Clasificación de Groq inestable** (el mismo texto rechazado y, al reenviarlo, aprobado). Ahora `temperature: 0` con semilla fija, y un argumento condicional debe venir con poca confianza en vez de asignarse a un bando. **Cómo verificar**: revisar el mismo argumento dos veces seguidas — mismo veredicto.
7. **Banner de turno en Cierre y ranking.** Ya no debe decir "Esperando que se ofrezca el próximo turno" fuera de `escritura_argumentos` ni con la sesión cerrada.
8. **El grafo no se reencuadraba.** Al publicar un nodo nuevo con el mapa abierto, el último quedaba cortado contra el borde; ahora el mapa vuelve a encuadrarse solo.
9. **La capa instruccional no se re-expandía.** Colapsa al scrollear y debe volver a expandirse al volver arriba, aunque lo que scrollee sea un contenedor interno y no la ventana.
10. **Voseo suelto** ("votá", "marcás") en el panel de co-moderador. Todo el texto visible va en "tú".

**Blindaje de refrescos y cortes de conexión (agregado después de ese reporte):**

11. **El host que refresca duplicaba medio debate.** El motor vive en la pestaña del docente: al recrearse volvía a puntuar cada argumento, a repartir cada bono, a republicar el argumento de cada bid aprobado (nodo duplicado en el grafo) y a mandar el debate a la primera fase del Programa. Además republicaba el Programa original, borrando las posturas filtradas y el perfil de puntaje de la sesión. **Cómo verificar**: ver el caso borde "host que refresca".
12. **Oferta de turno huérfana.** Si el host refrescaba con un turno ofrecido, el temporizador moría con la pestaña y la oferta quedaba colgada para siempre. Ahora el motor nuevo la adopta y la hace expirar.
13. **Cliente desconectado en silencio.** Un celular bloqueado unos minutos volvía y seguía recibiendo lo nuevo sin enterarse de lo que se perdió: menos nodos y menos puntos que el resto, sin ninguna señal. Ahora se avisa en pantalla y se rellena lo que el historial todavía alcance.

**Arreglados en rondas anteriores (16):**

- **Los 3 de la ronda previa**: puntaje imposible en salas sin co-moderador (con 2 participantes exactos el marcador debe mostrar puntos **sin que nadie valide nada**), debates mezclados por reuso del código de sala (una sesión nueva arranca con grafo vacío y marcador en cero), y "Copiar link" sin feedback (cambia a "Copiado", o muestra el link seleccionable si el portapapeles está bloqueado).
- **Los 13 anteriores:** historial de Ably (`direction:forwards`), `max_tokens` de Groq, error HTTP vacío, color del nodo "nuevo", **deadlock de turnos**, **bids que nunca se resolvían**, **nodos superpuestos en el grafo**, **nombres reemplazados por IDs** (grafo/ranking/export), Groq exigiendo la palabra literal "porque", dos botones "Cerrar sesión" ambiguos, **nombre perdido al desconectarse**, texto de turno engañoso, y **sorteo que dejaba cero argumentadores**.

Los cuatro más valiosos de re-verificar: **turno hablado de respaldo**, **aristas del grafo**, **deadlock de turnos** y **ciclo completo de bids**.

## 4. Escenario multi-ventana (1 host + 3 participantes)

1. **Host**: login → Programa "Izquierda o derecha" (Política) → elegir **modo de calificación Estándar** (para que los puntajes sean fáciles de leer: 100/80/30) → anotar el código.
2. **Participantes** (3 pestañas): entrar con "Ana", "Luis" y "Marta", emojis distintos.
   - Confirmar que al entrar **NO aparecen todavía** en la lista del host: primero deben escribir su argumento.
   - Ana: escribir un argumento **malo** (una afirmación sin razón) → confirmar que Groq lo rechaza con motivo → corregirlo con una razón explícita → confirmar aprobación → confirmar ingreso.
   - Luis: argumento bueno directo, confirmar ingreso.
   - **Marta: no confirmar todavía**, dejarla a medias.
3. **Host**: confirmar que la lista muestra a Ana y Luis como confirmados, y a Marta en "Todavía escribiendo su argumento de ingreso". Confirmar que el panel de avisos lo señala.
4. **Host**: "Iniciar sesión". Confirmar 0 co-moderadores con 2 confirmados, o 1 si Marta alcanzó a entrar.
5. **Marta**: confirmar que ahora ve el cartel de **oyente** y que no recibe turnos.
6. **Verificar el puntaje sin co-moderador**: el argumento de ingreso de Ana debe haberle dado **100 puntos** en el marcador del host, sin que nadie valide nada. *(Este es el bug #1 — si el marcador está en 0, es regresión alta.)*
7. **Capa instruccional**: en la pestaña de Ana, confirmar que el bloque de arriba dice qué está pasando y que en **TIENES QUE** aparece "Prepara un argumento para entrar a la ruleta". Scrollear y confirmar que se colapsa a una línea con ese aviso.
8. **Preparar argumento**: Ana escribe su segundo argumento y pulsa "Revisar y ponerme en la ruleta". Confirmar que al aprobarse dice "esperando turno" y que **recién entonces** la ruleta le ofrece la palabra.
9. **Turno**: confirmar que la pantalla de turno ofrecido **muestra el costo de rechazar** ("Rechazar (−20 pts)") y que al aceptar **no aparece un formulario en blanco**, sino su argumento ya escrito con el botón "Ya lo expuse, publicarlo en el mapa". Si ese argumento apuntaba a otro, al publicarlo debe aparecer **la arista** en el grafo.
10. **Rechazo con penalidad**: en el siguiente turno ofrecido, rechazar. Confirmar que el marcador baja 20 puntos.
11. **Turno hablado**: cuando nadie tenga argumento preparado y alguien no haya intervenido, confirmar que se le ofrece un turno en **modo verbal** (texto distinto: "intervenir hablando"). Registrarlo y confirmar que aparece en el panel del co-moderador para calificar. Dos aclaraciones: el argumento de ingreso **no** cuenta como haber tomado la palabra, y el primer turno hablado no se ofrece hasta pasado un minuto del inicio de la fase.
12. **Bid**: mientras alguien tiene el turno, otro lanza un bid. El co-moderador vota, el host da veredicto.
13. **Vista espejo**: en el host, elegir a Ana en "Ver la pantalla de un participante". Confirmar que muestra lo mismo que ella tiene (misma capa instruccional), que **no** muestra lo que está escribiendo y que "Turnos rechazados" cuenta los rechazos que hizo aunque después haya aceptado otro turno.
14. **Grafo**: con 3+ argumentos conectados, confirmar que las respuestas quedan **debajo** de aquello a lo que responden, que hay leyenda y minimapa, y que **rodar la rueda del mouse sobre el grafo scrollea la página en vez de zoomear**.
15. **Proyección**: (a) «📽️ Proyectar aquí» → todo más grande, sin controles; salir. (b) «🪟 Proyectar en otra ventana» → se abre una ventana que muestra el debate en vivo; publica un argumento y compruébalo en las dos (consola y ventana). Si el navegador bloquea la ventana emergente debe aparecer un aviso rojo en la consola. **Mapa**: con 1–3 argumentos la caja es baja (~240 px) y crece al agregar más, hasta su tope.
16. **Argumento destacado**: cuando alguien recibe la palabra, su texto aparece en grande ~12 s en el host, en la ventana de proyección y en los demás celulares (**no** en el de quien habla). Se cierra con un toque. Recargar la página a mitad de turno no lo hace reaparecer. Después queda en tamaño normal bajo «X está hablando ahora».
17. **Ranking parcial y cierre anticipado** (sin esperar a `cierre_y_ranking`): «📊 Ver ranking parcial» baja hasta «Ranking parcial (el debate sigue en curso)» y **no** detiene nada. Descarga el **PDF** (diálogo de impresión, vista previa solo con el informe, encabezado «Informe parcial», nombre de archivo «Informe R2 Argumentum - …») y el **JSON** (`estadoDeLaSesion: "parcial"`). Luego «⏹️ Cerrar el debate ahora»: la confirmación debe decir cuántos no han hablado; al aceptar, ranking final en el host, pantalla de resultado en los celulares y la ruleta detenida.
18. **Cierre normal** (en una sesión aparte, avanzando fases hasta `cierre_y_ranking`): panel de avisos vacío, ranking con **nombres** (no IDs), PDF y JSON. Cancelar el diálogo de impresión.
19. **Debate nuevo**: en el ranking final, «➕ Iniciar un debate nuevo» → confirmación → lista de Programas, **sin pedir login**.

## 4B. Elenco de actores — la prueba que de verdad importa

Una prueba con participantes idénticos no encuentra los fallos del aula. Corre el escenario con **al menos 8 pestañas** y reparte estos comportamientos; cada actor hace siempre lo mismo. Anota qué pasó con cada uno.

| Actor | Qué hace | Qué debe pasar |
|---|---|---|
| **Hablador** (Ana) | Apenas termina un turno prepara otro argumento, lanza bids, conecta todo lo que puede. | No debe monopolizar la ruleta: cuenta cuántos turnos tuvo cada quien; si Ana tiene más del doble del promedio, anótalo. Su puntaje debe frenarse al pasar el límite de posiciones del perfil (no crece sin techo). |
| **Callada** (Silvia) | Entra con su argumento de ingreso y no vuelve a escribir nada. | El panel de avisos la señala («no tienen ningún argumento preparado»; pasados ~6 min, aviso rojo «no han tomado la palabra»). Debe recibir el turno hablado de respaldo. El debate no debe cerrarse solo sin que hable. |
| **Participación mínima** (Luis, Diego) | Ingreso + una sola intervención. | Marcador coherente; los avisos dejan de nombrarlos apenas intervienen. |
| **Co-moderador experto** | Valida rápido, vota los bids, califica las intervenciones habladas ajustando arriba o abajo. | Bonos repartidos; su cola nunca incluye lo propio. |
| **Co-moderador perdido** (Carla) | Valida la mitad de su cola, no vota bids, ignora las intervenciones habladas. | Aviso «casos esperando revisión de los co-moderadores» con su nombre. Los bids sin votos expiran o el host los resuelve a mano. El puntaje base no depende de ella y **el debate nunca queda bloqueado**. Su pantalla debe explicarle qué puede hacer (capa instruccional): anota si se pierde. |
| **El de los rechazos** (Pedro) | En el ingreso manda, en este orden: una afirmación sin razón; «Este texto no debería presentarse porque ....»; tres palabras sueltas; un argumento de otra postura; y por fin uno bueno. | Los tres primeros se rechazan con motivo claro (los dos últimos de forma inmediata, sin llamar a Groq); el cuarto avisa de postura distinta; el quinto entra. **Ninguno de los rechazados aparece en el mapa ni en el feed.** |
| **El copión** | Escribe algo casi igual a un argumento ya publicado, cambiando dos o tres palabras. | Aviso «se parece mucho al de X». En «Prepara tu próximo argumento» aparece «Usarlo como refuerzo de ese argumento»; al aplicarlo ya no vuelve a saltar el aviso. |
| **El apurado** | Escribe todo en minúsculas y sin tildes («la educacion publica reduce la desigualdad porque…»). | **No debe rechazarse** (la ortografía no bloquea). Con el corrector en español del navegador activo, las palabras con falta salen subrayadas. Anota cómo se ve ese argumento en el mapa: es el caso que motiva la decisión abierta sobre ayuda de redacción con IA. |
| **El de la pestaña cerrada** (Mateo) | Ver las variantes de abajo. | Ver abajo. |

**Variantes de «se le cierra la pestaña»** (usa una persona distinta para cada una, o repítelas en orden). En todas, vuelve a entrar por el mismo link `/?sala=XXXX`:

- **a) En pleno ingreso**, sin confirmar: al volver debe aparecer «Ya habías entrado a la sala…» con un botón «Continuar como X» por cada identidad de esa sala en este navegador; elige la de la persona que se cerró.
- **b) Con el argumento ya aprobado y esperando turno**: al continuar debe ver «Tu argumento está listo» **con su texto** y los mismos puntos.
- **c) Teniendo la palabra**: el host ve el aviso rojo «X tiene la palabra pero está sin conexión»; pulsa «⏭️ Terminar el turno de X» y la ruleta sigue con otra persona. Si X vuelve antes, puede continuar y publicar.
- **d) Siendo co-moderador**: al volver conserva su rol y su cola.
- **e) Entra como otra persona con el mismo nombre** (elige no continuar): queda como participante nuevo (oyente si el debate ya empezó). **Refresca el host (F5) y comprueba lo más importante**: el Mateo original sigue en el marcador con nombre, emoji, puntos y la marca «Sin conexión»; sus argumentos y su fila del informe muestran su nombre y **nunca** un ID `participante-…`. El Mateo nuevo aparece aparte, sin confirmar.
- **f) Otro navegador o dispositivo**: no hay forma de recuperar la identidad (no hay login de estudiantes) — es lo esperado, anótalo como informativo, no como fallo.

**Host, durante ese debate:** proyecta en otra ventana mientras pasa todo esto; en algún momento pide el ranking parcial, baja el PDF y el JSON, y cierra el debate con gente que aún no ha hablado.

## 5. Casos borde

- **Posturas nuevas**: con el Programa de 12 posturas filosóficas, **tildar la casilla en la sala de espera antes de que el estudiante escriba** y esperar un segundo a que se republique el Programa. Escribir un argumento que no defienda ninguna postura de la lista. Confirmar que Groq lo detecta, que aparece el botón para proponerla al moderador, que el nombre de la postura sugerida se lee **en texto legible y no como id** (`homo scientificus`, no `homo_scientificus`), que al host le llega la propuesta y que al aceptarla la postura se suma al debate y queda tildada. **En la pantalla del estudiante**, al aceptarla debe aparecer un aviso de aceptación, la postura nueva debe quedar asignada y debe poder confirmar su ingreso; al rechazarla, debe pedirle reescribir. Repetir con la casilla **desactivada** → debe pedir reescribir, sin opción de proponer.
- **Arista de un argumento preparado**: con 3 participantes, cada uno prepara un tipo distinto con objetivo (contraargumento, refuerzo, dilema) apuntando a un argumento **ajeno**, y lo publica al ganar el turno. Contar `.react-flow__edge` en host y participante: una por cada uno. Confirmar que ninguna lista de objetivos ofrece el argumento propio.
- **Ráfaga de revisiones con Groq**: 5–7 participantes pulsan "Revisar" casi a la vez (en el ingreso o preparando argumento). No debe aparecer "El validador no respondió". Repetir el mismo texto dos veces: mismo veredicto.
- **Postura Matizada**: entrar con la postura Matizada (Programa de política o de libre albedrío) y escribir un argumento que critique un polo; debe aprobarse sin pedir cambiar de postura.
- **Formularios incompletos**: en "Prepara tu próximo argumento" pulsar "Revisar y ponerme en la ruleta" con objetivo vacío (tipo contraargumento) y con el texto vacío; en el panel de bid pulsar "Lanzar bid" con objetivo vacío y con texto vacío. Cada caso debe mostrar un aviso que diga qué falta.
- **Oferta de turno sin responder**: dejar una oferta sin contestar más de 20 segundos. Debe expirar y volver a ofrecerse. **No es un fallo** que, si esa persona es la única con argumento preparado, se le renueve a ella misma (con cuenta regresiva nueva) — anótalo solo si la cuenta regresiva **no se reinicia** o si hay otro candidato con argumento listo y nunca le llega.
- **Turno hablado de respaldo**: con la sesión iniciada y **nadie** preparando argumento, esperar poco más de un minuto. Debe ofrecerse un turno en modo verbal a alguien que no haya hablado. Registrarlo y confirmar que el co-moderador puede calificarlo y que el puntaje se acredita.
- **Aristas del grafo**: publicar al menos 3 conexiones y contar `.react-flow__edge` en el DOM del host y de un participante. Debe coincidir con la cantidad de conexiones. Repetir dejando la pestaña del grafo en segundo plano mientras se publican los nodos y volviendo a ella después.
- **Host que refresca** (importante): con el debate andando, varios argumentos publicados y al menos un bid aprobado, anotar el marcador de cada participante y la cantidad de nodos del grafo. Refrescar la pestaña del host (F5) y esperar a que reconstruya. Verificar que **los puntajes son los mismos** (no el doble), que **no aparecieron nodos duplicados**, que la fase sigue siendo la misma (no volvió a la ronda 1) y que las posturas destildadas siguen fuera. Después cerrar una fase y confirmar que avanza a la que sigue, no a la primera.
- **Host que refresca con un turno ofrecido**: refrescar justo mientras hay una oferta de turno en pantalla. La oferta debe expirar sola y la ruleta volver a girar, en vez de quedar colgada.
- **Host que refresca con el debate cerrado**: cerrar el debate y refrescar el host, tanto dentro del minuto como pasados varios minutos. En los dos casos debe reconstruir el informe y el ranking desde la copia local (nunca reabrir una sala de configuración con el código viejo). Salir con «➕ Iniciar un debate nuevo». Cerrar las pestañas de participantes viejas antes de abrir otra sesión.
- **Co-moderador que refresca**: con el debate avanzado, F5 en la pestaña del co-moderador. Debe reaparecer con el debate completo (no vacío), con su rol y su cola de validación.
- **Desconexión larga de un participante**: en Chrome DevTools, poner la pestaña de un participante en modo offline (Network → Offline) tres o cuatro minutos mientras el debate sigue, y volver a ponerla online. Debe aparecer primero el aviso rojo de conexión caída, después el de "poniéndote al día", y —si se perdió algo— el aviso ámbar permanente de estado incompleto. Lo que pase después de reconectar debe verse normalmente.
- **Postura distinta a la elegida**: elegir "Más mercado" y escribir un argumento claramente estatista. Confirmar el aviso y la opción de cambiarse de postura. *(Si Groq viene con poca confianza, el sistema aprueba igual — eso es deliberado, no un fallo.)*
- **Deadlock de turnos** (regresión del bug #5): dejar expirar una oferta cuando quede un solo elegible. La ruleta debe volver a ofrecérsela.
- **Perfil Estricto**: iniciar otra sesión con modo Estricto y confirmar que el primer argumento da **1000 puntos** y que rechazar un turno cuesta **300**.
- **Celular vertical**: reducir el viewport de un participante a ~375px. Confirmar que el grafo se reemplaza por la **lista agrupada por postura**, que la capa instruccional queda fija arriba, que se colapsa al scrollear y que **se vuelve a expandir al volver arriba**.
- **Celular horizontal**: viewport apaisado y bajo (~700×400). Confirmar el **layout partido**: instrucciones fijas a la izquierda, trabajo a la derecha.
- Refrescar (F5) una pestaña de participante, dentro del minuto y también pasados varios minutos → en los dos casos debe reconstruir el estado, ahora desde la copia local.
- Conectar el mismo argumento propio dos veces → no debe permitirlo.
- Cargar un `.json` de Programa inválido → mensaje de error, no avanza.
- **Ranking con co-moderadora**: cierra el debate con al menos un co-moderador con puntos. **Es intencional** que no aparezca en el ranking ni en el informe (no defiende postura); no lo anotes como fallo, pero deja constancia de cuántos puntos tenía por si se decide mostrarlos.

## 5B. Probar como celular con F12 (modo dispositivo)

Sirve para revisar el diseño de celular sin tener varios teléfonos. Es **muy buena aproximación** pero no sustituye a un celular real (ver «Qué no comprueba»).

**Cómo montarlo**

1. **Host en una pestaña normal de escritorio, sin emulación**, con el zoom en 100 %. La ventana «Proyectar en otra ventana» solo funciona dentro del mismo navegador y se maneja mejor con teclado y ratón.
2. **Cada participante en su propia pestaña** con F12 → `Ctrl+Shift+M` (barra de dispositivos). La emulación es **por pestaña**: hay que activarla en cada una.
3. Elige un dispositivo de ~375–390 px (iPhone SE / 12 / 14, Pixel 7) para el caso vertical. El botón de **rotar** de la barra da el caso horizontal (~667×375 u 844×390).
4. **Desacopla F12 a una ventana aparte** (⋮ → *Dock side* → *Undock*) o ciérralo tras configurar: acoplado, roba espacio y el viewport deja de ser el del dispositivo elegido. El «Fit to window» de la barra solo achica el dibujo, no es zoom del navegador.
5. Anota siempre en el reporte **qué dispositivo emulaste, en qué orientación y a qué ancho**.

**Qué debe verse en cada modo**

- **Vertical (< 600 px)**: el mapa se reemplaza por la **lista agrupada por postura**; la capa instruccional queda fija arriba y se colapsa al scrollear, y se re-expande al volver arriba; el **argumento destacado** aparece en grande sin tapar los botones de turno y se cierra con un toque; los botones son tocables sin pinchar el vecino.
- **Horizontal bajo (~700×400)**: layout partido, instrucciones fijas a la izquierda y trabajo a la derecha.
- **Sin ampliación por zoom ni barra ámbar**: en modo dispositivo el puntero es táctil y la app no compensa nada. Si aparece la barra o la página sale ampliada, es un fallo.
- **Desconexión**: `Network` → *Offline* tres o cuatro minutos y de vuelta a *No throttling* (ver casos borde).
- **Varias pestañas en el mismo navegador comparten `localStorage`**: al abrir el link de la sala aparecerá «Continuar como…» con todas las identidades que ya entraron. Para entrar como persona nueva **ignóralo y llena el formulario**; para las variantes de pestaña cerrada elige la identidad correcta. Si quieres aislar del todo a cada participante, usa una **ventana de incógnito** por persona (la proyección solo necesita al host y su ventana en el mismo navegador normal).

**Qué no comprueba** (anótalo como «no verificado», no como bueno):

- Teclado virtual tapando el cuadro de texto, notch y barras del sistema.
- Bloqueo de pantalla, cambio de app o pérdida de red real del celular (lo que más desconecta en clase).
- Corrector ortográfico y autocorrección del teclado del teléfono, y el escaneo del QR.
- Rendimiento con 20+ nodos o varias pestañas en un teléfono de gama baja.

Si puedes, cierra la ronda con **un celular real** entrando por el QR de la sala.

## 6. Formato de reporte

| # | Pantalla / dispositivo | Pasos para reproducir | Esperado | Obtenido | Severidad |
|---|----------|------------------------|----------|----------|-----------|

- Si algo falla por historial de Ably expirado tras varios minutos, anótalo aparte como "esperado por retención de Ably", no en la tabla.
- Si reaparece un bug de la sección 3, márcalo como **REGRESIÓN**, primero en la tabla, severidad alta.
- Si no hay fallos reales, dilo explícitamente. No inventes hallazgos.
- **No son fallos**: la retención de ~2 minutos del historial de Ably para quien estuvo desconectado (debe verse el aviso, no un debate vacío tras un F5), la renovación de una oferta al único candidato elegible, la ausencia de co-moderadores en el ranking, y que una identidad de participante no se pueda recuperar desde otro navegador o dispositivo (no hay login de estudiantes).
- Indica siempre **qué no pudiste verificar y por qué** (por ejemplo, el zoom del navegador impidió la rueda del mouse o el viewport de celular), en lugar de darlo por bueno.

## 7. Pendiente de verificar

**Cambios de esta ronda que nunca se probaron en un navegador** (solo hay pruebas automatizadas de la lógica pura). Prioriza estos:

- **Ventana de proyección** («🪟 Proyectar en otra ventana»): que se abra, que se actualice sola con cada argumento y turno, que muestre el argumento destacado, y que muestre «Esperando a la consola del host…» si se abre la URL con una sala sin consola.
- **Filtro `api/_revisarFormaMinima.js` en producción**: Vercel debe empaquetarlo con la función `groq-validar-argumento`. Si el despliegue o la primera revisión fallan con un error de import, ese es el sitio. Verifica también que **no** se exponga como endpoint (`/api/_revisarFormaMinima` debe dar 404).
- **Corrector ortográfico** del navegador: depende de que el diccionario en español esté activo en Chrome; anota si no subraya nada.
- **Alto dinámico del mapa**: que no salte ni parpadee al agregar nodos, que el minimapa aparezca con 6+ nodos, y cómo se ve en proyección (62 % del alto).
- **Argumento destacado** en celular (no tapa los botones de turno) y en proyección.
- **Recuperación de identidad** con `/?sala=XXXX` en un dispositivo compartido: no debe ofrecerse a quien no es esa persona más allá del aviso, y «Salir» debe borrar la identidad guardada.

**Pendientes de rondas anteriores** (por limitaciones del navegador de automatización; si puedes usar ratón real y viewports normales, prioriza estos):

- **Rueda del mouse sobre el grafo**: debe scrollear la página, no zoomear.
- **Celular vertical (~375 px) y horizontal (~700×400)**: ahora se puede con el modo dispositivo de F12 (sección 5B). Con `minimum-scale=1` la página no debe alejarse sola. Comprueba también el **reencuadre del grafo** al publicar nodos nuevos (en escritorio).
- **Re-expansión de la capa instruccional** al volver arriba tras colapsarse.
- **JSON de Programa inválido** en la carga.
- **Casilla «permitir posturas nuevas» desactivada** con textos claramente ajenos a la lista: debe pedir reescribir sin ofrecer proponerla.
- **Perfil Estricto** (1000/800/300) y **postura nueva propuesta**.
- **Ampliación automática por zoom bajo**: Ctrl+− a 50 % o menos → la página se amplía sola (no sale una tira diminuta en medio de la pantalla), con barra ámbar y «Ocultar»; con Ctrl+0 vuelve al tamaño normal y la barra desaparece. Revisa host (lista de Programas y consola en vivo), participante y la ventana de proyección; el mapa y el argumento destacado no deben desbordar. En 1920 px de ancho al 100 %, la interfaz debe verse proporcionalmente más grande que en 1366 px.
- **Contenido real del `.json` descargado** y **vista previa del diálogo de impresión** (se dispararon sin error pero no se pudo inspeccionar el diálogo nativo).

## 8. Cierre

Resumen de máximo 4 líneas: fallos por severidad, si hubo regresiones, y si el ciclo completo (ingreso con argumento → preparación → turno → exposición → puntaje → bid → cierre → ranking → informe) se completó de punta a punta o dónde se cortó.
