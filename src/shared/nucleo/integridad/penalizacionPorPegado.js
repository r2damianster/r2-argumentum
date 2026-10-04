// Penalización por pegado del control de lectura — ver docs/14-control-de-lectura.md.
//
// Reglas (decididas por el docente): se avisa a la persona APENAS pega, mientras escribe; borrar lo pegado no
// borra el antecedente (se conserva un porcentaje); el estudiante ve solo un color de rojo a verde, nunca el
// número ni el descuento; el descuento es automático y el docente puede revertirlo. Funciones puras.

import { CONTEXTOS_DE_REDACCION } from './canalPrivado.js';
import { integridadEstaActiva } from './nivelesDeIntegridad.js';

export const DESCUENTO_MAXIMO_POR_PEGADO_POR_DEFECTO = 5;
export const DESCUENTO_MAXIMO_PERMITIDO = 10;
// Desde esta proporción pegada el indicador ya está en rojo.
export const PROPORCION_PEGADA_EN_ROJO = 0.6;

export function normalizarPenalizacionPorPegado(penalizacion) {
  const maximo = Number(penalizacion?.descuentoMaximo);
  return {
    activa: penalizacion?.activa !== false,
    descuentoMaximo:
      Number.isFinite(maximo) && maximo > 0 ? Math.min(DESCUENTO_MAXIMO_PERMITIDO, Math.round(maximo * 100) / 100) : DESCUENTO_MAXIMO_POR_PEGADO_POR_DEFECTO,
  };
}

// Solo hay penalización con la integridad encendida (con «restrictiva» no se puede pegar, así que no llega).
export function penalizacionPorPegadoEstaActiva(programa) {
  return integridadEstaActiva(programa) && normalizarPenalizacionPorPegado(programa?.penalizacionPorPegado).activa;
}

export function calcularDescuentoPorPegado(proporcion, penalizacion) {
  const { activa, descuentoMaximo } = normalizarPenalizacionPorPegado(penalizacion);
  if (!activa || !(proporcion > 0)) {
    return 0;
  }
  return Math.round(Math.min(1, proporcion) * descuentoMaximo * 100) / 100;
}

// Color del indicador que ve el estudiante: de verde (0) a rojo (PROPORCION_PEGADA_EN_ROJO o más), pasando
// por amarillo. La curva es suave al principio para que un residuo pequeño (por ejemplo, tras borrar lo
// pegado) se vea todavía verde y se distinga bien de un pegado fuerte. Devuelve un tono HSL; no hay número.
export function colorDelIndicadorDePegado(proporcion) {
  const avance = Math.min(1, Math.max(0, proporcion / PROPORCION_PEGADA_EN_ROJO)) ** 1.5;
  const tono = Math.round(120 * (1 - avance));
  return `hsl(${tono}, 75%, 42%)`;
}

// A partir de lo que publicó cada estudiante por el canal privado de integridad: el descuento automático de
// cada persona. Con varios mensajes de una misma persona vale el de mayor proporción.
export function calcularDescuentosAutomaticosPorPegado({ registros, programa }) {
  if (!penalizacionPorPegadoEstaActiva(programa)) {
    return {};
  }
  const mayorProporcion = {};
  for (const registro of registros) {
    if (registro.contexto !== CONTEXTOS_DE_REDACCION.ENTREGA_DE_LECTURA) {
      continue;
    }
    const proporcion = Number(registro.proporcionPenalizada) || 0;
    mayorProporcion[registro.participantId] = Math.max(mayorProporcion[registro.participantId] ?? 0, proporcion);
  }
  const descuentos = {};
  for (const [participantId, proporcion] of Object.entries(mayorProporcion)) {
    const descuento = calcularDescuentoPorPegado(proporcion, programa?.penalizacionPorPegado);
    if (descuento > 0) {
      descuentos[participantId] = descuento;
    }
  }
  return descuentos;
}
