# Roles y flujo de turnos

## Los 3 roles

| Rol | Quién | Qué hace |
|---|---|---|
| **Moderador** | El profesor | Crea el Programa, controla el avance de fases, proyecta el grafo en vivo, puede delegar y supervisar co-moderadores |
| **Co-moderador** | Sorteado al azar entre los participantes (ver fórmula abajo) | Valora, anota, resuelve casos escalados por Groq, marca faltas, valida tipos de relación |
| **Participante** | El resto de estudiantes | Recibe turnos, escribe argumentos, conecta argumentos libremente |

### Selección de co-moderadores

```
n_co_moderadores = max(1, ceil(n_participantes * 0.10))
```

El profesor puede fijar un tope máximo para grupos grandes. Los co-moderadores se sorprenden al azar entre los inscritos (mismo mecanismo de presence de Ably usado para la ruleta de turnos) y, por defecto, no participan también como argumentadores en la misma sesión (evita conflicto de interés al validar sus propios argumentos).

## Flujo de turno (producción de argumento nuevo)

Solo quien tiene el turno puede **crear** un argumento nuevo. El resto puede conectar libremente (ver más abajo), pero no agregar.

```
Ruleta ponderada → ofrece turno a un participante
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
            RECHAZA              ACEPTA
                │                   │
         reroll (excluye      elige tipo de argumento:
         temporalmente        nuevo / contra / refuerzo /
         a quien rechazó)     dilema / pregunta / concesión
                                    │
                          si el tipo requiere objetivo
                          (contra/refuerzo/conexión):
                          selecciona el argumento al que apunta
                                    │
                              escribe el texto
                                    │
                          Groq valida forma (ver 02-arquitectura.md)
                                    │
                          se publica el evento argument.submitted
                                    │
                          co-moderador REVISA después (no bloquea)
                          → valora, corrige el tipo si hace falta,
                            asigna bonus o marca falta
```

Reglas de seguridad del turno:

- **Timeout de aceptación** (ej. 20 segundos) — si nadie responde, se reoferta a otro participante automáticamente. Sin esto el debate se congela.
- **Tope de rechazos** — tras N rechazos consecutivos en la sesión, la siguiente oferta a esa persona ya no puede rechazarse (evita que todos rechacen para no participar).
- El tipo de relación que el estudiante autodeclara **puede ser corregido** por el co-moderador al validar. El puntaje final depende del tipo confirmado, no del autodeclarado — evita que se autoetiquete como "contraargumento" solo para ganar más puntos.

## Conexión libre (fuera de turno)

Cualquier participante, en cualquier momento, sin necesidad de turno, puede conectar **un argumento que ya haya publicado él mismo** con el argumento de otro participante — pero solo **una vez por cada argumento propio** (cada argumento que posee puede ser el origen de, como máximo, una conexión saliente).

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
