// Cola de revisión de aportes — ver docs/13-foro-escrito-y-nucleo-reutilizable.md. Funciones puras e
// independientes de la actividad: deciden QUÉ aportes le toca revisar a cada co-moderador y cuáles
// necesitan la atención del moderador.
//
// Reparto: cada aporte se asigna a 2 co-moderadores por un hash estable (todos los dispositivos
// llegan al mismo reparto sin intercambiar mensajes), y cualquiera puede revisar más. La cola sube
// primero lo que la IA marcó (incompleto, sin razón o con una posible falacia). La IA solo ordena:
// no decide nada.

import { asignarRevisores, calcularMediana, resolverNivelFinalDeRevision } from './calcularPuntajeDeRevisores.js';
import { sugerenciaMerecePrioridad } from '../sugerenciaDeIA/etiquetasDeSugerencia.js';
import { NIVELES_DE_REVISION_DE_APORTE } from '../../puntaje/puntajeDeAportes.js';

export const REVISORES_POR_APORTE = 2;

export const FILTROS_DE_LA_COLA_DEL_MODERADOR = {
  TODOS: 'todos',
  MARCADOS: 'marcados',
  SIN_DECIDIR: 'sin_decidir',
};

function idsDeCoModeradores(estado) {
  return (estado.coModeradores?.participantIds ?? []).filter(
    (participantId) => estado.participantes[participantId]?.rol === 'co_moderador'
  );
}

function aportesRevisables(estado) {
  return Object.values(estado.argumentos ?? {}).filter((aporte) => !aporte.oculto);
}

const porMarcaYAntiguedad = (itemA, itemB) => {
  if (itemA.prioridad !== itemB.prioridad) {
    return itemA.prioridad ? -1 : 1;
  }
  return (itemA.aporte.timestamp ?? 0) - (itemB.aporte.timestamp ?? 0);
};

// Lo que le queda por revisar a un co-moderador: sus asignados primero; con `soloLosMios: false`
// también ve los demás (para quien termina pronto y quiere seguir ayudando).
export function listarAportesParaRevisar(
  estado,
  { revisorId, soloLosMios = true, revisoresPorAporte = REVISORES_POR_APORTE }
) {
  const coModeradores = idsDeCoModeradores(estado);
  return aportesRevisables(estado)
    .filter((aporte) => aporte.participantId !== revisorId)
    .filter((aporte) => estado.revisiones?.[aporte.argumentId]?.niveles?.[revisorId] === undefined)
    .map((aporte) => ({
      aporte,
      asignadoAMi: asignarRevisores(aporte.argumentId, coModeradores, revisoresPorAporte).includes(revisorId),
      prioridad: sugerenciaMerecePrioridad(aporte.sugerenciaDeIA),
    }))
    .filter((item) => !soloLosMios || item.asignadoAMi)
    .sort((itemA, itemB) => {
      if (itemA.asignadoAMi !== itemB.asignadoAMi) {
        return itemA.asignadoAMi ? -1 : 1;
      }
      return porMarcaYAntiguedad(itemA, itemB);
    });
}

// Los aportes que ya revisó este co-moderador, con su voto (para poder cambiarlo).
export function listarAportesYaRevisados(estado, { revisorId }) {
  return aportesRevisables(estado)
    .filter((aporte) => estado.revisiones?.[aporte.argumentId]?.niveles?.[revisorId] !== undefined)
    .map((aporte) => ({ aporte, miNivel: estado.revisiones[aporte.argumentId].niveles[revisorId] }))
    .sort((itemA, itemB) => (itemB.aporte.timestamp ?? 0) - (itemA.aporte.timestamp ?? 0));
}

// Cómo va la revisión de un aporte, sin decir quién votó qué: solo conteos y el nivel que rige.
export function resumirRevisionDeUnAporte(estado, argumentId) {
  const revision = estado.revisiones?.[argumentId] ?? { niveles: {}, decisionModerador: null };
  const niveles = Object.values(revision.niveles);
  const votos = {
    cuenta: niveles.filter((nivel) => nivel === NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO).length,
    parcial: niveles.filter((nivel) => nivel === NIVELES_DE_REVISION_DE_APORTE.PARCIAL).length,
    noCuenta: niveles.filter((nivel) => nivel === NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA).length,
  };
  const { nivel: nivelQueRige, descartada, delModerador } = resolverNivelFinalDeRevision({
    nivelesPorRevisor: revision.niveles,
    decisionDelModerador: revision.decisionModerador,
  });
  return {
    votos,
    totalDeVotos: niveles.length,
    nivelDeConsenso: calcularMediana(niveles),
    // Los co-moderadores no coinciden entre sí: el caso más útil para que el moderador mire.
    hayDiscrepancia: new Set(niveles).size > 1,
    decisionModerador: revision.decisionModerador,
    nivelQueRige,
    descartada,
    delModerador,
  };
}

export function listarAportesParaElModerador(estado, { filtro = FILTROS_DE_LA_COLA_DEL_MODERADOR.TODOS } = {}) {
  return aportesRevisables(estado)
    .map((aporte) => {
      const resumen = resumirRevisionDeUnAporte(estado, aporte.argumentId);
      return {
        aporte,
        resumen,
        prioridad: sugerenciaMerecePrioridad(aporte.sugerenciaDeIA) || resumen.hayDiscrepancia,
        sinDecidir: !resumen.decisionModerador,
      };
    })
    .filter((item) => {
      if (filtro === FILTROS_DE_LA_COLA_DEL_MODERADOR.MARCADOS) {
        return item.prioridad;
      }
      if (filtro === FILTROS_DE_LA_COLA_DEL_MODERADOR.SIN_DECIDIR) {
        return item.sinDecidir;
      }
      return true;
    })
    .sort((itemA, itemB) => {
      if (itemA.sinDecidir !== itemB.sinDecidir) {
        return itemA.sinDecidir ? -1 : 1;
      }
      return porMarcaYAntiguedad(itemA, itemB);
    });
}
