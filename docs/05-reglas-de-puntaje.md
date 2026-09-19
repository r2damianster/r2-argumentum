# Reglas de puntaje — fórmula única

Todo el puntaje sigue una sola fórmula, no valores sueltos, para que sea una norma clara y defendible ante los estudiantes.

## Perfiles de puntaje

El docente elige el modo de calificación al configurar la sesión. Los perfiles **no son tablas paralelas**: son juegos de parámetros que alimentan esta misma fórmula.

| Perfil | Posiciones | Descuento R2 | Descuento vía | Rechazo de turno |
|---|---|---|---|---|
| Liviano | 10 / 8 / 3 | 0.85 | 0.7 | −2 |
| Estándar | 100 / 80 / 30 | 0.7 | 0.5 | −20 |
| Estricto | 1000 / 800 / 300 | 0.5 | 0.3 | −300 |

Los tres mantienen la proporción 10 : 8 : 3 entre posiciones (hay una prueba que lo verifica), así el ranking por percentiles dentro de cada postura funciona igual con cualquiera. Los bonos de co-moderación escalan con el perfil (`factorDeBonosDeCoModeracion`): con escala de miles, un +8 fijo sería ruido estadístico y el rol dejaría de ser comparable en valor al de argumentar.

## Puntaje del turno hablado

Una intervención de viva voz sin argumento escrito vale como **la posición de menor valor con el descuento de vía aplicado** — sale de la misma fórmula en vez de ser un número suelto, así escala sola con el perfil. Se acredita al registrarse; la calificación del co-moderador la ajusta: "buena" la duplica, "aceptable" la deja igual, "insuficiente" la anula.

Ojo al comparar perfiles: el turno hablado **no** escala exactamente 10× de Estándar a Estricto. Con «buena» da 30 puntos en Estándar (30 × 0,5 = 15, más 15 de la calificación) y 180 en Estricto (300 × 0,3 = 90, más 90), o sea 6×. Es coherente con el diseño: Estricto tiene descuentos de vía más duros (0,3 frente a 0,5), y ese mismo descuento se aplica a los argumentos por vía co-moderador. Se decidió no igualarlo (19 de septiembre de 2026).

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

Mismos órdenes de magnitud que el puntaje de estudiantes, para que el rol sea comparable en valor, no un premio de consolación. Premia criterio, no volumen de acciones:

| Acción | Puntos | Condición |
|---|---|---|
| Caso escalado resuelto, ratificado luego por el moderador | +8 | requiere ratificación — evita autoservicio |
| Voto en un bid de intervención coincide con la decisión final del moderador | +5 | ver `04-roles-y-turnos.md`, mecánica de bids desmontar/fortalecer |
| Falta detectada con justificación escrita, no revertida | +6 | la justificación es obligatoria |
| Reclasificación correcta de un tipo de relación autodeclarado | +5 | — |
| Feedback usado por el estudiante para reformular con éxito | +4 | mide impacto real, no cantidad de comentarios |
| Coincide con otro revisor en una revisión cruzada aleatoria | +3 | bono pasivo anticorrupción/anti-sesgo |
| Falta marcada sin justificación, o revertida por el moderador | −5 | desincentiva farmear puntaje marcando de más |

La "revisión cruzada aleatoria" consiste en que el sistema, ocasionalmente y sin avisar, hace que dos co-moderadores revisen el mismo caso — si coinciden, ambos ganan el bono de consistencia. Sirve como auditoría automática sin que el profesor tenga que revisar todo manualmente.

## Ranking visible — por postura, con tiers, no puntaje numérico

```
tercio superior del grupo de esa postura   → 🥇 Sólido
tercio medio                                → 🥈 Consistente
tercio inferior                             → 🥉 En desarrollo
```

Se usan **cortes por percentil dentro de cada postura**, no umbrales numéricos fijos. Esto evita que quien defiende la postura "más difícil" quede sistemáticamente peor ubicado, y hace que el ranking se adapte automáticamente a cualquier tabla de puntaje que un Programa distinto configure, sin tener que recalibrar los cortes cada vez.
