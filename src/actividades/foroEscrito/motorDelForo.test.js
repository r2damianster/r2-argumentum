import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearMotorDeSesion } from '../../host/motorDeSesion.js';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

const MINUTO = 60 * 1000;

const PROGRAMA_DEL_FORO = {
  programId: 'foro-de-prueba',
  titulo: 'Foro de prueba',
  actividad: 'foro_escrito',
  perfilDePuntaje: 'estandar',
  posturas: [
    { id: 'a_favor', etiqueta: 'A favor' },
    { id: 'en_contra', etiqueta: 'En contra' },
  ],
  fases: [{ tipo: 'foro_escrito', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function construirEstado(eventos) {
  return [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA_DEL_FORO }), ...eventos].reduce(
    (estado, siguiente) => reducirEventos(estado, siguiente),
    estadoInicial()
  );
}

const INGRESOS = [
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor' }),
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'en_contra' }),
];

function aporte(argumentId, participantId, extra = {}) {
  return evento(EVENTOS.ARGUMENTO_PUBLICADO, {
    argumentId,
    participantId,
    posicionEnRonda: 1,
    ronda: 1,
    tipoDeclarado: 'nuevo',
    pendienteDeExposicion: false,
    ...extra,
  });
}

// Corre el motor contra el estado y le devuelve por el canal lo que publica, como pasa en vivo.
function correrMotor(eventosIniciales, { vueltas = 3 } = {}) {
  let estado = construirEstado(eventosIniciales);
  const publicar = vi.fn((name, data) => {
    estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data } });
  });
  const motor = crearMotorDeSesion({ programa: PROGRAMA_DEL_FORO });
  for (let vuelta = 0; vuelta < vueltas; vuelta += 1) {
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
  }
  return { motor, publicar, obtenerEstado: () => estado };
}

function eventosPublicados(publicar, nombre) {
  return publicar.mock.calls.filter(([nombreDelEvento]) => nombreDelEvento === nombre).map(([, datos]) => datos);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T10:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('inicio del foro', () => {
  it('la primera fase lleva la duración total, para que todos lleven la misma cuenta atrás', () => {
    const { motor, publicar } = correrMotor(INGRESOS, { vueltas: 1 });
    motor.iniciarSesion();
    expect(eventosPublicados(publicar, EVENTOS.FASE_INICIADA)[0]).toMatchObject({
      phaseType: 'foro_escrito',
      duracionMin: 20,
    });
  });

  it('el foro no tiene ruleta: nunca ofrece turnos', () => {
    const { publicar } = correrMotor([
      ...INGRESOS,
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 }),
      aporte('p1', 'ana'),
    ]);
    expect(eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO)).toHaveLength(0);
  });
});

describe('puntaje provisional del foro', () => {
  const FASE = evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 });

  it('los tres primeros posts valen las posiciones 1, 2 y 3 (Estándar: 100, 80 y 30)', () => {
    const { obtenerEstado } = correrMotor([
      ...INGRESOS,
      FASE,
      aporte('p1', 'ana', { timestamp: 1 }),
      aporte('p2', 'ana', { timestamp: 2 }),
      aporte('p3', 'ana', { timestamp: 3 }),
    ]);
    expect(obtenerEstado().participantes.ana.puntajeTotal).toBe(210);
  });

  it('el cuarto post se publica pero no suma', () => {
    const { obtenerEstado } = correrMotor([
      ...INGRESOS,
      FASE,
      aporte('p1', 'ana', { timestamp: 1 }),
      aporte('p2', 'ana', { timestamp: 2 }),
      aporte('p3', 'ana', { timestamp: 3 }),
      aporte('p4', 'ana', { timestamp: 4 }),
    ]);
    expect(obtenerEstado().participantes.ana.puntajeTotal).toBe(210);
    expect(obtenerEstado().argumentos.p4).toBeDefined();
  });

  it('una réplica vale como la posición de menor valor y tiene su propio tope', () => {
    const replicas = [1, 2, 3, 4, 5, 6].map((numero) =>
      aporte(`r${numero}`, 'luis', {
        timestamp: 10 + numero,
        tipoDeclarado: 'contraargumento',
        argumentoObjetivoId: 'p1',
      })
    );
    const { obtenerEstado } = correrMotor([...INGRESOS, FASE, aporte('p1', 'ana', { timestamp: 1 }), ...replicas]);
    // 5 réplicas puntuadas de 30; la sexta no suma
    expect(obtenerEstado().participantes.luis.puntajeTotal).toBe(150);
  });

  it('no puntúa dos veces al sincronizar varias veces', () => {
    const { obtenerEstado } = correrMotor([...INGRESOS, FASE, aporte('p1', 'ana', { timestamp: 1 })], { vueltas: 6 });
    expect(obtenerEstado().participantes.ana.puntajeTotal).toBe(100);
  });
});

