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

export function calcularNumeroDeCoModeradores(totalDeParticipantes, topeMaximo = null) {
  const numeroCalculado = Math.max(1, Math.ceil(totalDeParticipantes * 0.1));
  return topeMaximo ? Math.min(numeroCalculado, topeMaximo) : numeroCalculado;
}

// Los bonos de co-moderación escalan con el perfil: docs/05 pide que el rol sea comparable en
// valor al de argumentar, no un premio de consolación. Con escala de miles, un +8 fijo sería
// ruido estadístico.
const BONOS_BASE_DE_COMODERADOR = {
  CASO_ESCALADO_RATIFICADO: 8,
  FALTA_DETECTADA_CON_JUSTIFICACION: 6,
  RECLASIFICACION_CORRECTA: 5,
  VOTO_DE_BID_COINCIDENTE: 5,
  FEEDBACK_USADO_PARA_REFORMULAR: 4,
  CONSISTENCIA_EN_REVISION_CRUZADA: 3,
  FALTA_SIN_JUSTIFICAR_O_REVERTIDA: -5,
};

export function calcularBonosDeCoModerador(parametros = PARAMETROS_POR_DEFECTO) {
  const factor = parametros.factorDeBonosDeCoModeracion;
  return Object.fromEntries(
    Object.entries(BONOS_BASE_DE_COMODERADOR).map(([clave, valor]) => [clave, valor * factor])
  );
}

export const PUNTAJE_DE_COMODERADOR = BONOS_BASE_DE_COMODERADOR;

export function calcularTierPorPercentil(percentil) {
  if (percentil >= 66.6) return 'Sólido';
  if (percentil >= 33.3) return 'Consistente';
  return 'En desarrollo';
}
