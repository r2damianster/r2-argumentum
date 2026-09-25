# Guía de prueba manual — R2 Argumentum (motor real, multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: correr un debate real de punta a punta contra producción y devolver una lista de fallos detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe.

> **Esta guía cubre el rediseño grande de septiembre 2026.** El flujo cambió de raíz: el argumento ahora es requisito para entrar, el turno sirve para defender lo ya escrito (no para escribir contra reloj), y hay capa instruccional, perfiles de puntaje, vista espejo e informe imprimible. Si lo que ves en pantalla se parece más a la versión anterior (turno que abre un formulario en blanco), **el deploy no tomó los cambios**: avisa y no sigas.

## 0. Entorno

- Usar **producción**: `https://r2-argumentum.vercel.app/`.
  - Host: `/host.html` (o la raíz `/` sin parámetros, redirige ahí) — Usuario y clave: los tiene el docente (viven en variables de entorno de Vercel; no se documentan aquí porque el repositorio es público).
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
- **Modo de calificación**: Liviano (10/8/3), Estándar (100/80/30) o Estricto (1000/800/300). Cambia la escala y qué tan caro sale demorarse o rechazar un turno, pero **la proporción entre posiciones se mantiene**.
- **Idioma de los argumentos**: Español (por defecto) o English. Cambia el corrector ortográfico de los campos de texto del participante y el idioma con que Groq valida y comenta el argumento (en inglés reconoce `because`, `since`, `due to`…). **La interfaz —botones, avisos, instrucciones— sigue en español**: no es una traducción. Se republica en vivo con el resto de la configuración de la sala.
- **"Permitir posturas nuevas"**: casilla, **desactivada por defecto**. La configuración se republica en vivo mientras la sala está en espera.

### Ingreso del estudiante y Gestión de Oyentes

El argumento es **requisito para entrar y se confirma en la sala de espera, antes de «Iniciar debate»**: quien no lo confirmó al iniciar queda como oyente de inmediato. El flujo es: nombre + avatar → conecta al canal **sin aparecer en la sala** → elige postura → escribe argumento → lo revisa con Groq → confirma ingreso → **recién ahí aparece en el roster**.

- **Oyentes y Módulo de Contraargumentación**: quien no confirmó su argumento de ingreso cuando el moderador pulsa «Iniciar debate» pasa a **oyente** y ve el aviso:
  > *"⚠️ No pudiste ingresar tu argumento inicial a tiempo. Se agotó el plazo de la primera fase y perdiste la oportunidad de ingresar un argumento principal. Sin embargo, como estás conectado como oyente, tienes la oportunidad de formular un contraargumento para participar."*
  Se le habilita el `FormularioDeContraargumentoParaOyentes`: selecciona un argumento del debate, **elige la postura desde la que contraargumenta**, redacta el contraargumento, pasa validación con Groq (solo se publica el texto exacto que Groq revisó) y lo publica en la sala. Al publicar pasa a ser participante.
- Con `asignacionPostura: "libre"` el estudiante elige postura; con `"aleatoria"` se le asigna la menos representada, para que los bandos queden parejos. La asignación **se recalcula mientras el estudiante no haya escrito nada** y los empates se reparten por el lugar de cada quien en la sala, no al azar.
- Groq hace dos cosas: valida forma (claim + razón) **y clasifica a qué postura pertenece** el argumento.
- Si propone una **postura nueva**, ve la respuesta del moderador en su pantalla: al aceptarla se le asigna esa postura.
- **Filtros previos a Groq**: texto de menos de 5 palabras o con conectores causales sin razón se rechazan al instante.
- **Volver tras cerrar la pestaña**: con el mismo link `/?sala=XXXX` aparece «Ya habías entrado… Continuar como X»; al continuar conserva puntos, rol y argumentos.

### Durante el debate

- **Priorización por posturas en Fase 1** (nuevo): Durante la Ronda 1, el motor selecciona turnos priorizando a participantes pertenecientes a posturas que **aún no hayan intervenido**. Esto asegura la representación de todas las $N$ posturas (ej. 12 posturas) desde el inicio.
- **Visualización completa de argumentos y posturas** (nuevo):
  - En listas desplegables (`<select>` en Conexión Libre y Bids), al seleccionar un argumento se despliega la tarjeta `.vista-previa-argumento-completo` mostrando autor, bando y texto completo sin recortes (`slice(0, 50)`).
  - En `PanelDeCoModerador.jsx`, los argumentos evaluados y las réplicas se despliegan íntegros sin trancar la lectura.
- **Botones de alto contraste semánticos** (nuevo): `.boton-primario` (teal), `.boton-exito` (verde), `.boton-peligro` (rojo) y `.boton-secundario` (borde definido), cumpliendo contraste WCAG 2.1 AA.
- **El argumento puntúa al aprobarse; el turno es para exponerlo.**
- **Rechazar el turno cuesta puntos** y el botón muestra el costo antes de confirmar.
- **Los co-moderadores califican la exposición mientras se habla**: en su panel aparece «Exposiciones por calificar» con botones semánticos.
- **Un argumento preparado con objetivo** (contraargumento, refuerzo, dilema o conexión) **sale conectado**.
- **Capa instruccional**: bloque siempre visible con AHORA / PUEDES / TIENES QUE.
- **Vista espejo**, **Avisos automáticos**, **Modo proyección**, **Argumento destacado** y **Terminar el turno**.

