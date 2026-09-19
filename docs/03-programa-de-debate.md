# Programa de Debate — esquema de configuración

## Qué es

La plantilla que el moderador (profesor) llena **antes** de abrir una sesión en vivo. Es reutilizable entre cursos o paralelos (mismo tema, distinto grupo de estudiantes). Todo lo que hace el motor de tiempo real (Ably + Groq) durante el debate lee sus reglas desde aquí — nada de valores hardcodeados en el código de la aplicación.

En v1, un Programa se guarda y se carga como un **archivo JSON exportable/importable** — sin necesidad de backend ni base de datos. El profesor puede guardar su "plan de debate" igual que guardaría un plan de clase, y reutilizarlo en otro paralelo.

## Esquema completo

### A. Identificación

```
programId, titulo, version, creadoPor, fechaCreacion
```

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
asignacionPostura: "libre" | "aleatoria" | "por_grupo"
                                // "aleatoria" reparte por turnos entre quienes están en la sala
                                // (la postura menos representada), no sortea a ciegas: con 8
                                // ingresando a la vez los bandos quedan con 1 de diferencia como máximo
permiteCambioPostura: boolean   // habilita mecánica "defiende lo contrario" (fase futura)
```

Las posturas de un Programa son **candidatas**: al iniciar la sesión el moderador tilda cuáles se debaten (mínimo 2). Un Programa puede traer más de 3 (el de Filosofía trae 12).

### C.1 Ajustes de sesión que fija el moderador en la sala de espera

No hace falta que vengan en el JSON (pero pueden venir como valor por defecto). Se republican al canal **en vivo mientras la sala está en espera**, porque los estudiantes ingresan antes de que el moderador arranque:

```
perfilDePuntaje: "liviano" | "estandar" | "estricto"   // ver 05-reglas-de-puntaje.md
permitirPosturasNuevas: boolean                         // por defecto false
posturas: [ ...solo las tildadas... ]
```

Con `permitirPosturasNuevas: true`, si Groq detecta que el argumento no defiende ninguna postura de la lista, el estudiante puede proponer la suya; si el moderador la acepta se suma a `posturas` y se le asigna a quien la propuso. Con `false`, el estudiante debe reescribir su argumento para una postura existente.

### D. Estructura de fases

```
fases: [
  { tipo: "escritura_argumentos", ronda: 1, limiteArgumentos: 3, duracionMin },
  { tipo: "escritura_argumentos", ronda: 2, limiteArgumentos: "segun_ronda_1", duracionMin },
  { tipo: "conexion_sugerida", disparadoPor: "moderador" },
  { tipo: "conexion_libre", ventanaAbierta: "toda_la_sesion" },
  { tipo: "cierre_y_ranking" }
]
```

Cada fase tiene inicio y fin controlado explícitamente por el moderador — evita descontrol y llamadas a Groq impredecibles.

### E. Reglas de puntaje

Ver el detalle completo de la fórmula en `05-reglas-de-puntaje.md`. Aquí solo se referencian los parámetros configurables:

```
valoresBasePosicion: [10, 8, 3]        // 1er, 2do, 3er argumento (escala Liviana; el perfil de
                                        // puntaje elegido por el moderador la reemplaza y la
                                        // escala manteniendo la proporción 10:8:3)
descuentoRonda2: 0.7
descuentoViaCoModerador: 0.5
maxIntentosGroqPorArgumento: 2
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
formulaCoModeradores: "ceil(n * 0.10)_min_1"
topeMaximoCoModeradores: null | number  // override opcional para grupos grandes
exclusionMutua: true                    // un co-moderador sorteado no argumenta en la misma sesión
```

### J. Exportación al cierre

```
exportaJSON: { eventLogCompleto, mapaArgumental, rankingPorPostura, perfilPorEstudiante }
exportaPDF: opcional                    // informe imprimible: el botón "Generar PDF del debate" abre la
                                        // impresión del navegador (window.print + CSS @media print)
```

### K. Configuración técnica

```
canalAbly: "debate:{programId}:{sessionId}"
duracionTotalEstimada
```

## Flujo de creación (wizard para el profesor)

1. Tema, pregunta guía, objetivo, instrucciones para estudiantes.
2. Posturas disponibles y modo de asignación.
3. Ejemplos buenos/malos para Groq (el sistema puede sugerir un borrador inicial que el profesor edita).
4. Rondas y límites de argumentos (con la tabla de puntaje precargada por defecto, editable).
5. Reglas de co-moderación (número auto-calculado visible, override manual opcional).
6. Revisión final → se genera un `programId` y un código/link de sesión para compartir con los estudiantes.

## Cómo el runtime lee el Programa

Cada evento del motor (`turn.offered`, `argument.submitted`, `link.created`, `argument.validated`) consulta el Programa activo antes de aplicar la regla correspondiente. El motor de eventos es genérico; el Programa es el dato que lo parametriza. Así, un mismo motor sirve para cualquier tema o curso sin tocar el código de la aplicación.
