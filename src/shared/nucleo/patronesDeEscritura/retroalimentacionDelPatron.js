// Qué se hace con lo que la IA detectó del patrón de escritura (ver patronDeArgumento.js).
//
// La IA solo sugiere. Con retroalimentación (práctica) se le dice a quien escribe qué parte falta; sin
// retroalimentación (evaluación) a quien escribe no se le muestra nada y solo el moderador recibe el registro.

// Lo que se manda a la llamada de validación: nombre del patrón y sus partes, ya en el idioma del debate.
export function patronParaLaIA(patronActivo) {
  if (!patronActivo) {
    return null;
  }
  return {
    nombre: patronActivo.estructura.nombre,
    partes: patronActivo.estructura.partes.map((parte) => ({ nombre: parte.nombre, descripcion: parte.descripcion })),
  };
}

// Mensaje para quien escribe. Vacío si no corresponde mostrarlo: patrón apagado, modo evaluación, la IA no
// pudo (o dudó) o ya están todas las partes.
export function mensajeDeRetroalimentacionDelPatron(patronActivo, patronDetectado) {
  if (!patronActivo?.daRetroalimentacion || !patronDetectado || patronDetectado.partesFaltantes.length === 0) {
    return '';
  }
  const total = patronDetectado.partesPresentes.length + patronDetectado.partesFaltantes.length;
  return `Sugerencia sobre ${patronDetectado.nombre}: tu argumento usa ${patronDetectado.partesPresentes.length} de ${total} partes. Te falta: ${patronDetectado.partesFaltantes.join(', ')}. Puedes enviarlo igual.`;
}

// Registro que se le entrega al moderador (en ambos modos). Null si la IA no tiene nada que afirmar.
export function registroDelPatronParaElModerador(patronActivo, patronDetectado) {
  if (!patronActivo || !patronDetectado) {
    return null;
  }
  return {
    modo: patronActivo.modo,
    estructura: patronActivo.estructura.id,
    nombre: patronDetectado.nombre,
    partesPresentes: patronDetectado.partesPresentes,
    partesFaltantes: patronDetectado.partesFaltantes,
  };
}

// Carga para el canal privado del moderador, lista para publicar junto a un argumento ya aprobado.
// Null si no hay nada que decir (patrón apagado o la IA no pudo/dudó).
export function cargaDelPatronParaElModerador(patronActivo, patronDetectado, argumentId) {
  const registro = registroDelPatronParaElModerador(patronActivo, patronDetectado);
  return registro && argumentId ? { ...registro, argumentId } : null;
}