### Cierre y Doble Podio (Orden Diferenciado)

- **Pantalla en vivo (`PantallaDeRanking.jsx`):**
  1. **1º Lugar:** **Podio de Posturas** (comparativa bando vs bando por puntaje total acumulado), mostrando para cada postura tarjetas con sus **argumentos centrales / destacados**.
  2. **2º Lugar:** **Podio Individual de Estudiantes** (ranking por puntaje individual de mayor a menor con medallas 🥇, 🥈, 🥉, incluyendo a estudiantes con 0 puntos).
  3. **3º Lugar:** Desglose detallado agrupado por postura.
- **Informe Exportable en PDF y JSON (`InformeDelDebate.jsx` y `exportarSesion.js`):**
  1. **1º Lugar (al revés):** **Lista Individual de Estudiantes (Por persona)** (tabla completa ordenada por puntaje individual, incluyendo a todos los participantes registrados aunque tengan 0 puntos).
  2. **2º Lugar:** **Lista Colaborativa por Postura (Por bando)** (postura vs postura con desgloses de equipo).
- **Descarga de PDF y JSON**: durante todo el debate o al cierre, con botones estilizados de alto contraste. Desde el ranking, parcial o final, se descarga el PDF e informe JSON.

## 3. Bugs ya arreglados — verificar que NO reaparezcan

Si alguno reaparece es una **regresión real**, va primero en la tabla, severidad alta.

**Arreglados en la ronda del 20 de septiembre de 2026, salas 1902 y 2151 (6 hallazgos de la ronda D1-D4):**

E1. **Regresión D3. Nodos cortados en el host y ⛶ sin reencuadrar** (media): `fitView` se ejecutaba antes de que React Flow midiera los nodos. Se corrigió con dos temporizadores escalonados (`duration: 0` inicial + `duration: 200` de ajuste suave) con limpieza explícita.
E2. **Posturas desparejas (1/1/3 en sala 2151 con 5 participantes)** (media): `elegirPosturaMenosRepresentada` sólo contaba confirmados y hacía colapsar a todos los no confirmados en la postura con conteo 0. Se refactorizó para simular una asignación virtual determinista entre los participantes no confirmados presentes en la sala (`participantesEnLaSala`).
E3. **Dilema válido rechazado por Groq ("No contiene afirmación ni razón")** (baja-media): el prompt exigía claim + razón causal. Se incluyó en el prompt de Groq la validación explícita para estructuras de dilemas (dos consecuencias/efectos en tensión).
E4. **Oferta verbal transitoria ("No queda ningún argumento")** (baja): carrera entre la oferta verbal y la llegada de `ARGUMENTO_PUBLICADO` al host. `PantallaDeTurnoOfrecido` retiene 1.5s las ofertas verbales transitorias mientras hay un argumento recién publicado pendiente de exposición.
E5. **Minimapa con rectángulos blancos** (baja): rectángulos sin color visible. Se asigna `nodeColor={(n) => n.data?.color}` directamente.
E6. **Aristas con tramos sobrantes** (baja): overshoot de curvas Bézier. Se configuró `type: 'smoothstep'` para trazar rutas ortogonales limpias.

**Arreglados en la ronda del 19 de septiembre de 2026, sala 6274 (3 fallos, más el flujo nuevo de exposiciones; verificar que aguantan):**

