# Roles y flujo de turnos

## Los 3 roles

| Rol | Quién | Qué hace |
|---|---|---|
| **Moderador** | El profesor | Crea el Programa, controla el avance de fases, proyecta el grafo en vivo, puede delegar y supervisar co-moderadores |
| **Co-moderador** | Sorteado al azar entre los participantes (ver fórmula abajo) | Valora, anota, resuelve casos escalados por Groq, marca faltas, valida tipos de relación, califica las exposiciones orales |
| **Participante** | El resto de estudiantes | Recibe turnos, escribe argumentos, conecta argumentos libremente |

### Selección de co-moderadores

```
n_co_moderadores = max(1, ceil(n_participantes * 0.10))
```

El profesor puede fijar un tope máximo para grupos grandes. Los co-moderadores se sorprenden al azar entre los inscritos (mismo mecanismo de presence de Ably usado para la ruleta de turnos) y, por defecto, no participan también como argumentadores en la misma sesión (evita conflicto de interés al validar sus propios argumentos).

## Flujo de turno — exponer un argumento ya publicado

**El argumento se publica y puntúa apenas Groq lo aprueba; el turno sirve para exponerlo en voz alta, no para escribirlo contra reloj.** Tanto el argumento redactado obligatoriamente al confirmar el ingreso (`IngresoConArgumento.jsx`) como los preparados durante el debate se publican marcados con `pendienteDeExposicion: true`. Por ello, desde el primer instante en que se inicia la sesión de debate, todos los participantes inscritos están habilitados en la ruleta de turnos aleatorios para exponer su argumento inicial en voz alta. Mientras esperan, reciben un aviso visual en pantalla (**«⚡ ¡PREPÁRATE PARA HABLAR!»**) alertándoles que en cualquier momento pueden recibir la palabra.

### Temporizador de apertura y semáforo visual

Durante el **ingreso obligatorio con argumento**, el moderador puede definir el tiempo límite de redacción inicial (`tiempoAperturaMinutos`: 2, 3 [por defecto], 4 o 5 minutos). En la pantalla del participante (`IngresoConArgumento.jsx`), se muestra un banner semáforo animado:
- **Verde:** Más del 50% del tiempo restante.
- **Amarillo (Alerta):** Entre el 20% y el 50% del tiempo.
- **Rojo (Crítico):** Menos del 20% restante.

Si el tiempo concluye antes de que el participante apruebe y confirme su argumento inicial, su estado pasa automáticamente a **oyente**.

### Priorización de posturas en la primera fase (Ronda 1)

Para garantizar la pluralidad del debate desde el inicio, el algoritmo de la ruleta de turnos (`priorizarPosturasSinExponer` en `motorDeSesion.js`) aplica una regla de **cobertura por postura en Ronda 1**:
1. Antes de ofrecer un segundo turno a una postura ya expuesta, el sistema prioriza a aquellos participantes con argumentos preparados en posturas que **aún no han tenido ninguna exposición oral** en la sala.
2. Una vez que todas las posturas representadas han expuesto al menos un argumento en voz alta, la ruleta retoma su ponderación habitual (prioridad a no participantes y menor tiempo de palabra).

### Módulo de contraargumentación para oyentes

Quienes no logran ingresar su argumento inicial a tiempo ingresan a la sesión con rol de **oyente**. Para no excluir su pensamiento crítico ni aprendizaje:
- El sistema muestra un mensaje punitivo pero motivador: *"No pudiste ingresar tu argumento a tiempo por falta de tiempo, pero como ya estás adentro como oyente, ¡puedes plantear un contraargumento ahora!"*.
- Se habilita el `FormularioDeContraargumentoParaOyentes.jsx` en la aplicación del estudiante (`App.jsx`), permitiéndoles seleccionar cualquier argumento publicado en el mapa y redactar un contraargumento directo (`oyente.contraargumento_enviado`).

### Visualización completa de argumentos en interfaces desplegables

Para evitar que los argumentos largos queden recortados o descontextualizados en listas desplegables o paneles compactos:
- En las interfaces de **Conexión Libre** (`PanelDeConexionLibre.jsx`), **Bids** (`PanelDeBid.jsx`) y la vista de **Co-moderador** (`PanelDeCoModerador.jsx`), se incluye una tarjeta de previsualización interactiva `.vista-previa-argumento-completo`.
- Permite expandir o inspeccionar el texto íntegro, autor, postura y conector del argumento seleccionado antes de confirmar una acción o emitir una calificación.

