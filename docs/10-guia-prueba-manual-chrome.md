# Guía de prueba manual — R2 Argumentum (motor real, multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: correr un debate real de punta a punta contra producción y devolver una lista de fallos detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe.

> **Esta guía cubre el rediseño grande de septiembre 2026.** El flujo cambió de raíz: el argumento ahora es requisito para entrar, el turno sirve para defender lo ya escrito (no para escribir contra reloj), y hay capa instruccional, perfiles de puntaje, vista espejo e informe imprimible. Si lo que ves en pantalla se parece más a la versión anterior (fase de "apertura simultánea", turno que abre un formulario en blanco), **el deploy no tomó los cambios**: avisá y no sigas.

## 0. Entorno

- Usar **producción**: `https://r2-argumentum.vercel.app/`.
  - Host: `/host.html` (o la raíz `/` sin parámetros, redirige ahí) — Usuario `arturo.rodriguez@uleam.edu.ec` · Clave `R2ironmaiden`.
  - Participante: `/player.html`, o el link corto `/?sala=XXXX` — es el que generan el QR y el botón "Copiar link".
- **No probar contra local** (`npm run dev`): `ABLY_API_KEY` y `GROQ_API_KEY` son variables "Sensitive" en Vercel, no se pueden recuperar vía CLI. Local no puede ejercitar Groq ni Ably.

## 1. Restricciones operativas — leer antes de empezar

**Ably retiene el historial del canal ~2 minutos.** No es un bug, es la arquitectura ("sin base de datos"):

- **Muévete rápido entre pasos.** Si te tomas varios minutos entre acciones, al refrescar una pestaña el historial ya expiró y la sesión aparece vacía. **Eso NO es un fallo a reportar.** Si pasa con menos de ~90 segundos de por medio, sí es sospechoso.
- Si pierdes una sesión, abre una **nueva** (nuevo código) en vez de pelear por recuperar la vieja.

**Cierra las pestañas de sesiones anteriores.** Cada sesión marca sus eventos con un `identificadorDeSesion` y el historial viejo se descarta al reconstruir el estado, pero ese filtro no alcanza a los eventos **en vivo** de una pestaña de host anterior que siga publicando sobre el mismo código de sala.

## 2. Qué SÍ está implementado

### Configuración (host)

- **Login persistente** (`localStorage`) + catálogo de Programas por categoría o carga de `.json` propio.
- **Solo se restaura automáticamente una sesión ya iniciada.** Si quedó a medio configurar sin iniciar, al recargar vuelve a la lista de Programas.
- **Sala de configuración previa**: código + QR + link corto, participantes conectados, y la configuración de la sesión.
- **Selector de posturas** (si el Programa tiene más de 2): checklist, todas tildadas por defecto, mínimo 2.
- **Modo de calificación** (nuevo): Liviano (10/8/3), Estándar (100/80/30) o Estricto (1000/800/300). Cambia la escala y qué tan caro sale demorarse o rechazar un turno, pero **la proporción entre posiciones se mantiene**.
- **"Permitir posturas nuevas"** (nuevo): casilla, **desactivada por defecto**.

### Ingreso del estudiante — el cambio más grande

El argumento es **requisito para entrar**. El flujo es: nombre + avatar → conecta al canal **sin aparecer en la sala** → elige postura → escribe argumento → lo revisa con Groq → confirma ingreso → **recién ahí aparece en el roster**.

- Con `asignacionPostura: "libre"` el estudiante elige postura; con `"aleatoria"` se le asigna la menos representada, para que los bandos queden parejos.
- Groq hace dos cosas: valida forma (claim + razón) **y clasifica a qué postura pertenece** el argumento.
- Quien no confirma antes de que el host inicie queda como **oyente**: ve todo, no recibe turnos, no puntúa.
- **La fase de apertura simultánea ya no existe** en los Programas de ejemplo: el ingreso la reemplaza.

### Durante el debate

- **El turno es para defender lo ya escrito.** El estudiante prepara su argumento mientras escucha ("Revisar y ponerme en la ruleta"); al aprobarse entra a la ruleta. **Sin argumento preparado no se le ofrece la palabra.**
- **Rechazar el turno cuesta puntos** y el botón muestra el costo antes de confirmar.
- **Turno hablado de respaldo**: si no queda ningún argumento preparado por exponer y alguien no ha hablado nunca, se le ofrece intervenir de viva voz. Vale poco, y un co-moderador la califica después.
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

