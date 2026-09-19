# Guía de prueba manual — R2 Argumentum (motor real, multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: correr un debate real de punta a punta contra producción y devolver una lista de fallos detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe.

> **Esta guía cubre el rediseño grande de septiembre 2026.** El flujo cambió de raíz: el argumento ahora es requisito para entrar, el turno sirve para defender lo ya escrito (no para escribir contra reloj), y hay capa instruccional, perfiles de puntaje, vista espejo e informe imprimible. Si lo que ves en pantalla se parece más a la versión anterior (fase de "apertura simultánea", turno que abre un formulario en blanco), **el deploy no tomó los cambios**: avisá y no sigas.

## 0. Entorno

- Usar **producción**: `https://r2-argumentum.vercel.app/`.
  - Host: `/host.html` (o la raíz `/` sin parámetros, redirige ahí) — Usuario `arturo.rodriguez@uleam.edu.ec` · Clave `R2ironmaiden`.
  - Participante: `/player.html`, o el link corto `/?sala=XXXX` — es el que generan el QR y el botón "Copiar link".
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
- **Solo se restaura automáticamente una sesión ya iniciada.** Si quedó a medio configurar sin iniciar, al recargar vuelve a la lista de Programas.
- **Sala de configuración previa**: código + QR + link corto, participantes conectados, y la configuración de la sesión.
- **Selector de posturas** (si el Programa tiene más de 2): checklist, todas tildadas por defecto, mínimo 2.
- **Modo de calificación** (nuevo): Liviano (10/8/3), Estándar (100/80/30) o Estricto (1000/800/300). Cambia la escala y qué tan caro sale demorarse o rechazar un turno, pero **la proporción entre posiciones se mantiene**.
- **"Permitir posturas nuevas"** (nuevo): casilla, **desactivada por defecto**. La configuración (posturas, modo de calificación y esta casilla) se **republica en vivo mientras la sala está en espera**, no solo al iniciar: los estudiantes ingresan antes de que el moderador arranque, así que tiene que llegarles al toque.

### Ingreso del estudiante — el cambio más grande

El argumento es **requisito para entrar**. El flujo es: nombre + avatar → conecta al canal **sin aparecer en la sala** → elige postura → escribe argumento → lo revisa con Groq → confirma ingreso → **recién ahí aparece en el roster**.

- Con `asignacionPostura: "libre"` el estudiante elige postura; con `"aleatoria"` se le asigna la menos representada, para que los bandos queden parejos. La asignación **se recalcula mientras el estudiante no haya escrito nada** y los empates se reparten por el lugar de cada quien en la sala, no al azar: entrando ocho a la vez los bandos deben quedar parejos.
- Groq hace dos cosas: valida forma (claim + razón) **y clasifica a qué postura pertenece** el argumento.
- Quien no confirma antes de que el host inicie queda como **oyente**: ve todo, no recibe turnos, no puntúa.
- **La fase de apertura simultánea ya no existe** en los Programas de ejemplo: el ingreso la reemplaza.

### Durante el debate

- **El turno es para defender lo ya escrito.** El estudiante prepara su argumento mientras escucha ("Revisar y ponerme en la ruleta"); al aprobarse entra a la ruleta. **Sin argumento preparado no se le ofrece la palabra.**
- **Rechazar el turno cuesta puntos** y el botón muestra el costo antes de confirmar.
- **Turno hablado de respaldo**: si no queda ningún argumento preparado por exponer y alguien no ha hablado nunca, se le ofrece intervenir de viva voz. Vale poco, y un co-moderador la califica después. El **argumento de ingreso no cuenta** como haber tomado la palabra, y hay **un minuto de margen** desde el inicio de la fase antes de la primera oferta hablada.
- **El co-moderador nunca se califica a sí mismo**: su propio argumento, su propia intervención hablada y sus propios bids no aparecen en su cola.
- **Capa instruccional** (nueva): bloque siempre visible con AHORA / PUEDES / TIENES QUE. En vertical queda fijo arriba y se colapsa a una línea al scrollear.
- **Bids, conexión libre, sugerencias de Groq y panel de co-moderador**: igual que antes.
- **Vista espejo** (nueva, host): ver qué tiene en pantalla cualquier participante. Solo lectura.
- **Avisos automáticos** (nuevo, host): quién no confirmó ingreso, quién no preparó argumento, quién no ha hablado.
- **Modo proyección** (nuevo, host): botón "📽️ Proyectar" — agranda todo y esconde los controles.

### Grafo

- **Layout automático** (dagre): cada argumento se ubica debajo de aquel al que responde.
- Leyenda de colores, minimapa y botones de zoom. **El scroll ya no zoomea el grafo sin querer.**
- **En celular vertical el grafo se reemplaza por una lista** agrupada por postura.

### Cierre

- Ranking por postura con tiers, export `.json`, y **informe imprimible** (nuevo): botón "🖨️ Generar PDF del debate" que abre el diálogo de impresión.

