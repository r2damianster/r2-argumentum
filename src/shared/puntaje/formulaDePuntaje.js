// Fórmula única de puntaje — ver docs/05-reglas-de-puntaje.md.
// Si se ajusta un valor, se ajusta aquí. No parchear casos sueltos en otros archivos.

const VALOR_BASE_POR_POSICION = [10, 8, 3]; // índice 0 = posición 1

const DESCUENTO_RONDA_2 = 0.7;
const DESCUENTO_VIA_COMODERADOR = 0.5;

export function calcularPuntajeDeArgumento({ posicionEnRonda, ronda, viaCoModerador = false }) {
  const valorBase = VALOR_BASE_POR_POSICION[posicionEnRonda - 1];
  if (valorBase === undefined) {
    throw new Error(`Posición de argumento inválida: ${posicionEnRonda}`);
  }

  let puntaje = valorBase;
  if (ronda === 2) {
    puntaje *= DESCUENTO_RONDA_2;
  }
  if (viaCoModerador) {
    puntaje *= DESCUENTO_VIA_COMODERADOR;
  }

  return Math.max(1, Math.round(puntaje));
}

export function calcularNumeroDeCoModeradores(totalDeParticipantes, topeMaximo = null) {
  const numeroCalculado = Math.max(1, Math.ceil(totalDeParticipantes * 0.1));
  return topeMaximo ? Math.min(numeroCalculado, topeMaximo) : numeroCalculado;
}

export const PUNTAJE_DE_COMODERADOR = {
  CASO_ESCALADO_RATIFICADO: 8,
  FALTA_DETECTADA_CON_JUSTIFICACION: 6,
  RECLASIFICACION_CORRECTA: 5,
  FEEDBACK_USADO_PARA_REFORMULAR: 4,
  CONSISTENCIA_EN_REVISION_CRUZADA: 3,
  FALTA_SIN_JUSTIFICAR_O_REVERTIDA: -5,
};

export function calcularTierPorPercentil(percentil) {
  if (percentil >= 66.6) return 'Sólido';
  if (percentil >= 33.3) return 'Consistente';
  return 'En desarrollo';
}
