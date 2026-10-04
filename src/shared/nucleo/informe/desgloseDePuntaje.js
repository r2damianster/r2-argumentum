// Desglose del puntaje final — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// El informe antes mostraba solo el total de cada persona. Aquí se explica DE DÓNDE sale cada punto,
// a partir de los `score.updated` del log (que es la fuente de verdad del puntaje). Función pura e
// independiente de la actividad: agrupa los movimientos por su motivo.

import { EVENTOS } from '../../eventos/nombresDeEventos.js';

export const TIPOS_DE_MOVIMIENTO = {
  APORTES: 'aportes',
  REVISION: 'revision',
  CO_MODERACION: 'coModeracion',
  TURNO_HABLADO: 'turnoHablado',
  PENALIDAD: 'penalidad',
  OTROS: 'otros',
};

export const ETIQUETA_DEL_TIPO_DE_MOVIMIENTO = {
  [TIPOS_DE_MOVIMIENTO.APORTES]: 'Aportes publicados',
  [TIPOS_DE_MOVIMIENTO.REVISION]: 'Ajustes por revisión o exposición',
  [TIPOS_DE_MOVIMIENTO.CO_MODERACION]: 'Co-moderación',
  [TIPOS_DE_MOVIMIENTO.TURNO_HABLADO]: 'Intervenciones habladas',
  [TIPOS_DE_MOVIMIENTO.PENALIDAD]: 'Penalidades',
  [TIPOS_DE_MOVIMIENTO.OTROS]: 'Otros',
};

// Los motivos los escribe el motor (motorDeSesion.js y las actividades); se reconocen por su inicio.
export function clasificarMovimientoDePuntaje({ motivo = '', categoria = '' }) {
  if (categoria === 'co_moderacion') {
    return TIPOS_DE_MOVIMIENTO.CO_MODERACION;
  }
  if (/^(Post|Réplica|Argumento posición)/.test(motivo)) {
    return TIPOS_DE_MOVIMIENTO.APORTES;
  }
  if (/^(Revisión|Aporte oculto|Exposición)/.test(motivo)) {
    return TIPOS_DE_MOVIMIENTO.REVISION;
  }
  if (/^Intervención hablada/.test(motivo)) {
    return TIPOS_DE_MOVIMIENTO.TURNO_HABLADO;
  }
  if (/^Rechazó el turno/.test(motivo)) {
    return TIPOS_DE_MOVIMIENTO.PENALIDAD;
  }
  return TIPOS_DE_MOVIMIENTO.OTROS;
}

function crearSubtotalesVacios() {
  return Object.fromEntries(Object.values(TIPOS_DE_MOVIMIENTO).map((tipo) => [tipo, 0]));
}

// Devuelve, por participante: sus movimientos, los subtotales por tipo, el total nominal (suma de
// todos los movimientos) y el total final (el que quedó en el marcador: nunca baja de cero, así que
// puede ser mayor que el nominal si una penalidad lo hubiera dejado en deuda).
export function calcularDesgloseDePuntaje(eventos) {
  const desglose = {};
  for (const evento of eventos) {
    if (evento.name !== EVENTOS.PUNTAJE_ACTUALIZADO || !evento.data?.participantId) {
      continue;
    }
    const { participantId, delta = 0, motivo = '', categoria = '', nuevoTotal } = evento.data;
    if (!desglose[participantId]) {
      desglose[participantId] = { movimientos: [], subtotales: crearSubtotalesVacios(), totalNominal: 0, totalFinal: 0 };
    }
    const tipo = clasificarMovimientoDePuntaje({ motivo, categoria });
    desglose[participantId].movimientos.push({ motivo, categoria, tipo, delta });
    desglose[participantId].subtotales[tipo] += delta;
    desglose[participantId].totalNominal += delta;
    if (typeof nuevoTotal === 'number') {
      desglose[participantId].totalFinal = nuevoTotal;
    }
  }
  return desglose;
}
