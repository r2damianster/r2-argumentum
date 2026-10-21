# Programa de Debate — esquema de configuración

## Qué es

La plantilla que el moderador (profesor) llena **antes** de abrir una sesión en vivo. Es reutilizable entre cursos o paralelos (mismo tema, distinto grupo de estudiantes). El motor de tiempo real (Ably + Groq) lee de aquí buena parte de sus reglas, **pero no todos los campos de este documento los lee el código**: al final hay una tabla (§ «Qué campos lee el código») que separa los que mandan de los que son solo informativos. Antes de apoyarte en un campo, mira esa tabla.

En v1, un Programa se guarda y se carga como un **archivo JSON exportable/importable** — sin necesidad de backend ni base de datos. El profesor puede guardar su "plan de debate" igual que guardaría un plan de clase, y reutilizarlo en otro paralelo.

## Esquema completo

### A. Identificación

```
programId, titulo, version, creadoPor, fechaCreacion
actividad: "debate_hablado" | "exposicion_de_posturas" | "foro_escrito" | "control_de_lectura"   // por defecto "debate_hablado"
```

El **control de lectura** no tiene posturas y trae campos propios (`consigna`, `estructura`, `rubrica`, `revisionDePares`…): ver `14-control-de-lectura.md`.

La **actividad** decide cómo participa la clase y qué motor la ejecuta (ver `13-foro-escrito-y-nucleo-reutilizable.md`). El moderador la elige antes de elegir el Programa, y un Programa de otra actividad no se puede abrir con la elegida.

### B. Contenido pedagógico

```
temaCentral            // ej. "¿Debe la IA usarse sistemáticamente en la universidad?"
preguntaGuia
objetivoAprendizaje    // qué competencia se evalúa: pensamiento crítico, contraargumentación...
instruccionesParaEstudiantes
```

### C. Posturas

```
posturas: [
  { id, etiqueta: "A favor", color },
  { id, etiqueta: "En contra", color }
  // opcional: postura "Matizada / condicional", marcada con esMatizada: true — el validador
  // no le contradice la postura aunque el argumento suene a uno de los polos
]
asignacionPostura: "libre" | "aleatoria" | "por_argumento"
                                // "aleatoria" reparte por turnos entre quienes están en la sala (modo rolplay)
                                // "libre" el estudiante elige postura de botones preexistentes
                                // "por_argumento" el estudiante escribe su postura/argumento y Groq clasifica su bando autocomprobando la razón
permiteCambioPostura: boolean   // habilita mecánica "defiende lo contrario" (fase futura)
```

Las posturas de un Programa son **candidatas**: al iniciar la sesión el moderador tilda cuáles se debaten (mínimo 2). Un Programa puede traer más de 3 (el de Filosofía trae 12).

### C.1 Ajustes de sesión que fija el moderador en la sala de espera

No hace falta que vengan en el JSON (pero pueden venir como valor por defecto). Se republican al canal **en vivo mientras la sala está en espera**, porque los estudiantes ingresan antes de que el moderador arranque:

```
perfilDePuntaje: "liviano" | "estandar" | "estricto"   // ver 05-reglas-de-puntaje.md
permitirPosturasNuevas: boolean                         // por defecto false
idioma: "es" | "en"                                     // idioma de los argumentos; por defecto "es"
posturas: [ ...solo las tildadas... ]
```

`idioma` solo afecta a lo que escriben los participantes: el corrector ortográfico del navegador (atributo `lang` de la pantalla del participante) y el idioma con que Groq valida y comenta el argumento (conectores de razón y textos de respuesta). La interfaz —botones, avisos, instrucciones— sigue en español; no hay capa de traducción. Un Programa sin `idioma` se juega en español.

Con `permitirPosturasNuevas: true`, si Groq detecta que el argumento no defiende ninguna postura de la lista, el estudiante puede proponer la suya; si el moderador la acepta se suma a `posturas` y se le asigna a quien la propuso. Con `false`, el estudiante debe reescribir su argumento para una postura existente.

### D. Estructura de fases

```
fases: [
  { tipo: "escritura_argumentos", ronda: 1, limiteArgumentos: 3, duracionMin, priorizarPosturas: true },
  { tipo: "escritura_argumentos", ronda: 2, limiteArgumentos: "segun_ronda_1", duracionMin },
  { tipo: "conexion_sugerida", disparadoPor: "moderador" },
  { tipo: "conexion_libre", ventanaAbierta: "toda_la_sesion" },
  { tipo: "cierre_y_ranking" }
]
```

Cada fase tiene inicio y fin controlado explícitamente por el moderador — evita descontrol y llamadas a Groq impredecibles.

**Exposición de posturas** (`actividad: "exposicion_de_posturas"`, versión ligera del debate hablado): una sola fase de turnos y el cierre. Cada quien expone en voz alta su propia postura; no se argumenta contra nadie ni se conectan argumentos.

