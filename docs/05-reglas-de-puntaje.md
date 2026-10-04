# Reglas de puntaje — fórmula única

Todo el puntaje sigue una sola fórmula, no valores sueltos, para que sea una norma clara y defendible ante los estudiantes.

## Perfiles de puntaje

El docente elige el modo de calificación al configurar la sesión. Los perfiles **no son tablas paralelas**: son juegos de parámetros que alimentan esta misma fórmula.

| Perfil | Posiciones | Descuento R2 | Descuento vía | Rechazo de turno |
|---|---|---|---|---|
| Liviano | 10 / 8 / 3 | 0.85 | 0.7 | −2 |
| Estándar | 100 / 80 / 30 | 0.7 | 0.5 | −20 |
| Estricto | 1000 / 800 / 300 | 0.5 | 0.3 | −300 |

Los tres mantienen la proporción 10 : 8 : 3 entre posiciones (hay una prueba que lo verifica), así el ranking por percentiles dentro de cada postura funciona igual con cualquiera. El puntaje de los co-moderadores también escala con el perfil: lo máximo que puede ganar un co-moderador es la suma de las posiciones del perfil (lo que gana un debatiente con todas las suyas), así el rol sigue siendo comparable en valor al de argumentar con cualquier escala (ver «Puntaje de co-moderadores»).

## Puntaje del turno hablado

Una intervención de viva voz sin argumento escrito vale como **la posición de menor valor con el descuento de vía aplicado** — sale de la misma fórmula en vez de ser un número suelto, así escala sola con el perfil. Se acredita al registrarse; la calificación del co-moderador la ajusta: "buena" la duplica, "aceptable" la deja igual, "insuficiente" la anula.

Ojo al comparar perfiles: el turno hablado **no** escala exactamente 10× de Estándar a Estricto. Con «buena» da 30 puntos en Estándar (30 × 0,5 = 15, más 15 de la calificación) y 180 en Estricto (300 × 0,3 = 90, más 90), o sea 6×. Es coherente con el diseño: Estricto tiene descuentos de vía más duros (0,3 frente a 0,5), y ese mismo descuento se aplica a los argumentos por vía co-moderador. Se decidió no igualarlo (19 de septiembre de 2026).

## El argumento puntúa al aprobarse; la exposición lo ajusta al cerrar

El argumento se publica (y puntúa, con la fórmula de más abajo) apenas Groq lo aprueba, no cuando se expone en un turno. Rechazar el turno resta la penalidad del perfil sobre esos puntos. Exponerlo abre una calificación que **ajusta** el puntaje del expositor:

```
nivel de una exposición (según quién manda):
  el moderador la evaluó        → su nivel (autoritativo)
  el moderador descartó         → sin ajuste, y esa exposición no cuenta para el puntaje de los co-moderadores
  el moderador no intervino     → promedio de los niveles de los co-moderadores
  nadie la calificó             → sin ajuste

  nivel:  coherente con el punto +1 · aceptable 0 · fuera de tema o sin razón −1 · no está hablando −1

ajuste al expositor = redondeo(nivel × puntaje base del argumento)
```

Es la misma semántica que el turno hablado: «coherente» duplica lo que ya valía el argumento, «aceptable» lo deja igual e «insuficiente» lo anula. Con dos co-moderadores, una «coherente» y una «aceptable» dan +50 % del puntaje base. El descuento de ronda y de vía del argumento ya está dentro del puntaje base, así que se respeta solo.

Los ajustes se calculan **una sola vez, al cerrar la sesión** (`motor.cerrarSesion`, que los publica antes de `session.closed`), cuando el moderador ya pudo revisar y descartar. Hasta entonces el marcador y el ranking parcial son **provisionales**: no incluyen estos ajustes.

### Puntaje de los co-moderadores por cierre

Con el mismo cierre se puntúa el trabajo de los co-moderadores, y se hace **por porcentaje de acierto**, no por coincidencias sueltas de todo o nada. Entran en el cálculo las exposiciones calificadas y los bids votados; las reglas completas están en «Puntaje de co-moderadores», más abajo.

## Puntaje del foro escrito

Sigue la fórmula única: nada de números sueltos, todo sale de los valores de posición del perfil (`src/shared/puntaje/puntajeDeAportes.js`).

