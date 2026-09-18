import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearMotorDeSesion } from './motorDeSesion.js';
import { estadoInicial, reducirEventos } from '../shared/estado/reducirEventos.js';
import { EVENTOS } from '../shared/eventos/nombresDeEventos.js';

// El motor corre solo en el cliente del host y es la autoridad única de turnos y puntaje.
// Acá se lo prueba en seco: se le da un estado y se revisa qué eventos publica.

const PROGRAMA = {
  programId: 'prueba',
  titulo: 'Debate de prueba',
  perfilDePuntaje: 'estandar',
  posturas: [
    { id: 'izquierda', etiqueta: 'Más estado' },
    { id: 'derecha', etiqueta: 'Más mercado' },
  ],
  fases: [{ tipo: 'escritura_argumentos', ronda: 1 }],
  timeoutAceptacion: 20,
  maxRechazosAntesDeForzar: 3,
  tiempoLimiteEvaluacionBid: 20,
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function construirEstado(eventos) {
  return [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }), ...eventos].reduce(
    (estado, siguiente) => reducirEventos(estado, siguiente),
    estadoInicial()
  );
}

// Estado base: Ana y Luis dentro del debate, fase de escritura en curso.
function estadoEnDebate(eventosExtra = []) {
  return construirEstado([
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'luis', stanceId: 'derecha' }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ...eventosExtra,
  ]);
}

function sincronizarCon(estado) {
  const publicar = vi.fn();
  const motor = crearMotorDeSesion({ programa: PROGRAMA });
  motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
  return { publicar, motor };
}

function eventosPublicados(publicar, nombre) {
  return publicar.mock.calls.filter(([nombreDelEvento]) => nombreDelEvento === nombre).map(([, datos]) => datos);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('la ruleta solo ofrece turno a quien tiene argumento preparado', () => {
  it('no ofrece nada si nadie preparó un argumento y todos ya intervinieron', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a2', participantId: 'luis', posicionEnRonda: 1, ronda: 1 }),
    ]);

    const { publicar } = sincronizarCon(estado);

    expect(eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO)).toHaveLength(0);
  });

  it('ofrece el turno a quien anunció que tiene un argumento listo', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a2', participantId: 'luis', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'luis' }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas).toHaveLength(1);
    expect(ofertas[0].candidateId).toBe('luis');
    expect(ofertas[0].modo).toBe('argumento');
  });

  it('nunca le ofrece turno a un oyente, aunque diga tener argumento listo', () => {
    const estado = construirEstado([
      evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ]);

    const { publicar } = sincronizarCon(estado);

    expect(eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO)).toHaveLength(0);
  });
});

describe('turno hablado de respaldo', () => {
  it('se ofrece cuando no queda argumento preparado y alguien no ha intervenido nunca', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas).toHaveLength(1);
    expect(ofertas[0].candidateId).toBe('luis');
    expect(ofertas[0].modo).toBe('verbal');
  });

  it('el argumento preparado tiene prioridad sobre el turno hablado', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas[0].modo).toBe('argumento');
    expect(ofertas[0].candidateId).toBe('ana');
  });
});

describe('puntaje', () => {
  it('acredita el puntaje base sin necesidad de co-moderador (bug de las salas de 2)', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const puntajes = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'ana'
    );

    // Perfil estándar, posición 1, ronda 1 → 100 puntos.
    expect(puntajes[0].delta).toBe(100);
    expect(puntajes[0].categoria).toBe('argumento');
  });

  it('no reparte bonos de co-moderación si quien validó no es co-moderador', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
        tipoDeclarado: 'nuevo',
      }),
      evento(EVENTOS.ARGUMENTO_VALIDADO, {
        argumentId: 'a1',
        coModeradorId: 'host',
        tipoFinal: 'contraargumento',
        faltaMarcada: false,
        nota: '',
      }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const bonos = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.categoria === 'co_moderacion'
    );

    expect(bonos).toHaveLength(0);
  });

  it('descuenta puntos a quien rechaza el turno, una sola vez', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
    ]);

    const publicar = vi.fn();
    const motor = crearMotorDeSesion({ programa: PROGRAMA });
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });

    const penalidades = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.delta < 0
    );

    expect(penalidades).toHaveLength(1);
    expect(penalidades[0].delta).toBe(-20);
    expect(penalidades[0].participantId).toBe('ana');
  });

  it('puntúa la intervención hablada al registrarse, sin esperar calificación', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, {
        intervencionId: 'v1',
        participantId: 'luis',
        turnId: 'tv',
      }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const puntajes = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'luis'
    );

    // Perfil estándar: posición 3 (30) con descuento de vía (0.5) → 15.
    expect(puntajes[0].delta).toBe(15);
  });
});