D1. **El modo de calificación volvía a Liviano** (alta). Con Estándar elegido, el log mostraba `programa.publicado` con `estandar` y ~66 s después otro con `liviano`, y el inicio publicó `liviano` de nuevo: el ingreso daba 10 puntos y el botón decía «Rechazar cuesta 2 puntos». La causa exacta del reinicio no se reprodujo; se eliminó el mecanismo que podía pisar el canal (ahora la configuración se publica solo desde los controles) y cada publicación lleva `origen`. **Cómo verificar**: elegir Estándar, entrar 3 personas, esperar más de 90 s, iniciar. En el log de eventos, **todos** los `programa.publicado` deben decir `estandar`; el ingreso da **100** y rechazar cuesta **20**. Si aparece uno con `liviano`, anota su campo `origen` y el instante: dice quién lo publicó. *(Si sigue pasando, es el hallazgo más valioso de la ronda.)*
D2. **Falso «zoom en 14 %»** (media): una pestaña con `outerWidth` 160 y `outerHeight` 28 ampliaba la interfaz ×4 con el zoom real en 100 %. **Cómo verificar**: con el zoom en 100 % no debe aparecer la barra de zoom ni ampliarse nada, aunque el navegador esté en una ventana minimizada o controlada por automatización. Con el zoom real bajado a 50 % (Ctrl −) **sí** debe aparecer y ampliar.
D3. **Nodo cortado con 3 nodos y ⛶ sin efecto** (media-baja). Probable consecuencia de D2. **Cómo verificar**: publicar el contraargumento de Ana y medir: ningún nodo fuera del borde del mapa, y ⛶ deja el mismo encuadre que la carga. Redimensiona la ventana con el mapa abierto: debe reencuadrarse solo. *(Nunca se comprobó en navegador: si sigue cortado con zoom en 100 %, anótalo con el ancho del contenedor.)*
D4. **Evaluación de exposiciones** (flujo nuevo). **Cómo verificar** con 1 host, 4+ participantes (2 co-moderadores): (a) el argumento aprobado aparece en el mapa y puntúa antes de que le den la palabra; (b) mientras alguien expone, cada co-moderador ve la exposición en curso con el argumento y el punto al que responde, califica, y **no puede calificar la suya**; (c) el host ve cuántos calificaron y el promedio, **nunca quién**; (d) el host evalúa una, descarta otra y deja otra sin evaluar; (e) el marcador **no cambia** durante el debate; (f) al cerrar (fase de cierre o «Cerrar el debate ahora»), el expositor de la evaluada «buena» gana el doble de lo que valía su argumento, el de la descartada no cambia, y los co-moderadores que coincidieron con el host (o entre ellos) cobran bono; (g) el PDF y el JSON traen la sección de exposiciones. Con 2 participantes (0 co-moderadores) el host puede evaluar solo y el ajuste se aplica igual.

**Arreglados en la última ronda (reporte de la prueba con 8 participantes, 11 puntos):**

A1. **Argumento preparado que apuntaba a otro quedaba suelto en el grafo** (severidad media-alta). Contraargumentos, refuerzos y dilemas publicados al exponer el turno salían sin arista: 13 nodos y solo 3 aristas. **Cómo verificar**: preparar un contraargumento, un refuerzo y un dilema eligiendo "Argumento al que apunta", ganar el turno y publicar cada uno; contar `.react-flow__edge` — debe haber una arista por cada uno, y cada nodo debe quedar **debajo** del que responde, no en la fila raíz.
A2. **"El validador no respondió, inténtalo de nuevo"** con varias revisiones a la vez. La función reintenta y el tope de tokens subió. **Cómo verificar**: que 5–7 participantes pulsen "Revisar" casi a la vez; no debería aparecer ese mensaje (si aparece una vez y al reintentar funciona, anótalo como media y di cuántos revisaban a la vez).
A3. **Postura Matizada rechazada** ("Groq lo clasifica como Más mercado"). **Cómo verificar**: con el Programa de política y asignación que le dé la postura Matizada a alguien, escribir un argumento que critique el libre mercado; debe aprobarse. Para cualquier otra postura la contradicción sigue vigente.
A4. **Formularios sin mensaje**: "Revisar y publicar en el mapa" sin objetivo o sin texto, y "Lanzar bid" con objetivo o texto vacíos. **Cómo verificar**: pulsar con cada campo vacío; debe aparecer un aviso rojo que diga qué falta.
A5. **Postura nueva aceptada sin aviso**: al aceptarla el host, la pantalla del estudiante seguía en "Espera su respuesta". **Cómo verificar**: caso borde de posturas nuevas (sección 5), mirando la pantalla del estudiante.
A6. **Vista espejo con "Turnos rechazados: 0"** tras haber rechazado. **Cómo verificar**: que alguien rechace un turno y luego acepte otro; la vista espejo debe decir "Turnos rechazados: 1".
A7. **Avisos operativos en Cierre y ranking** ("6 sin argumento preparado", "5 casos esperando revisión"). **Cómo verificar**: avanzar a `cierre_y_ranking` con casos pendientes; el panel de avisos no debe mostrar nada.
A8. **El objetivo de un contraargumento incluía el argumento propio.** **Cómo verificar**: abrir "Argumento al que apunta" con argumentos propios ya publicados; no deben aparecer.
A9. **F5 del host con el debate cerrado** volvía a la sala de configuración con el mismo código. **Cómo verificar**: cerrar el debate y refrescar el host: debe reconstruir el informe cerrado desde la copia local (**ya no** vuelve a la lista de Programas: cambió a propósito) y nunca reabrir una sala de configuración con el código viejo. Para salir, «➕ Iniciar un debate nuevo».

**Arreglados en la ronda del reporte manual del 19 de septiembre de 2026 (10 hallazgos, sin regresiones; verificar que aguantan):**

