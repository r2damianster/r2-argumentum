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

// Estado base: Ana y Luis dentro del debate, fase de escritura en curso. La fase arranca hace
// rato a propósito: el turno hablado de respaldo solo entra tras un margen desde que empieza
// la fase (ver ESPERA_ANTES_DEL_TURNO_HABLADO_MS en motorDeSesion.js).
function estadoEnDebate(eventosExtra = [], { faseIniciadaHaceMs = 5 * 60 * 1000 } = {}) {
  return construirEstado([
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'luis', stanceId: 'derecha' }),
    {
      name: EVENTOS.FASE_INICIADA,
      data: { timestamp: Date.now() - faseIniciadaHaceMs, phaseType: 'escritura_argumentos', ronda: 1 },
    },
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

  it('no ofrece turno hablado en los primeros segundos de la fase: nadie tuvo tiempo de preparar nada', () => {
    const estado = estadoEnDebate([], { faseIniciadaHaceMs: 0 });

    const { publicar } = sincronizarCon(estado);

    expect(eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO)).toHaveLength(0);
  });

  it('el argumento de ingreso no cuenta como haber tomado la palabra', () => {
    // Todo el mundo entra al debate con un argumento escrito: si ese argumento contara como
    // intervención, nadie quedaría nunca "sin intervenir" y el turno hablado no se ofrecería
    // jamás. Bug real reportado en prueba en vivo con 8 participantes.
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-ana',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
        esArgumentoDeIngreso: true,
      }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-luis',
        participantId: 'luis',
        posicionEnRonda: 1,
        ronda: 1,
        esArgumentoDeIngreso: true,
      }),
    ]);

    const ofertas = eventosPublicados(sincronizarCon(estado).publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas).toHaveLength(1);
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

  it('el total nunca baja de cero, aunque la penalidad sea mayor que lo acumulado', () => {
    // Observado en prueba en vivo: con 10 puntos, rechazar un turno dejaba a la persona en
    // −10. La penalidad consume lo que tenía, no la deja en deuda.
    const estado = estadoEnDebate([
      evento(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: 'ana',
        delta: 10,
        categoria: 'argumento',
        nuevoTotal: 10,
      }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const penalidad = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).find(
      (puntaje) => puntaje.delta < 0
    );

    // El delta conserva el valor nominal de la regla, pero el total queda topado en 0.
    expect(penalidad.delta).toBe(-20);
    expect(penalidad.nuevoTotal).toBe(0);
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

  it('no puntúa el argumento de ingreso antes de que arranque la sesión', () => {
    // Bug real reportado en prueba en vivo: el argumento de ingreso se puntuaba apenas
    // llegaba (todavía en la sala de configuración previa), con el perfil por defecto —
    // aunque el docente hubiera elegido Estándar, ese cambio recién se publica al hacer clic
    // en "Iniciar sesión", después de que el ingreso ya ocurrió.
    const estado = construirEstado([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-ana',
        participantId: 'ana',
        turnId: 'ingreso-ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    const { publicar } = sincronizarCon(estado);

    expect(eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(0);
  });

  it('puntúa el argumento de ingreso con el perfil vigente en cuanto arranca la sesión', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-ana',
        participantId: 'ana',
        turnId: 'ingreso-ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const puntajes = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'ana'
    );

    expect(puntajes[0].delta).toBe(100);
  });
});

describe('bids aprobados', () => {
  function estadoConBidAprobado() {
    return estadoEnDebate([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.BID_ENVIADO, {
        bidId: 'b1',
        participantId: 'luis',
        tipoDeBid: 'desmontar',
        argumentoObjetivoId: 'arg-ana-1',
        texto: 'Ese argumento ignora los costos de transacción.',
        ronda: 1,
        turnoPrincipalId: 't1',
      }),
      evento(EVENTOS.BID_DECISION_MODERADOR, { bidId: 'b1', decisionFinal: 'aprobado' }),
    ]);
  }

  it('publica exactamente un puntaje para el argumento del bid, no dos', () => {
    // Bug real reportado en prueba en vivo: procesarBidsResueltos publicaba su propio
    // score.updated y, al tick siguiente, procesarArgumentosNuevos volvía a puntuar el mismo
    // argumentId porque nunca se agregó a argumentosYaPuntuados — quedaba puntuado doble.
    const publicar = vi.fn();
    const motor = crearMotorDeSesion({ programa: PROGRAMA });
    let estado = estadoConBidAprobado();

    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
    const argumentoPublicado = eventosPublicados(publicar, EVENTOS.ARGUMENTO_PUBLICADO)[0];
    estado = reducirEventos(estado, { name: EVENTOS.ARGUMENTO_PUBLICADO, data: argumentoPublicado });

    // Un segundo tick, como pasaría de verdad cuando el evento vuelve por Ably.
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });

    const puntajesDelBid = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'luis' && puntaje.categoria === 'argumento'
    );

    expect(puntajesDelBid).toHaveLength(1);
  });

  it('conecta el argumento resultante con su objetivo (bug: quedaba suelto en el grafo)', () => {
    const estado = estadoConBidAprobado();

    const { publicar } = sincronizarCon(estado);
    const conexiones = eventosPublicados(publicar, EVENTOS.CONEXION_CREADA);

    expect(conexiones).toHaveLength(1);
    expect(conexiones[0].targetArgumentId).toBe('arg-ana-1');
    expect(conexiones[0].tipoDeRelacion).toBe('contraargumento');
    expect(conexiones[0].porParticipanteId).toBe('luis');
  });
});
