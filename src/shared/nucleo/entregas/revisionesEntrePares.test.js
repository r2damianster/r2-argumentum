import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { EVENTOS, TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from './canalesPrivados.js';
import { construirColaDelDocente, reducirRegistrosPrivados } from './estadoPrivadoDelDocente.js';
import {
  DECISIONES_SOBRE_UNA_REVISION,
  calcularPuntosDeRevisores,
  calcularPuntuacionesDelPodio,
  construirResultadoParaUnRevisor,
  construirRevisionesDeUnAutor,
  contarRevisionesPorAprobar,
  listarRevisionesAprobadasParaElAutor,
  prepararTextosParaRevisar,
} from './revisionesEntrePares.js';

const RUBRICA = [
  { id: 'a', nombre: 'Pertinencia', peso: 50 },
  { id: 'b', nombre: 'Estructura', peso: 50 },
];

// Sala con tres personas que entregaron, en la fase de revisión.
function salaEnRevision(revisionesPublicas = []) {
  const eventos = [
    ...['ana', 'beto', 'carla'].map((id) => ({ name: EVENTOS.INGRESO_CONFIRMADO, data: { participantId: id }, clientId: id })),
    { name: EVENTOS.FASE_INICIADA, data: { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 }, clientId: 'host' },
    ...['ana', 'beto', 'carla'].map((id) => ({
      name: EVENTOS.LECTURA_ENTREGA_REGISTRADA,
      data: { participantId: id, palabras: 50, parrafos: 1, timestamp: 2000 },
      clientId: id,
    })),
    { name: EVENTOS.FASE_CERRADA, data: { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, timestamp: 3000 }, clientId: 'host' },
    { name: EVENTOS.FASE_INICIADA, data: { phaseType: TIPOS_DE_FASE.REVISION_DE_PARES, duracionMin: 10, timestamp: 3100 }, clientId: 'host' },
    ...revisionesPublicas.map(([revisorId, indice]) => ({
      name: EVENTOS.LECTURA_REVISION_ENVIADA,
      data: { participantId: revisorId, indice, timestamp: 3500 },
      clientId: revisorId,
    })),
  ];
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

// Reparto fijo: ana revisa a beto y a carla; beto a carla y a ana; carla a ana y a beto.
const ASIGNACION = {
  nombre: EVENTOS_PRIVADOS.ASIGNACION_DE_PARES,
  asignaciones: { ana: ['beto', 'carla'], beto: ['carla', 'ana'], carla: ['ana', 'beto'] },
};

const textos = ['ana', 'beto', 'carla'].map((id) => ({
  nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO,
  participantId: id,
  texto: `Texto de ${id}`,
  enviadoEn: 1,
}));

function revision(revisorId, indice, niveles, extra = {}) {
  return {
    nombre: EVENTOS_PRIVADOS.ENTREGA_REVISION_PAR,
    participantId: revisorId,
    indice,
    niveles,
    comentariosPorCriterio: { a: `Comentario de ${revisorId}` },
    comentarioGeneral: '',
    enviadoEn: 5,
    ...extra,
  };
}

function calificar(participantId, niveles) {
  return { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId, niveles, aprobada: true, enviadoEn: 9 };
}

describe('estado de la revisión entre pares', () => {
  it('el reparto se hace una sola vez y se queda con el primero', () => {
    const estado = reducirRegistrosPrivados([
      ASIGNACION,
      { nombre: EVENTOS_PRIVADOS.ASIGNACION_DE_PARES, asignaciones: { ana: ['carla'] } },
    ]);
    expect(estado.asignaciones.ana).toEqual(['beto', 'carla']);
  });

  it('la primera revisión de cada índice es la que vale', () => {
    const estado = reducirRegistrosPrivados([revision('ana', 0, { a: 'bueno' }), revision('ana', 0, { a: 'excelente' })]);
    expect(estado.revisionesEnviadas.ana[0].niveles).toEqual({ a: 'bueno' });
  });

  it('la sala solo registra la revisión de quien entregó, en la fase de revisión y una vez por índice', () => {
    expect(salaEnRevision([['ana', 0], ['ana', 0], ['ana', 1]]).lectura.revisiones.ana).toEqual({
      0: { enviadaEn: 3500 },
      1: { enviadaEn: 3500 },
    });
    // Un índice fuera de rango o de alguien que no entregó no entra.
    const estado = salaEnRevision([['ana', 99], ['intruso', 0]]);
    expect(estado.lectura.revisiones).toEqual({});
    // Fuera de la fase de revisión tampoco.
    const fuera = reducirEventos(
      reducirEventos(salaEnRevision(), { name: EVENTOS.FASE_CERRADA, data: { phaseType: TIPOS_DE_FASE.REVISION_DE_PARES }, clientId: 'host' }),
      { name: EVENTOS.LECTURA_REVISION_ENVIADA, data: { participantId: 'ana', indice: 0 }, clientId: 'ana' }
    );
    expect(fuera.lectura.revisiones).toEqual({});
  });
});

describe('textos y revisiones de un autor', () => {
  it('a cada revisor le tocan textos sin el autor, identificados solo por su índice', () => {
    const estadoPrivado = reducirRegistrosPrivados([ASIGNACION, ...textos]);
    expect(prepararTextosParaRevisar({ estadoPrivado, revisorId: 'ana' })).toEqual([
      { indice: 0, texto: 'Texto de beto' },
      { indice: 1, texto: 'Texto de carla' },
    ]);
  });

  it('el autor ve las revisiones registradas por la sala, filtradas por la rúbrica, y pendientes de decisión', () => {
    const estado = salaEnRevision([['ana', 0]]);
    const estadoPrivado = reducirRegistrosPrivados([
      ASIGNACION,
      revision('ana', 0, { a: 'bueno', inventado: 'excelente' }),
      // beto envió su revisión por el canal privado, pero la sala no la registró: no cuenta.
      revision('beto', 0, { a: 'bueno' }),
    ]);
    // ana revisó a beto (índice 0).
    const deBeto = construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica: RUBRICA, autorId: 'beto' });
    expect(deBeto).toHaveLength(1);
    expect(deBeto[0]).toMatchObject({ revisorId: 'ana', indice: 0, decision: DECISIONES_SOBRE_UNA_REVISION.PENDIENTE });
    expect(deBeto[0].niveles).toEqual({ a: 'bueno' });
    expect(construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica: RUBRICA, autorId: 'carla' })).toEqual([]);
    expect(contarRevisionesPorAprobar({ estadoPrivado, estado, rubrica: RUBRICA })).toBe(1);
  });

  it('solo las aprobadas llegan al autor, con el texto que dejó el docente', () => {
    const estado = salaEnRevision([['ana', 0], ['carla', 1]]);
    const estadoPrivado = reducirRegistrosPrivados([
      ASIGNACION,
      revision('ana', 0, { a: 'bueno' }),
      revision('carla', 1, { a: 'bueno' }),
      {
        nombre: EVENTOS_PRIVADOS.MODERACION_DE_REVISION,
        participantId: 'beto',
        revisorId: 'ana',
        estado: 'aprobada',
        comentariosPorCriterio: { a: 'Comentario editado por el docente' },
        comentarioGeneral: 'Ánimo',
      },
      { nombre: EVENTOS_PRIVADOS.MODERACION_DE_REVISION, participantId: 'beto', revisorId: 'carla', estado: 'descartada' },
    ]);
    // carla revisó a beto con índice 1 (su segundo texto era beto).
    const args = { estadoPrivado, estado, rubrica: RUBRICA, autorId: 'beto' };
    expect(construirRevisionesDeUnAutor(args)).toHaveLength(2);
    expect(listarRevisionesAprobadasParaElAutor(args)).toEqual([
      { comentariosPorCriterio: { a: 'Comentario editado por el docente' }, comentarioGeneral: 'Ánimo' },
    ]);
  });
});

