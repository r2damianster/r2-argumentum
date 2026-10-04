import { describe, expect, it } from 'vitest';
import {
  FILTROS_DE_LA_COLA_DEL_MODERADOR,
  listarAportesParaElModerador,
  listarAportesParaRevisar,
  listarAportesYaRevisados,
  resumirRevisionDeUnAporte,
} from './colaDeRevision.js';

const SUGERENCIA_COMPLETA = { completitud: 'completo', falacias: [] };
const SUGERENCIA_MARCADA = { completitud: 'incompleto', falacias: [] };

function crearEstado({ aportes, revisiones = {}, coModeradores = ['carla', 'diego', 'elena'] }) {
  return {
    participantes: Object.fromEntries([
      ['ana', { participantId: 'ana', rol: 'participante' }],
      ['luis', { participantId: 'luis', rol: 'participante' }],
      ...coModeradores.map((participantId) => [participantId, { participantId, rol: 'co_moderador' }]),
    ]),
    coModeradores: { participantIds: coModeradores },
    argumentos: Object.fromEntries(aportes.map((aporte) => [aporte.argumentId, { timestamp: 0, ...aporte }])),
    revisiones,
  };
}

describe('listarAportesParaRevisar', () => {
  const aportes = Array.from({ length: 12 }, (_, indice) => ({
    argumentId: `aporte-${indice}`,
    participantId: indice % 2 === 0 ? 'ana' : 'luis',
    timestamp: indice,
    sugerenciaDeIA: indice === 7 ? SUGERENCIA_MARCADA : SUGERENCIA_COMPLETA,
  }));
  const estado = crearEstado({ aportes });

  it('cada aporte se asigna a 2 de los 3 co-moderadores', () => {
    const asignadosPorAporte = {};
    for (const revisorId of ['carla', 'diego', 'elena']) {
      for (const item of listarAportesParaRevisar(estado, { revisorId })) {
        asignadosPorAporte[item.aporte.argumentId] = (asignadosPorAporte[item.aporte.argumentId] ?? 0) + 1;
      }
    }
    expect(Object.keys(asignadosPorAporte)).toHaveLength(12);
    expect(Object.values(asignadosPorAporte).every((cantidad) => cantidad === 2)).toBe(true);
  });

  it('con soloLosMios en falso aparecen todos, con los asignados primero', () => {
    const todos = listarAportesParaRevisar(estado, { revisorId: 'carla', soloLosMios: false });
    expect(todos).toHaveLength(12);
    const primerosNoAsignados = todos.findIndex((item) => !item.asignadoAMi);
    expect(todos.slice(0, primerosNoAsignados).every((item) => item.asignadoAMi)).toBe(true);
  });

  it('lo que la IA marcó sube en la cola, entre los asignados', () => {
    const asignados = listarAportesParaRevisar(estado, { revisorId: 'carla' });
    const indiceDelMarcado = asignados.findIndex((item) => item.aporte.argumentId === 'aporte-7');
    if (indiceDelMarcado !== -1) {
      expect(indiceDelMarcado).toBe(0);
    }
    const todos = listarAportesParaRevisar(estado, { revisorId: 'carla', soloLosMios: false });
    expect(todos.find((item) => item.aporte.argumentId === 'aporte-7').prioridad).toBe(true);
  });

  it('no incluye los aportes ya revisados por esa persona, los propios ni los ocultos', () => {
    const conCambios = crearEstado({
      aportes: [
        { argumentId: 'a', participantId: 'ana' },
        { argumentId: 'b', participantId: 'carla' },
        { argumentId: 'c', participantId: 'ana', oculto: true },
        { argumentId: 'd', participantId: 'luis' },
      ],
      revisiones: { d: { niveles: { carla: 1 }, decisionModerador: null } },
    });
    const ids = listarAportesParaRevisar(conCambios, { revisorId: 'carla', soloLosMios: false }).map(
      (item) => item.aporte.argumentId
    );
    expect(ids).toEqual(['a']);
  });
});