C1. **Un oyente sin ingreso confirmado salía sorteado como co-moderador** (media). **Cómo verificar**: 3 personas conectadas, solo 2 confirman su ingreso; al iniciar la sesión debe haber **0** co-moderadores y la tercera **no** debe verse como co-moderadora en la lista del host. Repite con 5 conectadas y 4 confirmadas: 1 co-moderador, nunca el que no confirmó.
C2. **El aviso de similitud comparaba contra el argumento propio y saltaba con 3 palabras** (baja-media). **Cómo verificar**: escribir «mercado libre precios» (o cualquier frase de menos de 5 palabras con contenido) que aparece dentro de un argumento largo: no debe saltar el aviso de similitud. Con un argumento propio ya publicado, escribir algo parecido a él: no debe avisar. Con «Usarlo como refuerzo» sobre el de otra persona: tipo y destino se rellenan y el aviso no vuelve.
C3. **Mapa cortado y aristas «(sugerido)» repetidas** (baja-media). **Cómo verificar**: en Conexión libre con 3 nodos apilados, el último nodo se ve completo y ⛶ lo deja igual; tras **dos** tandas de sugerencias de Groq no hay dos aristas punteadas entre los mismos dos nodos. *(El encuadre nunca se comprobó en navegador: si sigue cortado, es el hallazgo más valioso de esta ronda.)*
C4. **Turno hablado: no es un fallo que Estricto dé 6× y no 10× que Estándar** (30 vs 180 con calificación «buena»). Por diseño: descuentos de vía más duros. Solo anótalo si la proporción no es esa.
C5. **Tras «Cerrar el debate ahora» seguían «Fase activa… Cerrar fase actual» y «Marcador en vivo»** (baja). **Cómo verificar**: cerrar el debate; ambos bloques desaparecen y la pantalla baja sola al ranking final. Un F5 con el debate ya cerrado reconstruye el informe **sin** desplazarse solo.
C6. **Dos botones de PDF** (baja). **Cómo verificar**: con el ranking abierto (parcial o final) hay **un solo** botón «📄 Descargar informe (PDF)». «Informe parcial» en el encabezado antes de cerrar es correcto.
C7. **Aviso «la ruleta no puede ofrecerles la palabra» en Conexión libre** (baja). **Cómo verificar**: pasar a Conexión libre con alguien sin argumento preparado; ese aviso no debe aparecer.
C8. **El selector de destino de la conexión libre ofrecía el argumento propio** (baja). **Cómo verificar**: abrir «Se conecta con» con argumentos propios publicados; no deben aparecer.
C9. **Celular: botones de ~22 px y capa instruccional que tapaba el campo** (baja, UX). **Cómo verificar** (F12 modo dispositivo, sección 5B): botones y selects de al menos 44 px de alto; en horizontal (~700×400) la capa desplegada tiene scroll interno y no supera la pantalla; al tocar el textarea la capa se pliega a una línea y no lo tapa.

**Arreglados en la ronda del reporte de 7 actores (verificar que la corrección aguanta):**