- **Post nuevo n.º 1, 2, 3** de cada persona: valor de la posición 1, 2 y 3 del perfil (Estándar: 100, 80, 30).
- **Réplica:** el valor de la última posición del perfil (Estándar: 30), hasta **5 réplicas** puntuadas. Un aporte pasado de esos topes se publica y se ve, pero vale 0. Máximo de un debatiente en Estándar: 210 + 150 = 360.
- **Se acredita al publicar** (provisional). El ajuste por la revisión humana se aplica **una sola vez, al cerrar**: *cuenta completo* no cambia nada, *parcial* resta la mitad de lo que valía y *no cuenta* lo resta todo. Rige la decisión del moderador; si no intervino, la mayoría de los co-moderadores; **sin ninguna revisión, el aporte cuenta completo**. Un aporte oculto no cuenta.
- La sugerencia de la IA **no** cambia el puntaje.
- **No hay puntos por reacciones.** El «convencimiento cruzado» (un «me convenció» de alguien de la postura contraria) se cuenta y lo ve el moderador, pero no puntúa en la v1.
- **La integridad no afecta el puntaje por sí sola:** las señales son una advertencia para el moderador, quien puede decidir que un aporte no cuente.

## El total nunca baja de cero

Una penalidad (hoy solo la de rechazar un turno) puede consumir los puntos que la persona tenía, pero no dejarla en deuda: el acumulado se topa en 0. Proyectado en el aula, un número negativo se lee como un castigo desproporcionado, y no cambia el orden del ranking, que compara por percentiles dentro de cada postura.

El desincentivo de rechazar no depende de eso: a los N rechazos **consecutivos** el turno se fuerza y hay que hablar igual (ver `04-roles-y-turnos.md`). El `delta` que se publica conserva el valor nominal de la regla, así el export muestra la penalidad completa y el tope que la cortó.

## Puntaje base y revisión del co-moderador

El puntaje base de un argumento (`posición × ronda × vía`) **no depende** de que un co-moderador lo revise: se acredita apenas el argumento entra al canal. Solo los bonos de co-moderación dependen de esa revisión. Antes estaban acoplados, y en una sala de 2 participantes —donde el sorteo correctamente asigna 0 co-moderadores— nadie podía puntuar nunca.

## Fórmula base (argumentos de estudiantes)

Los valores que siguen usan la escala **Liviana** (10 / 8 / 3) para que las cuentas sean legibles; con Estándar o Estricto se usan los valores y descuentos de la tabla de perfiles.

```
valor de una posición (1ra, 2da, 3ra) = valor_base(posición) × descuento_ronda × descuento_vía

valor_base(posición 1) = 10
valor_base(posición 2) = 8
valor_base(posición 3) = 3

descuento_ronda = 1.0   si la posición se completa en Ronda 1
descuento_ronda = 0.7   si se completa en Ronda 2 (retrasar cuesta 30%)

descuento_vía = 1.0     si el argumento pasa validación de Groq (1er o 2do intento)
descuento_vía = 0.5     si entra por revisión manual de un co-moderador
                        (tras 2 intentos fallidos de Groq)
```

Todos los valores se redondean al entero más cercano, con mínimo de 1 punto (nunca 0, para no eliminar el incentivo a participar tarde).

### Por qué 0.7 en Ronda 2

Reproduce el ancla ya fijada para el caso de "cero argumentos en Ronda 1": 10 × 0.7 = 7. El mismo multiplicador se aplica de forma consistente a las demás posiciones, en vez de definir un número distinto para cada caso.

## Tabla resultante

| Caso | Qué completa en Ronda 2 | Puntaje de Ronda 2 | Total posible |
|---|---|---|---|
| 3 argumentos en R1 | ninguno | — | 21 |
| 2 argumentos en R1 | posición 3 | 3 × 0.7 = 2 | 18 + 2 = 20 |
| 1 argumento en R1 | posiciones 2 y 3 | 8 × 0.7 = 6, 3 × 0.7 = 2 | 10 + 6 + 2 = 18 |
| 0 argumentos en R1 | solo posición 1 (no recupera 2 y 3) | 10 × 0.7 = 7 | 7 |

Quien no entra nada en Ronda 1 solo recupera la posición 1 en Ronda 2 — la inacción total se penaliza más que la inacción parcial.

### Ingreso vía co-moderador

Se aplica el descuento de vía (× 0.5) sobre el valor ya calculado, incluyendo el descuento de ronda si corresponde:

```
posición 1 en R1 vía co-moderador = 10 × 0.5 = 5
posición 1 en R2 vía co-moderador = 7 × 0.5 = 4 (redondeado)
```

## Puntaje de conexiones

```
puntajeConexion.aceptaSugerenciaGroq
puntajeConexion.conexionManualPropia
puntajeConexion.conexionRechazadaYCorregida   // valora el acto de corregir, no solo aceptar
```