```
fases: [
  { tipo: "escritura_argumentos", limiteArgumentos: 1 },   // sin ronda: no hay Ronda 2
  { tipo: "cierre_y_ranking" }
]
```

Solo entiende esos dos tipos de fase (`src/actividades/exposicionDePosturas/definicion.js`). Los campos de conexión (`maxConexionesSalientesPorArgumento`, `requiereSeleccionDeTipo`) y `promptSistemaFase2` no aplican. El patrón de escritura sí está disponible. Ejemplo: `posturas-ia-en-la-universidad.json`.

**Foro escrito** (`actividad: "foro_escrito"`): una sola fase con tiempo total y el cierre.

```
fases: [
  { tipo: "foro_escrito", duracionMin: 20 },   // tiempo total de escritura; se cierra sola al llegar a cero
  { tipo: "cierre_y_ranking" }                 // revisión final y cierre; el moderador pulsa «Cerrar y calcular»
]
limitesDePuntaje: { maxPostsNuevos: 3, maxReplicasPuntuadas: 5 }   // los extras se publican pero valen 0
sugerenciasDeIA: true                                              // false apaga la sugerencia de Groq
integridad: { nivel: "ninguna" | "advertencias" | "restrictiva" }  // por defecto "ninguna"
```

**Criterios adicionales** (foro escrito): exigencias extra sobre lo que se escribe, más allá de «afirmación + razón» (por ejemplo, «describe una escena de la película»). El Programa los propone y el moderador activa o apaga cada uno en la configuración de la sesión; quedan fijos al iniciar. Máximo 3 activos y 6 definidos.

```
criteriosAdicionales: [
  { id: "describe_escena", etiqueta: "Describe una escena", descripcion: "Quién, qué ocurre…", activoPorDefecto: true }
]
```

Son una **ayuda, no puntaje**: quien escribe los ve como recordatorio, la IA solo **sugiere** si se cumplen (misma llamada de siempre, con confianza mínima 0,6; ante la duda no señala nada) y co-moderadores y moderador los ven como guía al decidir los tres niveles de siempre. No suman ni restan puntos por sí mismos: la fórmula sigue siendo única (`05`). Código: `src/shared/nucleo/criteriosAdicionales/`. Los campos `promptSistemaFase1/2` y `criterioValidacion` de los Programas **no los lee ningún código**; para pedir algo más, usa criterios adicionales.

**Patrón de escritura** (debate hablado): el moderador puede pedir que los argumentos sigan un patrón (PEEL, SPRE, PREP, CER o Toulmin, de `src/shared/nucleo/patronesDeEscritura/`). **Apagado por defecto.** Se elige en la configuración de la sesión y queda fijo al iniciar. Dos modos: *con retroalimentación* (práctica: la IA le sugiere a quien escribe qué parte falta) y *sin retroalimentación* (evaluación: la IA no le dice nada a quien escribe y solo el moderador ve las partes detectadas). En ambos el argumento pasa igual: es una ayuda, no un requisito ni puntaje.

```
patronDeArgumento: { modo: "ninguno" | "con_retroalimentacion" | "sin_retroalimentacion", estructura: "peel" | "spre" | "prep" | "cer" | "toulmin" }
```

Quien escribe ve la guía del patrón junto al campo de texto (`GuiaDelPatronDeArgumento`). PEEL y SPRE son patrones de párrafo, y Toulmin tiene seis partes: la configuración avisa que piden más texto que un argumento corto. La IA detecta las partes en la **misma llamada** de validación (`patron` en `api/groq-validar-argumento.js`; sin patrón, la llamada es idéntica a la de siempre) y solo cuenta las partes que existen en el patrón, con confianza mínima 0,6 (ante la duda no señala nada). Nunca cambia `aprobado`. Con *retroalimentación* quien escribe ve «te falta: …» y puede enviar igual; en ambos modos **el moderador** recibe, por el canal privado de integridad (evento `patron.sugerencia`, solo lo lee el host), qué partes se detectaron: panel «Patrón de escritura» en la consola y anexo confidencial (PDF opcional y `patronDeEscritura` en el JSON del anexo). Código: `src/shared/nucleo/patronesDeEscritura/`.

No hay tiempos por respuesta. `duracionMin` solo lo consumen las fases con tiempo total (la del foro); en el debate hablado se conserva por compatibilidad pero no se aplica. El moderador puede extender el tiempo (+5 min) o cerrar antes. Detalle en `13-foro-escrito-y-nucleo-reutilizable.md`.

En la **Ronda 1** (primera fase de intervenciones), el motor prioriza que al menos una persona que haya preparado su argumento dentro de cada postura activa reciba el turno de exposición en la ruleta antes de repetir posturas.

