// Carga y valida un Programa de Debate (plantilla JSON) — ver docs/03-programa-de-debate.md.

import {
  esProgramaDeControlDeLectura,
  normalizarProgramaDeLectura,
  validarProgramaDeLectura,
} from '../../actividades/controlDeLectura/programaDeLectura.js';

const CAMPOS_OBLIGATORIOS = ['programId', 'titulo', 'temaCentral', 'fases'];

export function cargarPrograma(textoJson) {
  let programa;
  try {
    programa = JSON.parse(textoJson);
  } catch (error) {
    throw new Error('El archivo del Programa no es un JSON válido.');
  }

  // El control de lectura es una tarea individual: no tiene posturas (ver docs/14-control-de-lectura.md).
  if (esProgramaDeControlDeLectura(programa)) {
    const camposFaltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !(campo in programa));
    if (camposFaltantes.length > 0) {
      throw new Error(`Programa inválido, faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
    }
    const errores = validarProgramaDeLectura(programa);
    if (errores.length > 0) {
      throw new Error(`Programa inválido: ${errores.join(' ')}`);
    }
    return normalizarProgramaDeLectura(programa);
  }

  const camposFaltantes = [...CAMPOS_OBLIGATORIOS, 'posturas'].filter((campo) => !(campo in programa));
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