B1. **Nombre reemplazado por ID tras cerrar una pestaña y refrescar el host** (alta). Un participante con puntaje cerraba su pestaña, entraba otro con el mismo nombre, el host refrescaba, y el original desaparecía del marcador y salía como `participante-…` en el mapa y el informe. **Cómo verificar**: ver la variante «Mateo» del elenco de actores (sección 4B). El original debe seguir con nombre, emoji, puntos y marca «Sin conexión».
B2. **«Este texto no debería presentarse porque ....» pasaba como argumento.** Ahora un filtro previo a Groq lo rechaza al instante («Después de «porque» no explicas la razón»), igual que los textos de menos de 5 palabras. **Cómo verificar**: mandarlo en el ingreso y en «Prepara tu próximo argumento»; no debe aparecer nunca en el mapa ni en el feed.
B3. **Turno bloqueado si quien hablaba cerraba la pestaña.** La ruleta no avanzaba nunca. **Cómo verificar**: variante «cierra teniendo la palabra» del elenco.
B4. **Argumento «listo» sin texto tras cerrar la pestaña.** Ahora el argumento aprobado vive en el canal (se publica al aprobarse), no en el dispositivo, así que ya no puede perderse. **Cómo verificar**: variante «cierra con el argumento ya aprobado» del elenco.

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
4. **Host**: "Iniciar sesión". Confirmar 0 co-moderadores con 2 confirmados, o 1 si Marta alcanzó a **confirmar** su ingreso. **Marta a medias nunca debe salir co-moderadora** (ver C1).
5. **Marta**: confirmar que ahora ve el cartel de **oyente** y que no recibe turnos.
6. **Verificar el puntaje sin co-moderador**: el argumento de ingreso de Ana debe haberle dado **100 puntos** en el marcador del host, sin que nadie valide nada. *(Este es el bug #1 — si el marcador está en 0, es regresión alta.)*
7. **Capa instruccional**: en la pestaña de Ana, confirmar que el bloque de arriba dice qué está pasando y que en **TIENES QUE** aparece "Prepara un argumento para entrar a la ruleta". Scrollear y confirmar que se colapsa a una línea con ese aviso.
8. **Preparar argumento**: Ana escribe su segundo argumento y pulsa "Revisar y publicar en el mapa". Confirmar que al aprobarse **el nodo aparece de inmediato en el mapa** (con su arista si respondía a otro), que **el marcador sube** (80 de posición 2 en Estándar) y que su pantalla dice "ya está en el mapa y suma puntos". **Recién entonces** la ruleta le ofrece la palabra.
9. **Turno**: confirmar que la pantalla de turno ofrecido **muestra el costo de rechazar** ("Rechazar (−20 pts)") y que al aceptar **no aparece un formulario en blanco**, sino su argumento ya publicado con el botón "Ya lo expuse". Mientras habla, el **co-moderador** (si lo hay) ve «🎙️ está hablando ahora» y puede calificar; el host ve la exposición en «Evaluación de exposiciones» y puede evaluarla. Al pulsar «Ya lo expuse» el turno se libera y **no se duplica el nodo** en el mapa.
10. **Rechazo con penalidad**: en el siguiente turno ofrecido, rechazar. Confirmar que el marcador baja 20 puntos **y que el argumento sigue en el mapa**. Después de la calificación, confirmar que **el marcador no cambia todavía** (los ajustes se aplican al cerrar).
11. **Turno hablado**: cuando nadie tenga argumento preparado y alguien no haya intervenido, confirmar que se le ofrece un turno en **modo verbal** (texto distinto: "intervenir hablando"). Registrarlo y confirmar que aparece en el panel del co-moderador para calificar. Dos aclaraciones: el argumento de ingreso **no** cuenta como haber tomado la palabra, y el primer turno hablado no se ofrece hasta pasado un minuto del inicio de la fase.
12. **Bid**: mientras alguien tiene el turno, otro lanza un bid. El co-moderador vota, el host da veredicto.
13. **Vista espejo**: en el host, elegir a Ana en "Ver la pantalla de un participante". Confirmar que muestra lo mismo que ella tiene (misma capa instruccional), que **no** muestra lo que está escribiendo y que "Turnos rechazados" cuenta los rechazos que hizo aunque después haya aceptado otro turno.
14. **Grafo**: con 3+ argumentos conectados, confirmar que las respuestas quedan **debajo** de aquello a lo que responden, que hay leyenda y minimapa, y que **rodar la rueda del mouse sobre el grafo scrollea la página en vez de zoomear**.
15. **Proyección**: (a) «📽️ Proyectar aquí» → todo más grande, sin controles; salir. (b) «🪟 Proyectar en otra ventana» → se abre una ventana que muestra el debate en vivo; publica un argumento y compruébalo en las dos (consola y ventana). Si el navegador bloquea la ventana emergente debe aparecer un aviso rojo en la consola. **Mapa**: con 1–3 argumentos la caja es baja (~240 px) y crece al agregar más, hasta su tope.
16. **Argumento destacado**: cuando alguien recibe la palabra, su texto aparece en grande ~12 s en el host, en la ventana de proyección y en los demás celulares (**no** en el de quien habla). Se cierra con un toque. Recargar la página a mitad de turno no lo hace reaparecer. Después queda en tamaño normal bajo «X está hablando ahora».
17. **Ranking parcial y cierre anticipado** (sin esperar a `cierre_y_ranking`): «📊 Ver ranking parcial» baja hasta «Ranking parcial (el debate sigue en curso)» y **no** detiene nada. Descarga el **PDF** (diálogo de impresión, vista previa solo con el informe, encabezado «Informe parcial», nombre de archivo «Informe R2 Argumentum - …») y el **JSON** (`estadoDeLaSesion: "parcial"`). Luego «⏹️ Cerrar el debate ahora»: la confirmación debe decir cuántos no han hablado; al aceptar, ranking final en el host (los controles de fase y el marcador en vivo desaparecen y la pantalla baja sola hasta el ranking), pantalla de resultado en los celulares y la ruleta detenida. Debe haber **un solo** botón de PDF.
18. **Cierre normal** (en una sesión aparte, avanzando fases hasta `cierre_y_ranking`): panel de avisos vacío, ranking con **nombres** (no IDs), PDF y JSON. Cancelar el diálogo de impresión.
19. **Debate nuevo**: en el ranking final, «➕ Iniciar un debate nuevo» → confirmación → lista de Programas, **sin pedir login**.

## 4B. Elenco de actores — la prueba que de verdad importa

Una prueba con participantes idénticos no encuentra los fallos del aula. Corre el escenario con **al menos 8 pestañas** y reparte estos comportamientos; cada actor hace siempre lo mismo. Anota qué pasó con cada uno.

| Actor | Qué hace | Qué debe pasar |
|---|---|---|
| **Hablador** (Ana) | Apenas termina un turno prepara otro argumento, lanza bids, conecta todo lo que puede. | No debe monopolizar la ruleta: cuenta cuántos turnos tuvo cada quien; si Ana tiene más del doble del promedio, anótalo. Su puntaje debe frenarse al pasar el límite de posiciones del perfil (no crece sin techo). |
| **Callada** (Silvia) | Entra con su argumento de ingreso y no vuelve a escribir nada. | El panel de avisos la señala («no tienen ningún argumento preparado»; pasados ~6 min, aviso rojo «no han tomado la palabra»). Debe recibir el turno hablado de respaldo. El debate no debe cerrarse solo sin que hable. |
| **Participación mínima** (Luis, Diego) | Ingreso + una sola intervención. | Marcador coherente; los avisos dejan de nombrarlos apenas intervienen. |
| **Co-moderador experto** | Valida rápido, vota los bids, califica las intervenciones habladas y las exposiciones en curso. | Bonos repartidos; su cola nunca incluye lo propio. |
| **Co-moderador perdido** (Carla) | Valida la mitad de su cola, no vota bids, ignora las intervenciones habladas. | Aviso «casos esperando revisión de los co-moderadores» con su nombre. Los bids sin votos expiran o el host los resuelve a mano. El puntaje base no depende de ella y **el debate nunca queda bloqueado**. Su pantalla debe explicarle qué puede hacer (capa instruccional): anota si se pierde. |
| **El de los rechazos** (Pedro) | En el ingreso manda, en este orden: una afirmación sin razón; «Este texto no debería presentarse porque ....»; tres palabras sueltas; un argumento de otra postura; y por fin uno bueno. | Los tres primeros se rechazan con motivo claro (los dos últimos de forma inmediata, sin llamar a Groq); el cuarto avisa de postura distinta; el quinto entra. **Ninguno de los rechazados aparece en el mapa ni en el feed.** |
| **El copión** | Escribe algo casi igual a un argumento ya publicado, cambiando dos o tres palabras. | Aviso «se parece mucho al de X». En «Prepara tu próximo argumento» aparece «Usarlo como refuerzo de ese argumento»; al aplicarlo ya no vuelve a saltar el aviso. |
| **El apurado** | Escribe todo en minúsculas y sin tildes («la educacion publica reduce la desigualdad porque…»). | **No debe rechazarse** (la ortografía no bloquea). Con el corrector en español del navegador activo, las palabras con falta salen subrayadas (con el debate en **English**, el corrector usa inglés). Anota cómo se ve ese argumento en el mapa: es el caso que motiva la decisión abierta sobre ayuda de redacción con IA. |
| **El de la pestaña cerrada** (Mateo) | Ver las variantes de abajo. | Ver abajo. |

**Variantes de «se le cierra la pestaña»** (usa una persona distinta para cada una, o repítelas en orden). En todas, vuelve a entrar por el mismo link `/?sala=XXXX`:

- **a) En pleno ingreso**, sin confirmar: al volver debe aparecer «Ya habías entrado a la sala…» con un botón «Continuar como X» por cada identidad de esa sala en este navegador; elige la de la persona que se cerró.
- **b) Con el argumento ya aprobado y esperando turno**: al continuar debe ver «Tu argumento ya está en el mapa y suma puntos» **con su texto** y los mismos puntos.
- **c) Teniendo la palabra**: el host ve el aviso rojo «X tiene la palabra pero está sin conexión»; pulsa «⏭️ Terminar el turno de X» y la ruleta sigue con otra persona. Si X vuelve antes, puede continuar y terminar de exponer.
- **d) Siendo co-moderador**: al volver conserva su rol y su cola.
- **e) Entra como otra persona con el mismo nombre** (elige no continuar): queda como participante nuevo (oyente si el debate ya empezó). **Refresca el host (F5) y comprueba lo más importante**: el Mateo original sigue en el marcador con nombre, emoji, puntos y la marca «Sin conexión»; sus argumentos y su fila del informe muestran su nombre y **nunca** un ID `participante-…`. El Mateo nuevo aparece aparte, sin confirmar.
- **f) Otro navegador o dispositivo**: no hay forma de recuperar la identidad (no hay login de estudiantes) — es lo esperado, anótalo como informativo, no como fallo.