describe('tiempo total del foro', () => {
  const FASE_HACE = (minutos) => ({
    name: EVENTOS.FASE_INICIADA,
    data: { timestamp: Date.now() - minutos * MINUTO, phaseType: 'foro_escrito', duracionMin: 20 },
  });

  it('mientras queda tiempo no cierra la escritura', () => {
    const { publicar } = correrMotor([...INGRESOS, FASE_HACE(5)]);
    expect(eventosPublicados(publicar, EVENTOS.FASE_CERRADA)).toHaveLength(0);
  });

  it('al agotarse el tiempo cierra la escritura una sola vez y pasa a la fase de cierre', () => {
    const { publicar, obtenerEstado } = correrMotor([...INGRESOS, FASE_HACE(21)], { vueltas: 5 });
    expect(eventosPublicados(publicar, EVENTOS.FASE_CERRADA)).toHaveLength(1);
    expect(obtenerEstado().fase.actual?.tipo).toBe('cierre_y_ranking');
  });

  it('extender el tiempo reabre la cuenta atrás: no cierra aunque hayan pasado 21 minutos', () => {
    const { publicar } = correrMotor([...INGRESOS, FASE_HACE(21), evento(EVENTOS.FASE_EXTENDIDA, { minutos: 5 })]);
    expect(eventosPublicados(publicar, EVENTOS.FASE_CERRADA)).toHaveLength(0);
  });

  it('la acción extenderTiempo publica la extensión de 5 minutos por defecto', () => {
    const { motor, publicar } = correrMotor([...INGRESOS, FASE_HACE(5)], { vueltas: 1 });
    motor.extenderTiempo();
    expect(eventosPublicados(publicar, EVENTOS.FASE_EXTENDIDA)).toEqual([{ minutos: 5 }]);
  });

  it('un motor nuevo (host que refrescó) llega a la misma conclusión sin estado en memoria', () => {
    const eventos = [...INGRESOS, FASE_HACE(21)];
    const primero = correrMotor(eventos, { vueltas: 1 });
    const segundo = correrMotor(eventos, { vueltas: 1 });
    expect(eventosPublicados(primero.publicar, EVENTOS.FASE_CERRADA)).toHaveLength(1);
    expect(eventosPublicados(segundo.publicar, EVENTOS.FASE_CERRADA)).toHaveLength(1);
  });
});

describe('cierre del foro', () => {
  const PRESENCIA_CON_CO_MODERADORES = [
    ...PRESENCIA,
    { participantId: 'carla', nombre: 'Carla', conectado: true },
    { participantId: 'diego', nombre: 'Diego', conectado: true },
  ];

  function estadoConRevisiones() {
    return construirEstado([
      ...INGRESOS,
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla', stanceId: 'a_favor' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego', stanceId: 'en_contra' }),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
      { name: EVENTOS.FASE_INICIADA, data: { timestamp: Date.now() - 5 * MINUTO, phaseType: 'foro_escrito', duracionMin: 20 } },
      aporte('p1', 'ana', { timestamp: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 0 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0 }),
    ]);
  }

  function cerrarConMotor(veces = 1) {
    let estado = estadoConRevisiones();
    const publicar = vi.fn((name, data) => {
      estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data } });
    });
    const motor = crearMotorDeSesion({ programa: PROGRAMA_DEL_FORO });
    motor.sincronizar({ estado, presencia: PRESENCIA_CON_CO_MODERADORES, publicar });
    motor.sincronizar({ estado, presencia: PRESENCIA_CON_CO_MODERADORES, publicar });
    publicar.mockClear();
    for (let vez = 0; vez < veces; vez += 1) {
      motor.cerrarSesion();
    }
    return { publicar, obtenerEstado: () => estado };
  }

  it('aplica los ajustes de la revisión antes de session.closed', () => {
    const { publicar, obtenerEstado } = cerrarConMotor();
    const nombres = publicar.mock.calls.map(([nombre]) => nombre);
    expect(nombres[nombres.length - 1]).toBe(EVENTOS.SESION_CERRADA);

    const puntajes = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO);
    // Ana ganó 100 por su post y los co-moderadores lo dejaron en «no cuenta»: vuelve a 0.
    expect(puntajes.find((puntaje) => puntaje.participantId === 'ana')).toMatchObject({ delta: -100, nuevoTotal: 0 });
    expect(obtenerEstado().participantes.ana.puntajeTotal).toBe(0);
    // Los dos co-moderadores coinciden entre sí: 210 × acierto 1 × esfuerzo 1/7 = 30 cada uno.
    expect(puntajes.filter((puntaje) => puntaje.categoria === 'co_moderacion').map((puntaje) => puntaje.delta)).toEqual([30, 30]);
  });

  it('cerrar dos veces no aplica los ajustes dos veces', () => {
    const { publicar } = cerrarConMotor(2);
    const ajustesAAna = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter((puntaje) => puntaje.participantId === 'ana');
    expect(ajustesAAna).toHaveLength(1);
  });
});