Quienes no confirmaron su argumento de ingreso al pulsar «Iniciar debate» quedan registrados como **oyentes**, recibiendo la oportunidad pedagógica de redactar un **contraargumento de oyente** contra cualquier argumento publicado del mapa.

### E. Reglas de puntaje

Ver el detalle completo de la fórmula en `05-reglas-de-puntaje.md`. Aquí solo se referencian los parámetros configurables:

```
valoresBasePosicion: [10, 8, 3]        // 1er, 2do, 3er argumento (escala Liviana; el perfil de
                                        // puntaje elegido por el moderador la reemplaza y la
                                        // escala manteniendo la proporción 10:8:3)
descuentoRonda2: 0.7
descuentoViaCoModerador: 0.5
maxIntentosGroqPorArgumento: 2            // INFORMATIVO: no hay tope de intentos (decisión del 11-oct-2026)
puntajeCoModerador: { ... }            // ver 05-reglas-de-puntaje.md
visualizacionRanking: "por_postura_con_tiers" | "numerico_global" | "sin_ranking"
tiers: ["Sólido", "Consistente", "En desarrollo"]
```

### F. Reglas de turno

```
mecanismoTurno: "ruleta_ponderada_con_prioridad_a_no_participantes"
                                        // prioridad absoluta a quien no ha tenido turno principal;
                                        // agotado ese grupo, pesa por quién ha hablado menos.
                                        // Solo entra a la ruleta quien tiene un argumento preparado.
timeoutAceptacion: 20                  // segundos antes de que la oferta expire y se reofrezca (si
                                        // es el único elegible, se le vuelve a ofrecer a la misma persona)
maxRechazosAntesDeForzar: 3            // tras N rechazos, la oferta ya no se puede rechazar

tiempoLimiteEvaluacionBid: 20          // segundos para que un co-moderador vote un bid
duracionMaximaIntervencionPrincipal: 90  // segundos, temporizador de facilitación (no forzado)
duracionMaximaIntervencionBid: 45        // segundos, ídem para un bid aprobado
```

### G. Reglas de conexión libre

```
maxConexionesSalientesPorArgumento: 1
requiereSeleccionDeTipo: true          // refuerzo / contraargumento / dilema / conexión
```

### H. Configuración de Groq

```
criterioValidacion: "claim_mas_razon"  // estructural, no filosófico
ejemplosPorTema: [
  { malo: "Las personas son malas.", bueno: "...", porque: "..." }
  // 2-4 pares por tema, definidos por el profesor al crear el Programa
]
promptSistemaFase1: "..."              // validación al escribir
promptSistemaFase2: "..."              // sugerencia de conexión en lote
```

### I. Configuración de co-moderación

```
moderacion: {
  modo: "reglamentario" | "fijo" | "ninguno",   // por defecto "reglamentario"
  numeroFijo: null | number,                     // solo con modo "fijo"
  minimoParaCoModerar: 6                         // solo modo reglamentario; por defecto 6
}
topeMaximoCoModeradores: null | number           // override opcional para grupos grandes
exclusionMutua: true                             // un co-moderador sorteado no argumenta en la misma sesión
```

El moderador lo elige en la configuración de la sala (ver `04-roles-y-turnos.md`). Un Programa que no trae `moderacion` usa el modo reglamentario.

### J. Exportación al cierre

```
exportaJSON: { estadoDeLaSesion: "parcial" | "cerrada", eventLogCompleto, mapaArgumental, rankingPorPostura, perfilPorEstudiante }
exportaPDF: opcional                    // informe imprimible: "Descargar informe (PDF)" (junto al ranking) abre la
                                        // impresión del navegador (window.print + CSS @media print)
```

### K. Configuración técnica

```
canalAbly: "debate:{programId}:{sessionId}"
duracionTotalEstimada
```

## Programas de ejemplo incluidos

Están en `src/shared/programa/ejemplos/` y se registran en `index.js` (12 en total, agrupados por la `categoria` de cada JSON):

- Política: izquierda vs. derecha (3 posturas, asignación aleatoria).
- Filosofía: libre albedrío vs. determinismo, y «¿qué nos hace humanos?» (12 posturas, asignación libre).
- Educación: «¿Ha sido útil la formación en investigación?» (3 posturas: sí, no, depende/matizada; asignación libre, porque cada estudiante opina desde su experiencia real). Pensado para grupos que han cursado varios semestres de asignaturas de investigación.
- Historia: «¿Qué explica más el Ecuador de hoy?» (4 posturas causales: herencia colonial, dependencia global, decisiones internas y luchas sociales, más una matizada; asignación aleatoria). La cultura es evidencia transversal, no una postura.
- Salud y alimentación: «Azúcar natural vs. edulcorante artificial» (3 posturas; asignación libre).
- Educación (**debate en inglés**): «Should AI detectors decide if academic work is authentic?» (`idioma: "en"`, 3 posturas: los detectores son prueba válida, no son confiables, hay que evaluar el proceso; asignación aleatoria). Es el ejemplo para probar el patrón de escritura (CER por defecto).
- **Foro escrito** (3): «¿Ha sido útil la formación en investigación?», «¿Debe usarse la inteligencia artificial en la universidad?» y «La naranja mecánica» (este último con criterios adicionales).
- **Control de lectura** (2): «¿Para qué sirve investigar?» (en español) y «Writing task: Rebuild the Results Section» (en inglés, con estructura de sección de resultados). Ver `14-control-de-lectura.md`.