**Host, durante ese debate:** proyecta en otra ventana mientras pasa todo esto; en algún momento pide el ranking parcial, baja el PDF y el JSON, y cierra el debate con gente que aún no ha hablado.

## 5. Casos borde

- **Posturas nuevas**: con el Programa de 12 posturas filosóficas, **tildar la casilla en la sala de espera antes de que el estudiante escriba** y esperar un segundo a que se republique el Programa. Escribir un argumento que no defienda ninguna postura de la lista. Confirmar que Groq lo detecta, que aparece el botón para proponerla al moderador, que el nombre de la postura sugerida se lee **en texto legible y no como id** (`homo scientificus`, no `homo_scientificus`), que al host le llega la propuesta y que al aceptarla la postura se suma al debate y queda tildada. **En la pantalla del estudiante**, al aceptarla debe aparecer un aviso de aceptación, la postura nueva debe quedar asignada y debe poder confirmar su ingreso; al rechazarla, debe pedirle reescribir. Repetir con la casilla **desactivada** → debe pedir reescribir, sin opción de proponer.
- **Arista de un argumento preparado**: con 3 participantes, cada uno prepara un tipo distinto con objetivo (contraargumento, refuerzo, dilema) apuntando a un argumento **ajeno**, y lo publica al ganar el turno. Contar `.react-flow__edge` en host y participante: una por cada uno. Confirmar que ninguna lista de objetivos ofrece el argumento propio.
- **Ráfaga de revisiones con Groq**: 5–7 participantes pulsan "Revisar" casi a la vez (en el ingreso o preparando argumento). No debe aparecer "El validador no respondió". Repetir el mismo texto dos veces: mismo veredicto.
- **Postura Matizada**: entrar con la postura Matizada (Programa de política o de libre albedrío) y escribir un argumento que critique un polo; debe aprobarse sin pedir cambiar de postura.
- **Formularios incompletos**: en "Prepara tu próximo argumento" pulsar "Revisar y publicar en el mapa" con objetivo vacío (tipo contraargumento) y con el texto vacío; en el panel de bid pulsar "Lanzar bid" con objetivo vacío y con texto vacío. Cada caso debe mostrar un aviso que diga qué falta.
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
- **Debate en inglés**: en la sala de espera elegir **English** en «Idioma de los argumentos» y esperar un segundo a que se republique. Entrar como participante: los botones y avisos siguen en español, el `<main>` de la pantalla tiene `lang="en"` (F12 → Elements) y el corrector subraya según el diccionario inglés (si Chrome lo tiene habilitado: Configuración → Idiomas). Escribir «Free markets lower prices because firms must compete for customers.»: debe aprobarse, y la respuesta de Groq (motivo o sugerencia) llega en inglés. Escribir «This rule is unfair because ....»: se rechaza al instante con «Después de «because» no explicas la razón» (filtro previo, sin Groq). Un debate sin idioma elegido se juega en español.
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

