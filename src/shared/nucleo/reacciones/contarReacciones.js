// Reacciones a los aportes — ver docs/13-foro-escrito-y-nucleo-reutilizable.md. Funciones puras e
// independientes de la actividad.

import { TIPOS_DE_REACCION } from '../../eventos/nombresDeEventos.js';

export const ETIQUETA_DE_REACCION = {
  [TIPOS_DE_REACCION.ME_CONVENCIO]: 'Me convenció',
  [TIPOS_DE_REACCION.ME_HIZO_DUDAR]: 'Me hizo dudar',
  [TIPOS_DE_REACCION.APORTA_EVIDENCIA]: 'Aporta evidencia',
};

export const ICONO_DE_REACCION = {
  [TIPOS_DE_REACCION.ME_CONVENCIO]: '✅',
  [TIPOS_DE_REACCION.ME_HIZO_DUDAR]: '🤔',
  [TIPOS_DE_REACCION.APORTA_EVIDENCIA]: '📎',
};

export function contarReaccionesDeUnAporte(estado, argumentId) {
  const conteo = Object.fromEntries(Object.values(TIPOS_DE_REACCION).map((tipo) => [tipo, 0]));
  for (const tipo of Object.values(estado.reacciones?.[argumentId] ?? {})) {
    if (tipo in conteo) {
      conteo[tipo] += 1;
    }
  }
  return conteo;
}

export function reaccionDeParticipante(estado, argumentId, participantId) {
  return estado.reacciones?.[argumentId]?.[participantId] ?? null;
}

// «Me convenció» de alguien que defiende la postura CONTRARIA a la de quien escribió: mover a
// alguien al otro lado es lo más difícil de un debate. Se cuenta y se muestra al moderador y en el
// informe; no da puntos en la v1 (es manipulable entre amigos de bandos opuestos). Con posturas
// matizadas no hay un «lado contrario» claro: solo cuenta cuando ambas están definidas y difieren.
export function contarConvencimientoCruzado(estado, argumentId) {
  const aporte = estado.argumentos?.[argumentId];
  if (!aporte?.stanceId) {
    return 0;
  }
  return Object.entries(estado.reacciones?.[argumentId] ?? {}).filter(([participantId, tipo]) => {
    const posturaDeQuienReacciona = estado.participantes?.[participantId]?.stanceId;
    return tipo === TIPOS_DE_REACCION.ME_CONVENCIO && posturaDeQuienReacciona && posturaDeQuienReacciona !== aporte.stanceId;
  }).length;
}

export function resumirReaccionesDelForo(estado) {
  const totalPorTipo = Object.fromEntries(Object.values(TIPOS_DE_REACCION).map((tipo) => [tipo, 0]));
  let convencimientoCruzado = 0;
  for (const argumentId of Object.keys(estado.reacciones ?? {})) {
    for (const [tipo, cantidad] of Object.entries(contarReaccionesDeUnAporte(estado, argumentId))) {
      totalPorTipo[tipo] += cantidad;
    }
    convencimientoCruzado += contarConvencimientoCruzado(estado, argumentId);
  }
  return { totalPorTipo, convencimientoCruzado };
}
