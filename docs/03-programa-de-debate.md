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
  // opcional: postura "Matizada / condicional"
]
asignacionPostura: "libre" | "aleatoria" | "por_grupo"
permiteCambioPostura: boolean   // habilita mecánica "defiende lo contrario" (fase futura)
```

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
valoresBasePosicion: [10, 8, 3]        // 1er, 2do, 3er argumento
descuentoRonda2: 0.7
descuentoViaCoModerador: 0.5
maxIntentosGroqPorArgumento: 2
puntajeCoModerador: { ... }            // ver 05-reglas-de-puntaje.md
visualizacionRanking: "por_postura_con_tiers" | "numerico_global" | "sin_ranking"
tiers: ["Sólido", "Consistente", "En desarrollo"]
```

### F. Reglas de turno

```
mecanismoTurno: "ruleta_ponderada"     // pesa por quién ha hablado menos
timeoutAceptacion: 20                  // segundos antes de reintentar con otro
maxRechazosAntesDeForzar: 3            // tras N rechazos, la oferta ya no se puede rechazar
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
exportaPDF: opcional                    // mapa de evolución argumentativa del debate
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