## 6B. Prueba automatizada en navegador (Playwright) — 24 de septiembre de 2026

`scripts/prueba-e2e/` contiene scripts de Python + Playwright que manejan producción con 1 host visible y participantes headless (ver el `README.md` de esa carpeta). Resultado de la corrida completa del 24-sep-2026 (sala 9263). El semáforo de apertura que se verificó entonces fue **retirado** ese mismo día (ver `06-pendientes.md`); `scripts/prueba-e2e/` se adaptó:

| Qué se probó | Resultado |
|---|---|
| Cortacircuitos de la ruleta | ✅ tras rechazos consecutivos la ruleta se pausa, el host recibe la alerta y «Reanudar ruleta» la quita |
| Formulario de oyentes con el cambio nuevo | ✅ pide postura; Groq aprueba; editar el texto retira «Publicar»; revisar de nuevo lo devuelve; publicar saca a la persona del modo oyente |
| Doble podio | ✅ ranking en vivo: 1) Posturas, 2) Individual, 3) Desglose; informe: 1) Lista individual, 2) Lista por postura |
| Ranking incluye a los 4 (oyente con 0 puntos incluido) | ✅ |

Reparto de posturas (`bandos.py`): 3 salas × 6 participantes en paralelo → 2/2/2 en las tres.

**Flujo central (`e2e_flujo.py`, 24 PASS / 0 FAIL, sala 2569, 8 participantes con 1 en móvil emulado):**

| Qué se probó | Resultado |
|---|---|
| Ingreso de 8 con confirmación secuencial; reparto de posturas | ✅ 3 / 3 / 2 |
| Sorteo de co-moderador al iniciar | ✅ |
| Aceptar turno → exponer → «Ya lo expuse» (3 turnos) | ✅ |
| Co-moderador califica la exposición («Coherente con el punto») | ✅ 3 calificaciones |
| Bid de «Fortalecer» durante un turno ajeno; voto del co-moderador; veredicto del moderador («Aprobar») | ✅ el argumento del bid entra al mapa |
| Conexión libre entre argumentos | ✅ |
| Preparar un contraargumento tras exponer (Groq lo aprueba, sale con arista) | ✅ |
| F5 del host en pleno debate | ✅ reconstruye sesión y mapa; no vuelve al login |
| Cierre de fases (dispara Groq de sugerencias) | ✅ sin errores (Groq no sugirió conexiones en esa corrida) |
| Ranking final con los 8, puntajes, informe exportable | ✅; al cerrar cambia el total (ajustes de exposiciones) |
| Móvil emulado (iPhone 13 y 700×400 horizontal) | ✅ sin desbordamiento; botones ≥ 40 px |
| Errores de JavaScript en cualquier pantalla | ✅ ninguno |

**Advertencias de la prueba:** (1) con confirmaciones **casi simultáneas** el reparto llegó a salir 1/3/4 con 8 participantes; se corrigió con un cupo por postura al confirmar (solo asignación aleatoria) y `confirmaciones_simultaneas.py` lo verifica (8 a la vez → 3/2/3). (2) Una ventana de Chrome con `viewport` fijo puede disparar el falso aviso «zoom en 30 %» (`outerWidth/innerWidth`): en `e2e_flujo.py` el host usa `no_viewport`. (3) No se pudo verificar que Groq sugiera conexiones: depende del contenido.

`volver_config.py` (sala de espera → «Volver a configuración»): se descubrió que **abre una sala con otro código** y que quienes ya habían entrado quedaban varados sin aviso; ahora el host recibe una confirmación antes (ver `06-pendientes.md`).

