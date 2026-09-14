// Carga y valida un Programa de Debate (plantilla JSON) — ver docs/03-programa-de-debate.md.

const CAMPOS_OBLIGATORIOS = ['programId', 'titulo', 'temaCentral', 'posturas', 'fases'];

export function cargarPrograma(textoJson) {
  let programa;
  try {
    programa = JSON.parse(textoJson);
  } catch (error) {
    throw new Error('El archivo del Programa no es un JSON válido.');
  }

  const camposFaltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !(campo in programa));
  if (camposFaltantes.length > 0) {
    throw new Error(`Programa inválido, faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
  }

  if (!Array.isArray(programa.posturas) || programa.posturas.length < 2) {
    throw new Error('El Programa debe definir al menos 2 posturas.');
  }

  return programa;
}

export function exportarPrograma(programa) {
  return JSON.stringify(programa, null, 2);
}