Valores concretos configurables por Programa — mantener la misma escala relativa que el puntaje de argumentos (aceptar/conectar vale menos que producir un argumento nuevo válido, pero más que cero).

## Puntaje de co-moderadores

Premia criterio y trabajo, no volumen ni coincidencias sueltas. Es una función única del núcleo, independiente de la actividad (`src/shared/nucleo/revision/calcularPuntajeDeRevisores.js`), así la usan el debate hablado, el foro escrito y las actividades futuras.

1. **Referencia de cada elemento revisado.** La decisión del moderador (peso 1). Si no intervino, el consenso de los co-moderadores —el nivel que rige al cerrar, con al menos dos votos— (peso 0,6). Con un único voto y sin moderador no hay referencia. Si el moderador descartó las revisiones de ese elemento, no cuenta ni como acierto ni como esfuerzo.
2. **Cercanía de un voto** = `1 − |su nivel − nivel de referencia| / rango de la escala`. Funciona con cualquier escala (en las exposiciones, de −1 a +1; en los bids, aprueba o rechaza).
3. **Acierto** = promedio ponderado de la cercanía, **corregido por azar**: `max(0, (promedio − 0,5) / 0,5)`. Votar al azar da cercanía ≈ 0,5 y por tanto 0 puntos: no hace falta restar nada, y el total sigue sin bajar de cero. Si ningún elemento revisado tiene referencia, el acierto vale 0,5 (se reconoce el esfuerzo sin poder medir el acierto).
4. **Esfuerzo** = `min(1, elementos revisados / 7)`.
5. **Puntos** = `suma de los valores de posición del perfil × acierto × esfuerzo` (210 como máximo en Estándar).

Ejemplo (Estándar): Marta revisó 8 casos, 6 con referencia, con cercanías 1, 1, 1, 0,5, 1 y 0. Promedio 0,75 → acierto 0,5; esfuerzo 1 → 105 puntos. Otro co-moderador revisa 4 casos y coincide siempre con el consenso: acierto 1, esfuerzo 4/7 → 120 puntos.

**Si el moderador decide no evaluar lo que hicieron los co-moderadores, igual puntúan**: rige el consenso entre ellos.

### Qué se retiró (octubre de 2026)

Los bonos sueltos por reclasificar un tipo, marcar una falta y resolver un caso escalado, el +5 inmediato por votar como el moderador en un bid y el +3 de «revisión cruzada» se pagaban sin pasar por el moderador (bastaba reclasificar todo o marcar faltas con cualquier nota) y eran de todo o nada. Se eliminaron junto con la cola «Confirmar validación» del panel de co-moderador; la corrección del tipo de relación pasa a ser un campo de la revisión de aportes en el foro escrito (ver `13-foro-escrito-y-nucleo-reutilizable.md`). Los eventos `argument.validated` de sesiones anteriores se siguen entendiendo.

## Ranking visible y estructura de doble podio

```
tercio superior del grupo de esa postura   → 🥇 Sólido
tercio medio                                → 🥈 Consistente
tercio inferior                             → 🥉 En desarrollo
```

Se usan **cortes por percentil dentro de cada postura**, no umbrales numéricos fijos. Esto evita que quien defiende la postura "más difícil" quede sistemáticamente peor ubicado, y hace que el ranking se adapte automáticamente a cualquier tabla de puntaje que un Programa distinto configure, sin tener que recalibrar los cortes cada vez.

### Ordenamiento del doble podio: Pantalla en vivo vs. Exportación PDF/JSON

El sistema implementa dos vistas diferenciadas para presentar los resultados del debate, estructuradas de forma inversa según el contexto pedagógico (`seleccionesDerivadas.js`):

1. **Pantalla de Ranking en Vivo (`PantallaDeRanking.jsx`):**
   - **1.º Podio de Posturas (Colaborativo):** Muestra primero el ranking de posturas ordenadas por puntaje acumulado total, acompañadas de tarjetas con **ejemplos de sus argumentos centrales o representativos**.
   - **2.º Podio de Estudiantes (Individual):** A continuación presenta la tabla individual de participantes con su postura, puntos y tier alcanzado (Sólido / Consistente / En desarrollo).

2. **Informe Exportable en PDF y JSON (`InformeDelDebate.jsx` y `exportarSesion.js`):**
   - **1.º Lista Individual de Estudiantes:** Presenta en primer lugar la evaluación individual de **todos** los participantes inscritos, **incluyendo explícitamente a quienes hayan obtenido 0 puntos** o hayan quedado como oyentes.
   - **2.º Lista Colaborativa por Posturas:** Presenta en segundo lugar la síntesis de resultados agregados por postura con su acumulado y sus argumentos centrales.
