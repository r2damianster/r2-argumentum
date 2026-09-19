// Qué sugerencias de Groq se dibujan como arista punteada «(sugerido)» en el mapa.
//
// Cada tanda de sugerencias (al cerrar una fase) vuelve a proponer conexiones sobre todo el pool
// de argumentos, así que dos tandas repiten pares. Dibujar todas dejaba varias aristas
// idénticas encimadas entre los mismos dos nodos (reporte de prueba en vivo: 11 aristas
// «(sugerido)» sobre 3 nodos). Se dibuja una sola por par de argumentos, sin importar el
// sentido, y ninguna si esos dos argumentos ya están conectados de verdad.

function claveDelPar(argumentoUnoId, argumentoDosId) {
  return [argumentoUnoId, argumentoDosId].sort().join('|');
}

export function elegirSugerenciasParaDibujar(sugerencias, conexiones) {
  const paresYaOcupados = new Set(
    conexiones.map((conexion) => claveDelPar(conexion.sourceArgumentId, conexion.targetArgumentId))
  );
  const sugerenciasPendientes = sugerencias.filter((sugerencia) => !sugerencia.resolucion);

  const elegidas = [];
  for (const sugerencia of sugerenciasPendientes) {
    const clave = claveDelPar(sugerencia.sourceArgumentId, sugerencia.targetArgumentId);
    if (paresYaOcupados.has(clave)) {
      continue;
    }
    paresYaOcupados.add(clave);
    elegidas.push(sugerencia);
  }
  return elegidas;
}