## Flujo de creación (wizard para el profesor)

1. Tema, pregunta guía, objetivo, instrucciones para estudiantes.
2. Posturas disponibles y modo de asignación.
3. Ejemplos buenos/malos para Groq (el sistema puede sugerir un borrador inicial que el profesor edita).
4. Rondas y límites de argumentos (con la tabla de puntaje precargada por defecto, editable).
5. Reglas de co-moderación (número auto-calculado visible, override manual opcional).
6. Revisión final → se genera un `programId` y un código/link de sesión para compartir con los estudiantes.

## Cómo el runtime lee el Programa

El motor de cada actividad (`src/actividades/*/motorDelDebateHablado.js`, `motorDelForo.js`, `motorDelControlDeLectura.js`) consulta el Programa activo antes de aplicar la regla correspondiente. El motor de eventos es genérico; el Programa es el dato que lo parametriza. Así, un mismo motor sirve para cualquier tema o curso sin tocar el código de la aplicación. Lo que el moderador cambia en la configuración de la sala (posturas tildadas, perfil de puntaje, idioma, moderación, integridad, criterios, patrón, modo de ahorro) **se fusiona sobre el Programa** en `src/host/programaDeLaSesion.js` y esa versión es la que se publica a la sala.

## Qué campos lee el código

Comprobado con `grep` sobre `src/` y `api/` (17-oct-2026). **Leídos** = alguna parte del código los usa para decidir algo. **Informativos** = están en los JSON de ejemplo y en este esquema, pero ningún código los lee: cambiarlos no cambia el comportamiento.

| Leídos por el código | Informativos (no cambian nada hoy) |
|---|---|
| `actividad`, `idioma`, `titulo`, `categoria`, `temaCentral`, `preguntaGuia`, `instruccionesParaEstudiantes`, `ejemplosPorTema`, `version`, `programId` | `creadoPor`, `fechaCreacion`, `objetivoAprendizaje`, `duracionTotalEstimada`, `canalAbly` (el canal sale del código de sala) |
| `posturas` (incl. `esMatizada`), `asignacionPostura` | `permiteCambioPostura` (el cambio se decide por `asignacionPostura === "libre"`) |
| `fases` (se leen `tipo`, `ronda` y `duracionMin`) | `limiteArgumentos`, `priorizarPosturas`, `disparadoPor`, `ventanaAbierta` (el límite lo da el perfil de puntaje; la priorización de Ronda 1 siempre está activa; el moderador siempre dispara las sugerencias) |
| `perfilDePuntaje`, `valoresBasePosicion`, `descuentoRonda2`, `descuentoViaCoModerador` (los tres sueltos solo si no hay perfil) | `puntajeCoModerador`, `visualizacionRanking`, `tiers` (los tiers salen de cortes por percentil, `calcularTierPorPercentil`), `maxIntentosGroqPorArgumento` |
| `timeoutAceptacion`, `maxRechazosAntesDeForzar`, `tiempoLimiteEvaluacionBid` | `mecanismoTurno`, `duracionMaximaIntervencionPrincipal`, `duracionMaximaIntervencionBid` (no hay cuenta regresiva de intervención en la consola), `maxConexionesSalientesPorArgumento`, `requiereSeleccionDeTipo` (la regla de 1 conexión saliente por argumento está fija en el código) |
| `moderacion` (`modo`, `numeroFijo`, `minimoParaCoModerar`), `topeMaximoCoModeradores` | `formulaCoModeradores`, `exclusionMutua` |
| `limitesDePuntaje`, `integridad`, `criteriosAdicionales`, `patronDeArgumento`, `modoDeAhorro` | `criterioValidacion`, `promptSistemaFase1`, `promptSistemaFase2` (los prompts viven en `api/`) |
| | `exportaJSON`, `exportaPDF` (solo aparecen en comentarios: lo que se exporta lo decide `exportarSesion.js`, siempre igual) |
| Control de lectura: `consigna`, `estructura`, `distribucion`, `numeroDeParrafos`, `rubrica`, `revisionDePares`, `ventanaDeConfirmacionMin`, `clavesDeLaLectura` | |

Si algún día un campo informativo pasa a leerse, se mueve de columna y se documenta su efecto aquí.