describe('listarAportesYaRevisados', () => {
  it('devuelve lo revisado con el voto de esa persona, lo más nuevo primero', () => {
    const estado = crearEstado({
      aportes: [
        { argumentId: 'a', participantId: 'ana', timestamp: 1 },
        { argumentId: 'b', participantId: 'luis', timestamp: 2 },
      ],
      revisiones: {
        a: { niveles: { carla: 0.5 }, decisionModerador: null },
        b: { niveles: { carla: 1, diego: 0 }, decisionModerador: null },
      },
    });
    expect(listarAportesYaRevisados(estado, { revisorId: 'carla' }).map((item) => [item.aporte.argumentId, item.miNivel])).toEqual([
      ['b', 1],
      ['a', 0.5],
    ]);
  });
});

describe('resumirRevisionDeUnAporte', () => {
  it('cuenta los votos sin decir quién votó qué, y marca la discrepancia', () => {
    const estado = crearEstado({
      aportes: [{ argumentId: 'a', participantId: 'ana' }],
      revisiones: { a: { niveles: { carla: 1, diego: 1, elena: 0 }, decisionModerador: null } },
    });
    const resumen = resumirRevisionDeUnAporte(estado, 'a');
    expect(resumen.votos).toEqual({ cuenta: 2, parcial: 0, noCuenta: 1 });
    expect(resumen.hayDiscrepancia).toBe(true);
    expect(resumen.nivelQueRige).toBe(1);
    expect(resumen.delModerador).toBe(false);
  });

  it('con decisión del moderador rige su nivel', () => {
    const estado = crearEstado({
      aportes: [{ argumentId: 'a', participantId: 'ana' }],
      revisiones: { a: { niveles: { carla: 1 }, decisionModerador: { decision: 'evaluada', nivel: 0 } } },
    });
    const resumen = resumirRevisionDeUnAporte(estado, 'a');
    expect(resumen.nivelQueRige).toBe(0);
    expect(resumen.delModerador).toBe(true);
  });

  it('un aporte sin revisiones no tiene votos ni nivel', () => {
    const estado = crearEstado({ aportes: [{ argumentId: 'a', participantId: 'ana' }] });
    const resumen = resumirRevisionDeUnAporte(estado, 'a');
    expect(resumen.totalDeVotos).toBe(0);
    expect(resumen.nivelQueRige).toBeNull();
    expect(resumen.hayDiscrepancia).toBe(false);
  });
});

describe('listarAportesParaElModerador', () => {
  const estado = crearEstado({
    aportes: [
      { argumentId: 'viejo-normal', participantId: 'ana', timestamp: 1, sugerenciaDeIA: SUGERENCIA_COMPLETA },
      { argumentId: 'marcado', participantId: 'luis', timestamp: 2, sugerenciaDeIA: SUGERENCIA_MARCADA },
      { argumentId: 'discrepante', participantId: 'ana', timestamp: 3, sugerenciaDeIA: SUGERENCIA_COMPLETA },
      { argumentId: 'decidido', participantId: 'luis', timestamp: 0, sugerenciaDeIA: SUGERENCIA_MARCADA },
    ],
    revisiones: {
      discrepante: { niveles: { carla: 1, diego: 0 }, decisionModerador: null },
      decidido: { niveles: {}, decisionModerador: { decision: 'evaluada', nivel: 1 } },
    },
  });

  it('sube lo marcado por la IA y lo que divide a los co-moderadores; lo ya decidido va al final', () => {
    const ids = listarAportesParaElModerador(estado).map((item) => item.aporte.argumentId);
    expect(ids).toEqual(['marcado', 'discrepante', 'viejo-normal', 'decidido']);
  });

  it('el filtro «marcados» deja solo lo que merece atención', () => {
    const ids = listarAportesParaElModerador(estado, { filtro: FILTROS_DE_LA_COLA_DEL_MODERADOR.MARCADOS }).map(
      (item) => item.aporte.argumentId
    );
    expect(ids.sort()).toEqual(['decidido', 'discrepante', 'marcado']);
  });

  it('el filtro «sin decidir» oculta lo que el moderador ya resolvió', () => {
    const ids = listarAportesParaElModerador(estado, { filtro: FILTROS_DE_LA_COLA_DEL_MODERADOR.SIN_DECIDIR }).map(
      (item) => item.aporte.argumentId
    );
    expect(ids).not.toContain('decidido');
    expect(ids).toHaveLength(3);
  });
});