Mientras escucha a los demás, cada participante prepara sus siguientes argumentos; en cuanto quedan aprobados entran al mapa, suman sus puntos y su autor entra nuevamente a la ruleta.

```
Participante prepara su argumento (tipo + objetivo si corresponde + texto)
  └─ lo revisa con Groq por HTTP (sin gastar Ably) → aprobado
        └─ se publica argument.submitted (pendienteDeExposicion) y, si el tipo tiene
           objetivo (contra / refuerzo / dilema / conexión), también link.created:
           el nodo queda en el mapa debajo de aquel al que responde, y ya puntúa
                          │
                          ▼
Ruleta ponderada → ofrece turno SOLO a quien tiene un argumento pendiente de exponer
                  (en Ronda 1, prioriza posturas sin exposición previa)
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
            RECHAZA              ACEPTA
                │                   │
         reroll (excluye      expone en voz alta el argumento que ya
         temporalmente        está en el mapa; los co-moderadores lo
         a quien rechazó).    califican mientras habla; al terminar
         Su argumento SIGUE   pulsa «Ya lo expuse» (exposicion.terminada)
         en el mapa con sus           │
         puntos, pero se le           ▼
         resta la penalidad   el "pendiente" se consume: para volver
         del perfil           a la ruleta hay que preparar otro
                                      │
                          los ajustes por la exposición se aplican
                          al cerrar la sesión (ver abajo)
```

Al preparar un argumento que responde a otro, la lista de objetivos solo ofrece argumentos **ajenos**. Los formularios avisan qué falta (objetivo o texto) en vez de no hacer nada. Quien ya publicó todas las posiciones del perfil (3) no puede preparar más, pero si la tercera sigue pendiente de exposición, todavía puede recibir el turno para defenderla.

### Evaluación de la exposición

- **Co-moderadores.** Desde que quien tiene la palabra anuncia su argumento, cada co-moderador ve en su panel la exposición «en curso» (con el argumento y el punto al que responde) y responde a dos preguntas en una: ¿está hablando? ¿es coherente con el debate y con el punto? Cuatro botones: *Coherente con el punto*, *Aceptable*, *Fuera de tema o sin razón* y *No está hablando*. Cada uno califica una vez (si vuelve a calificar reemplaza su nota) y nadie califica su propia exposición. Las que ya terminaron siguen en su cola hasta que las califique.
- **Se promedian.** *Coherente* vale +1, *aceptable* 0, *fuera de tema* y *no está hablando* −1. Sin moderador de por medio, rige el promedio.
- **Moderador.** Ve las mismas exposiciones en su consola y puede evaluar cada una (opcional, incluso mientras se expone), **descartar** las calificaciones de los co-moderadores o dejarla sin evaluar. De los co-moderadores ve cuántos calificaron y el promedio, nunca quién puso qué. Puede cambiar de idea hasta cerrar. Su evaluación manda sobre el promedio; si descarta, esa exposición no ajusta puntos ni reparte bonos.
- **Al cerrar la sesión** (fase de cierre o «Cerrar el debate ahora») el motor aplica, una sola vez, el ajuste al expositor y los bonos de consistencia a los co-moderadores (ver `05-reglas-de-puntaje.md`). Hasta ese momento el marcador y el ranking parcial son **provisionales**.

### Argumento destacado y turno que queda abierto

- Al aceptar el turno, quien tiene la palabra anuncia su argumento (`argument.presenting`): la sala, la proyección y los celulares lo ven **en grande unos 12 segundos** y después en tamaño normal bajo «X está hablando ahora». El anuncio también abre la exposición para que los co-moderadores la califiquen. Al terminar, pulsa «Ya lo expuse» (`exposicion.terminada`).
- El motor no ofrece otro turno mientras haya uno en curso. Si quien hablaba cierra la pestaña o no puede continuar, el panel de avisos del host lo señala («X tiene la palabra pero está sin conexión») y el moderador pulsa **«Terminar el turno de X»** (`turn.ended_by_host`): la ruleta sigue, no cuenta como intervención ni como rechazo, y esa persona conserva su argumento pendiente de exposición.

### Turno hablado de respaldo