describe('puntos de quien revisa', () => {
  function armar({ moderaciones = [], calificaciones }) {
    const estado = salaEnRevision([['ana', 0], ['ana', 1], ['beto', 0], ['beto', 1], ['carla', 0]]);
    const estadoPrivado = reducirRegistrosPrivados([
      ASIGNACION,
      ...textos,
      // ana acierta con el docente, beto yerra por completo, carla solo hizo una de dos.
      revision('ana', 0, { a: 'excelente', b: 'excelente' }), // a beto
      revision('ana', 1, { a: 'bueno', b: 'bueno' }), // a carla
      revision('beto', 0, { a: 'insuficiente', b: 'insuficiente' }), // a carla
      revision('beto', 1, { a: 'insuficiente', b: 'insuficiente' }), // a ana
      revision('carla', 0, { a: 'excelente', b: 'excelente' }), // a ana
      ...calificaciones,
      ...moderaciones,
    ]);
    const cola = construirColaDelDocente({ estadoPrivado, estado, rubrica: RUBRICA });
    return { estado, estadoPrivado, cola };
  }

  const CALIFICACIONES = [
    calificar('ana', { a: 'excelente', b: 'excelente' }),
    calificar('beto', { a: 'excelente', b: 'excelente' }),
    calificar('carla', { a: 'bueno', b: 'bueno' }),
  ];

  it('acertar da puntos, errar no, y no revisar todo baja el esfuerzo', () => {
    const { estado, estadoPrivado, cola } = armar({ calificaciones: CALIFICACIONES });
    const puntos = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica: RUBRICA, cola, puntosPorRevision: 1 });
    expect(puntos.ana).toMatchObject({ hechas: 2, asignadas: 2, acierto: 1, puntos: 2 });
    expect(puntos.beto.puntos).toBe(0);
    expect(puntos.carla).toMatchObject({ hechas: 1, asignadas: 2, esfuerzo: 0.5 });
    expect(puntos.carla.puntos).toBe(1);
  });

  it('una revisión que el docente descartó no cuenta ni como acierto ni como esfuerzo', () => {
    const { estado, estadoPrivado, cola } = armar({
      calificaciones: CALIFICACIONES,
      // La revisión de ana a beto (índice 0) se descarta.
      moderaciones: [{ nombre: EVENTOS_PRIVADOS.MODERACION_DE_REVISION, participantId: 'beto', revisorId: 'ana', estado: 'descartada' }],
    });
    const puntos = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica: RUBRICA, cola, puntosPorRevision: 1 });
    expect(puntos.ana).toMatchObject({ hechas: 1, esfuerzo: 0.5 });
    expect(puntos.ana.revisiones[0]).toMatchObject({ descartada: true, valida: false });
  });

  it('sin calificación del docente no hay con qué comparar: acierto neutro', () => {
    const { estado, estadoPrivado, cola } = armar({ calificaciones: [] });
    const puntos = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica: RUBRICA, cola, puntosPorRevision: 1 });
    expect(puntos.ana.acierto).toBe(0.5);
  });

  it('el resultado que se le explica al revisor no revela el nivel ni la nota del autor', () => {
    const { estado, estadoPrivado, cola } = armar({ calificaciones: CALIFICACIONES });
    const puntos = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica: RUBRICA, cola, puntosPorRevision: 1 });
    const resultado = construirResultadoParaUnRevisor(puntos.beto);
    expect(resultado.revisiones[0].comparaciones[0]).toEqual({ nombre: 'Pertinencia', frase: 'difirió en 2 niveles' });
    expect(JSON.stringify(resultado)).not.toMatch(/excelente|insuficiente|nota/i);
  });

  it('un borrador del docente no entra a la puntuación del podio, solo lo aprobado', () => {
    const { cola } = armar({
      calificaciones: [
        calificar('ana', { a: 'excelente', b: 'excelente' }),
        { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'beto', niveles: { a: 'excelente', b: 'excelente' }, aprobada: false, enviadoEn: 9 },
      ],
    });
    expect(calcularPuntuacionesDelPodio({ cola, puntosDeRevisores: {} })).toEqual([{ participantId: 'ana', puntuacion: 10 }]);
  });

  it('el podio suma la nota y los puntos de revisión', () => {
    const { estado, estadoPrivado, cola } = armar({ calificaciones: CALIFICACIONES });
    const puntosDeRevisores = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica: RUBRICA, cola, puntosPorRevision: 1 });
    const puntuaciones = Object.fromEntries(
      calcularPuntuacionesDelPodio({ cola, puntosDeRevisores }).map((registro) => [registro.participantId, registro.puntuacion])
    );
    // ana: 10 de nota + 2 por revisar; beto: 10 + 0; carla: 6,67 + 1.
    expect(puntuaciones).toEqual({ ana: 12, beto: 10, carla: 7.67 });
  });
});