**Arreglados en esta ronda (los 3 del último reporte):**

1. **Nadie podía puntuar en salas sin co-moderador.** Con exactamente 2 participantes el sorteo asigna 0 co-moderadores (correcto), pero el puntaje base exigía una validación que nadie podía dar, y el marcador quedaba en 0 para siempre. **Probar con 2 participantes exactos**: al publicar un argumento, el puntaje debe aparecer en el marcador del host **sin que nadie valide nada**.
2. **Debates mezclados por reuso del código de sala.** Un participante veía 4 nodos en el grafo y el resto 2, y el rol de co-moderador no aparecía. Confirmar que una sesión nueva arranca con el grafo vacío y el marcador en cero, sin rastros de debates anteriores.
3. **Botón "Copiar link" sin feedback.** Debe cambiar a "✅ Copiado" 2 segundos; si el navegador bloquea el portapapeles, ahora muestra el link en un campo seleccionable en vez de no hacer nada.

**Arreglados en rondas anteriores (13):** historial de Ably (`direction:forwards`), `max_tokens` de Groq, error HTTP vacío, color del nodo "nuevo", **deadlock de turnos**, **bids que nunca se resolvían**, **nodos superpuestos en el grafo**, **nombres reemplazados por IDs** (grafo/ranking/export), Groq exigiendo la palabra literal "porque", dos botones "Cerrar sesión" ambiguos, **nombre perdido al desconectarse**, texto de turno engañoso, y **sorteo que dejaba cero argumentadores**.

Los tres más valiosos de re-verificar: **deadlock de turnos**, **ciclo completo de bids** y **nombres en vez de IDs**.

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
11. **Turno hablado**: cuando nadie tenga argumento preparado y alguien no haya intervenido, confirmar que se le ofrece un turno en **modo verbal** (texto distinto: "intervenir hablando"). Registrarlo y confirmar que aparece en el panel del co-moderador para calificar.
12. **Bid**: mientras alguien tiene el turno, otro lanza un bid. El co-moderador vota, el host da veredicto.
13. **Vista espejo**: en el host, elegir a Ana en "Ver la pantalla de un participante". Confirmar que muestra lo mismo que ella tiene (misma capa instruccional) y que **no** muestra lo que está escribiendo.
14. **Grafo**: con 3+ argumentos conectados, confirmar que las respuestas quedan **debajo** de aquello a lo que responden, que hay leyenda y minimapa, y que **rodar la rueda del mouse sobre el grafo scrollea la página en vez de zoomear**.
15. **Modo proyección**: botón "📽️ Proyectar" → todo más grande, sin controles. Salir.
16. **Cierre**: avanzar fases hasta `cierre_y_ranking`. Confirmar ranking por postura con **nombres** (no IDs), "Descargar sesión (.json)", y el **informe imprimible**: pulsar "🖨️ Generar PDF del debate", confirmar que se abre el diálogo de impresión y que la vista previa muestra **solo el informe** (sin botones ni paneles). Cancelar el diálogo.

## 5. Casos borde

- **Posturas nuevas**: con el Programa de 12 posturas filosóficas y la casilla **activada**, escribir un argumento que no defienda ninguna. Confirmar que Groq lo detecta, que ofrece proponerla al moderador, que al host le llega la propuesta y que al aceptarla la postura se suma al debate. Repetir con la casilla **desactivada** → debe pedir reescribir, sin opción de proponer.
- **Postura distinta a la elegida**: elegir "Más mercado" y escribir un argumento claramente estatista. Confirmar el aviso y la opción de cambiarse de postura. *(Si Groq viene con poca confianza, el sistema aprueba igual — eso es deliberado, no un fallo.)*
- **Deadlock de turnos** (regresión del bug #5): dejar expirar una oferta cuando quede un solo elegible. La ruleta debe volver a ofrecérsela.
- **Perfil Estricto**: iniciar otra sesión con modo Estricto y confirmar que el primer argumento da **1000 puntos** y que rechazar un turno cuesta **300**.
- **Celular vertical**: reducir el viewport de un participante a ~375px. Confirmar que el grafo se reemplaza por la **lista agrupada por postura** y que la capa instruccional queda fija arriba.
- **Celular horizontal**: viewport apaisado y bajo (~700×400). Confirmar el **layout partido**: instrucciones fijas a la izquierda, trabajo a la derecha.
- Refrescar (F5) una pestaña de participante dentro del minuto → debe reconstruir el estado.
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