Si no queda ningún argumento preparado por exponer y alguien todavía no tomó la palabra ni una vez, se le ofrece un turno **hablado**, sin argumento escrito. Vale poco (la posición de menor valor con descuento de vía) y un co-moderador lo califica después. Dos precisiones: el argumento de ingreso **no** cuenta como haber tomado la palabra, y hay un minuto de margen desde el inicio de la fase antes de la primera oferta hablada.

Reglas de seguridad del turno:

- **Timeout de aceptación** (ej. 20 segundos) — si nadie responde, la oferta expira (`turn.timeout`) y se reoferta a otro participante automáticamente. Sin esto el debate se congela. Si quien no respondió es el **único elegible**, la ruleta se lo vuelve a ofrecer a esa misma persona con un `turnId` nuevo (mismo criterio que con un rechazo, para no bloquear la ruleta); en pantalla eso se lee como una oferta que se renueva cada 20 segundos.
- **Tope de rechazos** — tras N rechazos consecutivos en la sesión, la siguiente oferta a esa persona ya no puede rechazarse (evita que todos rechacen para no participar). **Consecutivos** significa que tomar la palabra corta la racha: el contador vuelve a cero tanto al aceptar un turno como al recibir uno forzado. Sin ese reset, tres rechazos sueltos en toda la sesión dejaban a esa persona en modo forzado de forma permanente.
- **Cortacircuitos de ruleta (prevención de bucle infinito)** — Si 4 ofertas consecutivas (rechazadas o expiradas por timeout) se acumulan sin que nadie tome la palabra, el motor pausa automáticamente la ruleta de turnos (`turn.roulette_paused`). Esto evita bucles infinitos de notificaciones a los estudiantes. El moderador recibe una alerta en su panel para reanudar la ruleta (`turn.roulette_resumed`), pausarla manualmente o dar por terminada la fase actual.
- **Rechazar cuesta puntos**, y el botón lo avisa antes de confirmar. Se restan **sobre los puntos que el argumento ya dio** (el argumento se queda en el mapa). El descuento sale de la fórmula única y escala con el perfil elegido; el acumulado nunca baja de cero (ver `05-reglas-de-puntaje.md`). Rechazar no abre la calificación de la exposición: solo exponer permite ganar más.
- El tipo de relación que el estudiante autodeclara **puede ser corregido** por el co-moderador al validar. El puntaje final depende del tipo confirmado, no del autodeclarado — evita que se autoetiquete como "contraargumento" solo para ganar más puntos.

## Conexión libre (fuera de turno)

Cualquier participante, en cualquier momento, sin necesidad de turno, puede conectar **un argumento que ya haya publicado él mismo** con el argumento de otro participante — pero solo **una vez por cada argumento propio** (cada argumento que posee puede ser el origen de, como máximo, una conexión saliente). Un argumento que se publicó respondiendo a otro (contra / refuerzo / dilema) o que salió de un bid aprobado ya trae su conexión, así que no aparece disponible aquí.

```
Participante elige uno de sus argumentos ya publicados
     (que todavía no tenga conexión saliente)
                    │
                    ▼
     selecciona argumento objetivo de otro participante
                    │
                    ▼
     elige tipo de relación (refuerzo / contra / dilema / conexión)
                    │
                    ▼
     se publica link.created
     (validado localmente: el origen no debe tener ya una salida)
                    │
                    ▼
     co-moderador valida la relación después (sin bloquear, sin costo de Groq)
```

Por qué es "una vez por argumento y no un límite global por persona": el total de conexiones posibles queda acotado por el total de argumentos existentes (no puede haber spam ilimitado), pero alguien con varios argumentos fuertes no se ve castigado con un único uso para toda la sesión. Ver `02-arquitectura.md` para el razonamiento de control de costos asociado.

## Bid de intervención — pedir turno mediante contenido

Mientras otro participante tiene el turno principal, cualquier otro puede lanzar un **bid**: escribe directamente el contenido de una reacción dirigida a uno de los argumentos del que está hablando. El texto del bid **es** el contenido final del argumento si se aprueba — no hay un paso posterior de reescritura.

Tipos de bid en v1 (solo estos dos; "agregar argumento nuevo por bid" queda como feature futura, ver `06-pendientes.md`):

