// Fórmula única de puntaje — ver docs/05-reglas-de-puntaje.md.
// Si se ajusta un valor, se ajusta aquí o en el perfil (perfilesDePuntaje.js). No parchear
// casos sueltos en otros archivos.

import { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO, resolverParametrosDePuntaje } from './perfilesDePuntaje.js';

export { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO, resolverParametrosDePuntaje };

const PARAMETROS_POR_DEFECTO = PERFILES_DE_PUNTAJE[PERFIL_POR_DEFECTO];

// valor = valor_base(posición) × descuento_ronda × descuento_vía
export function calcularPuntajeDeArgumento(
  { posicionEnRonda, ronda, viaCoModerador = false },
  parametros = PARAMETROS_POR_DEFECTO
) {
  const valorBase = parametros.valoresBasePosicion[posicionEnRonda - 1];
  if (valorBase === undefined) {
    throw new Error(`Posición de argumento inválida: ${posicionEnRonda}`);
  }

  let puntaje = valorBase;
  if (ronda === 2) {
    puntaje *= parametros.descuentoRonda2;
  }
  if (viaCoModerador) {
    puntaje *= parametros.descuentoViaCoModerador;
  }

  return Math.max(1, Math.round(puntaje));
}

// Intervención hablada sin argumento escrito (ver docs/04): vale como la posición de menor
// valor con el descuento de vía aplicado. Sale de la misma fórmula en vez de ser un número
// suelto, para que escale sola con el perfil elegido.
export function calcularPuntajeDeTurnoVerbal(parametros = PARAMETROS_POR_DEFECTO) {
  const ultimaPosicion = parametros.valoresBasePosicion.length;
  return calcularPuntajeDeArgumento(
    { posicionEnRonda: ultimaPosicion, ronda: 1, viaCoModerador: true },
    parametros
  );
}

// Rechazar un turno cuesta puntos y se le avisa al estudiante antes de confirmar (docs/04).
export function calcularPenalidadPorRechazoDeTurno(parametros = PARAMETROS_POR_DEFECTO) {
  return -Math.abs(parametros.penalidadPorRechazoDeTurno);
}

export function calcularTierPorPercentil(percentil) {
  if (percentil >= 66.6) return 'Sólido';
  if (percentil >= 33.3) return 'Consistente';
  return 'En desarrollo';
}