**Móviles emulados (`moviles.py`, 8 modelos):** iPhone SE 320×568, iPhone 13, 13 Pro Max, Pixel 7, Galaxy S9+ 320×658, Galaxy S8 360×740, Moto G4 y iPad Mini; toques reales (`tap`), teclado virtual emulado (área visible al 55 %) y giro a horizontal. Se mide en 12 pantallas del flujo (entrada, ingreso con argumento, aprobado, sala de espera, debate, oferta de turno, exposición, co-moderador, preparar argumento, oyente, horizontal, cierre).

| Qué se midió | Resultado |
|---|---|
| Desbordamiento horizontal | ✅ ninguno (tras el arreglo) |
| Controles táctiles < 44 px | ✅ ninguno (el «✕» del aviso medía 31 px; corregido) |
| Campo de texto tapado con el teclado abierto | ✅ ninguno |
| Capa instruccional fija > 40 % del alto | ✅ ninguna |
| Errores de JavaScript | ✅ ninguno |
| Texto < 13 px | ⚠️ etiquetas de postura y pasos del ingreso (12–12,8 px); tolerable |

**Podio final y créditos (25-sep-2026).** Al cerrar el debate, en el celular de cada participante: (1) aparece «🥁 Y ahora… ¡el podio!» con tres puntos que laten; (2) tras ~3 s se descubre el podio **por postura** de atrás hacia adelante (los puestos ocultos son «?»), y luego el **individual**: 3.º, 2.º y, tras una pausa más larga, el 1.º con confeti; (3) al terminar aparecen «Tu resultado», la tabla completa (si hay más de 3), «Ver la revelación otra vez» y los **créditos** con tu foto, el ORCID (el enlace abre orcid.org) y «Claude y Antigravity»; (4) «Saltar la animación» lo muestra todo de golpe; con «reducir movimiento» no hay esperas. Los créditos también aparecen en la pantalla de ingreso, y **no** durante el debate. Anota como fallo: podio antes de que el moderador cierre, nombres cortados o desbordes a 320 px, créditos durante el debate, foto que no carga.

**Acciones del turno con énfasis (24-sep-2026).** Verifica a mano, en un celular: cuando te ofrecen el turno aparece una **barra verde fija abajo** con «Aceptar y defender mi argumento» (verde sólido, grande) y «Rechazar» (rojo con borde); haz scroll arriba y abajo: la barra **no se mueve**; la cuenta atrás se pone roja a los 5 s; el celular vibra y la pestaña cambia de título. Al aceptar, la barra pasa a «Estás exponiendo» con «Ya lo expuse». Con «reducir movimiento» del sistema, sin animaciones. Anota como fallo grave que cualquiera de esos botones se vea gris, quede tapado o desaparezca al hacer scroll.

**Fallo real encontrado por esta prueba:** el panel de co-moderador se desbordaba en pantallas de 320–360 px (documento de 381 px en 360 px; botones «Coherente con el punto» y «No está hablando» fuera de pantalla). Corregido con `flex-wrap` en `.botonera-de-bid`; comprobado con el CSS compilado: antes 381 px, ahora 360 px exactos.

No cubierto por los scripts: **celular físico** (teclado virtual real, notch, rendimiento, gestos) y la evaluación del moderador sobre exposiciones («Descartar calificaciones»).

## 7. Pendiente de verificar

**Cambios de esta ronda que nunca se probaron en un navegador** (solo hay pruebas automatizadas de la lógica pura). Prioriza estos:

- **Ventana de proyección** («🪟 Proyectar en otra ventana»): que se abra, que se actualice sola con cada argumento y turno, que muestre el argumento destacado, y que muestre «Esperando a la consola del host…» si se abre la URL con una sala sin consola.
- **Filtro `api/_revisarFormaMinima.js` en producción**: Vercel debe empaquetarlo con la función `groq-validar-argumento`. Si el despliegue o la primera revisión fallan con un error de import, ese es el sitio. Verifica también que **no** se exponga como endpoint (`/api/_revisarFormaMinima` debe dar 404).
- **Corrector ortográfico** del navegador: depende de que el diccionario del idioma del debate esté activo en Chrome (Configuración → Idiomas); anota si no subraya nada. En la ronda del 19 de septiembre pareció estar en inglés: ahora el idioma del debate se elige en la sala y el `lang` lo hereda todo el formulario.
- **Sin verificar en la ronda del 19 de septiembre** (retómalos): refuerzo (A1) de punta a punta, ráfaga simultánea real a Groq, F5 del host con un turno ofrecido en curso, variantes c y d de pestaña cerrada, desconexión larga (Network Offline), auto-ampliación con zoom bajo, y celular físico con QR.
- **Cambios de C1–C9 y del idioma nunca vistos en navegador**: encuadre del mapa con pocos nodos, pliegue de la capa instruccional al enfocar un campo, tamaño táctil de los botones, y el selector de idioma en la sala de espera.
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