| Tipo de bid | Se convierte, si se aprueba, en |
|---|---|
| **Desmontar** | `argument.submitted` con `tipoDeclarado: "contraargumento"`, `argumentoObjetivoId` = el argumento atacado |
| **Fortalecer** | `argument.submitted` con `tipoDeclarado: "refuerzo"`, `argumentoObjetivoId` = el argumento reforzado |

### Flujo de evaluación

```
bid.submitted (mientras otro tiene el turno principal)
        │
        ▼
CO-MODERADORES evalúan — EN PARALELO con cualquier otro bid abierto
en ese momento (no hay cola; varios bids sobre el mismo argumento
se evalúan a la vez)
        │
        ├─ cada co-moderador vota aprueba/rechaza dentro de una
        │  ventana de tiempo límite (tiempoLimiteEvaluacionBid)
        │
        ├─ todos ven una barra de progreso agregada y anónima
        │  (ej. "✅ 2  ❌ 1  ⏳ 1 pendiente") — nunca se muestra
        │  quién emitió qué voto
        │
        ▼
el tema se cierra cuando: ya no quedan bids pendientes, O el
moderador decide cerrarlo manualmente (corta la evaluación de
los que sigan sin resolver)
        │
        ▼
se muestra al MODERADOR la lista de bids tratados en ese cierre
        │
        ▼
MODERADOR da el veredicto final, bid por bid — autoritativo,
puede ir en contra de la mayoría de co-moderadores
        │
   ┌────┴─────┐
APROBADO    RECHAZADO
   │            │
se publica    no se publica nada. Sin puntaje.
argument.     Opcional: nota breve de feedback
submitted     de por qué se rechazó.
directo con
el texto del
bid (sin pasar
por Groq — ya
lo validaron
2 capas humanas)
   │
sigue la fórmula de puntaje normal por posición
(05-reglas-de-puntaje.md), como cualquier argumento
```

Al cerrarse el veredicto de cada bid, se calcula también el puntaje de cada co-moderador que votó sobre él: **+5 si su voto coincide con la decisión final del moderador** (ver `05-reglas-de-puntaje.md`).

### Después del cierre — turno principal siguiente

Una vez resueltos todos los bids del cierre, se sortea el siguiente turno principal por ruleta, con una regla de prioridad más fuerte que el simple peso por participación: **prioridad absoluta a quien todavía no ha tenido ningún turno principal**. Solo cuando todos ya participaron al menos una vez, la ruleta vuelve a operar por peso proporcional (quien ha hablado menos).

### Temporizadores de facilitación (no forzados técnicamente)

- `tiempoLimiteEvaluacionBid`: ventana para que los co-moderadores voten un bid antes de que expire sin quórum.
- `duracionMaximaIntervencionPrincipal` / `duracionMaximaIntervencionBid`: cuenta regresiva mostrada en la consola del host/proyección para pautar cuánto puede hablar en voz alta quien tiene el turno principal o un bid aprobado. Es una ayuda de ritmo para el moderador, no algo que el sistema pueda forzar (no hay reconocimiento de voz, ver `02-arquitectura.md`).

### Nota de anonimidad del voto de co-moderadores

El voto de cada co-moderador (`bid.vote_comoderador`) lleva su `coModeradorId` en el payload — es necesario para poder calcular después el puntaje por coincidencia con el moderador. La "anonimidad" es una convención de **interfaz**: la UI nunca muestra a nadie (ni a otros co-moderadores, ni al moderador) quién emitió cuál voto, solo el agregado. No es un ocultamiento a nivel de Ably — cualquier cliente suscrito al canal técnicamente recibe el evento crudo. Aceptable para un salón de clase (mismo criterio que la clave hardcodeada de la consola del host), no para un contexto adversarial.

## Sugerencia de conexión asistida por IA

Cuando el moderador cierra la fase de escritura de una ronda, se dispara **una sola llamada** a Groq que analiza todos los argumentos de la ronda y propone relaciones candidatas. Solo se muestran a los estudiantes cuyos argumentos están involucrados en cada sugerencia:

```
link.suggested (visible solo a los 2 dueños de los argumentos involucrados)
        │
   ┌────┴────────────┬─────────────────┐
 ACEPTA           RECHAZA            RECHAZA
 confirma         + conecta         + reescribe su
 link.created     manualmente       argumento (la sugerencia
                  distinto          reveló que estaba mal
                                    planteado)
```