## 3. Bugs ya arreglados — verificar que NO reaparezcan

Si alguno reaparece es una **regresión real**, va primero en la tabla, severidad alta.

**Arreglados en esta ronda (los 10 del último reporte, prueba con 8 participantes):**

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
9. **Turno**: confirmar que la pantalla de turno ofrecido **muestra el costo de rechazar** ("Rechazar (−20 pts)") y que al aceptar **no aparece un formulario en blanco**, sino su argumento ya escrito con el botón "Ya lo expuse, publicarlo en el mapa".
10. **Rechazo con penalidad**: en el siguiente turno ofrecido, rechazar. Confirmar que el marcador baja 20 puntos.
11. **Turno hablado**: cuando nadie tenga argumento preparado y alguien no haya intervenido, confirmar que se le ofrece un turno en **modo verbal** (texto distinto: "intervenir hablando"). Registrarlo y confirmar que aparece en el panel del co-moderador para calificar. Dos aclaraciones: el argumento de ingreso **no** cuenta como haber tomado la palabra, y el primer turno hablado no se ofrece hasta pasado un minuto del inicio de la fase.
12. **Bid**: mientras alguien tiene el turno, otro lanza un bid. El co-moderador vota, el host da veredicto.
13. **Vista espejo**: en el host, elegir a Ana en "Ver la pantalla de un participante". Confirmar que muestra lo mismo que ella tiene (misma capa instruccional) y que **no** muestra lo que está escribiendo.
14. **Grafo**: con 3+ argumentos conectados, confirmar que las respuestas quedan **debajo** de aquello a lo que responden, que hay leyenda y minimapa, y que **rodar la rueda del mouse sobre el grafo scrollea la página en vez de zoomear**.
15. **Modo proyección**: botón "📽️ Proyectar" → todo más grande, sin controles. Salir.
16. **Cierre**: avanzar fases hasta `cierre_y_ranking`. Confirmar ranking por postura con **nombres** (no IDs), "Descargar sesión (.json)", y el **informe imprimible**: pulsar "🖨️ Generar PDF del debate", confirmar que se abre el diálogo de impresión y que la vista previa muestra **solo el informe** (sin botones ni paneles). Cancelar el diálogo.

## 5. Casos borde

- **Posturas nuevas**: con el Programa de 12 posturas filosóficas, **tildar la casilla en la sala de espera antes de que el estudiante escriba** y esperar un segundo a que se republique el Programa. Escribir un argumento que no defienda ninguna postura de la lista. Confirmar que Groq lo detecta, que aparece el botón para proponerla al moderador, que el nombre de la postura sugerida se lee **en texto legible y no como id** (`homo scientificus`, no `homo_scientificus`), que al host le llega la propuesta y que al aceptarla la postura se suma al debate y queda tildada. Repetir con la casilla **desactivada** → debe pedir reescribir, sin opción de proponer.
- **Turno hablado de respaldo**: con la sesión iniciada y **nadie** preparando argumento, esperar poco más de un minuto. Debe ofrecerse un turno en modo verbal a alguien que no haya hablado. Registrarlo y confirmar que el co-moderador puede calificarlo y que el puntaje se acredita.
- **Aristas del grafo**: publicar al menos 3 conexiones y contar `.react-flow__edge` en el DOM del host y de un participante. Debe coincidir con la cantidad de conexiones. Repetir dejando la pestaña del grafo en segundo plano mientras se publican los nodos y volviendo a ella después.
- **Host que refresca** (importante): con el debate andando, varios argumentos publicados y al menos un bid aprobado, anotar el marcador de cada participante y la cantidad de nodos del grafo. Refrescar la pestaña del host (F5) y esperar a que reconstruya. Verificar que **los puntajes son los mismos** (no el doble), que **no aparecieron nodos duplicados**, que la fase sigue siendo la misma (no volvió a la ronda 1) y que las posturas destildadas siguen fuera. Después cerrar una fase y confirmar que avanza a la que sigue, no a la primera.
- **Host que refresca con un turno ofrecido**: refrescar justo mientras hay una oferta de turno en pantalla. La oferta debe expirar sola y la ruleta volver a girar, en vez de quedar colgada.
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

## 6. Formato de reporte

| # | Pantalla | Pasos para reproducir | Esperado | Obtenido | Severidad |
|---|----------|------------------------|----------|----------|-----------|

- Si algo falla por historial de Ably expirado tras varios minutos, anótalo aparte como "esperado por retención de Ably", no en la tabla.
- Si reaparece un bug de la sección 3, márcalo como **REGRESIÓN**, primero en la tabla, severidad alta.
- Si no hay fallos reales, dilo explícitamente. No inventes hallazgos.

## 7. Cierre

Resumen de máximo 4 líneas: fallos por severidad, si hubo regresiones, y si el ciclo completo (ingreso con argumento → preparación → turno → exposición → puntaje → bid → cierre → ranking → informe) se completó de punta a punta o dónde se cortó.
