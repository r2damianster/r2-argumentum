import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearMotorDeSesion } from './motorDeSesion.js';
import { estadoInicial, reducirEventos } from '../shared/estado/reducirEventos.js';
import { EVENTOS } from '../shared/eventos/nombresDeEventos.js';

// El motor corre solo en el cliente del host y es la autoridad única de turnos y puntaje.
// Aquí se lo prueba en seco: se le da un estado y se revisa qué eventos publica.

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

// Corre un motor contra un estado y le devuelve por el canal lo que va publicando, como pasa
// en vivo: así el estado resultante incluye las marcas de lo que el motor ya ejecutó.
function correrMotorYRealimentar(estadoDePartida, vueltas = 3) {
  let estado = estadoDePartida;
  const publicar = vi.fn((name, data) => {
    estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data } });
  });
  const motor = crearMotorDeSesion({ programa: PROGRAMA });
  for (let vuelta = 0; vuelta < vueltas; vuelta += 1) {
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
  }
  return { estado, publicar, motor };
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

// El motor del host vive en memoria. Si el docente refresca la pestaña a mitad del debate se
// crea uno nuevo contra el estado reconstruido del canal, y ese motor no puede rehacer nada de
// lo ya hecho: duplicaría puntajes, nodos del grafo y saltos de fase.
describe('host que refresca la pestaña a mitad del debate', () => {
  it('no vuelve a puntuar los argumentos ya puntuados', () => {
    const { estado, publicar } = correrMotorYRealimentar(
      estadoEnDebate([
        evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
        evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a2', participantId: 'luis', posicionEnRonda: 1, ronda: 1 }),
      ])
    );
    expect(eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(2);

    const { publicar: publicarTrasRefrescar } = sincronizarCon(estado);

    expect(eventosPublicados(publicarTrasRefrescar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(0);
  });

  it('no republica el argumento de un bid ya resuelto', () => {
    const { estado, publicar } = correrMotorYRealimentar(
      estadoEnDebate([
        evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
        evento(EVENTOS.BID_ENVIADO, {
          bidId: 'b1',
          participantId: 'luis',
          tipoDeBid: 'desmontar',
          argumentoObjetivoId: 'a1',
          texto: 'Eso no se sostiene porque…',
          ronda: 1,
          turnoPrincipalId: 't1',
        }),
        evento(EVENTOS.BID_DECISION_MODERADOR, { bidId: 'b1', decisionFinal: 'aprobado' }),
      ])
    );
    expect(eventosPublicados(publicar, EVENTOS.CONEXION_CREADA)).toHaveLength(1);

    const { publicar: publicarTrasRefrescar } = sincronizarCon(estado);

    expect(eventosPublicados(publicarTrasRefrescar, EVENTOS.ARGUMENTO_PUBLICADO)).toHaveLength(0);
    expect(eventosPublicados(publicarTrasRefrescar, EVENTOS.CONEXION_CREADA)).toHaveLength(0);
    expect(eventosPublicados(publicarTrasRefrescar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(0);
  });

  it('no manda el debate de vuelta a la primera fase al cerrar la siguiente', async () => {
    // El debate va por la ronda 2; cerrarla debe llevar a la fase que sigue en el Programa, no
    // a la ronda 1 otra vez (que es lo que hacía el contador en memoria al arrancar en -1).
    const programaConVariasFases = {
      ...PROGRAMA,
      fases: [
        { tipo: 'escritura_argumentos', ronda: 1 },
        { tipo: 'escritura_argumentos', ronda: 2 },
        { tipo: 'conexion_sugerida' },
        { tipo: 'conexion_libre' },
        { tipo: 'cierre_y_ranking' },
      ],
    };
    const estado = [
      evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: programaConVariasFases }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
      evento(EVENTOS.FASE_CERRADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 2 }),
    ].reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());

    const publicar = vi.fn();
    const motor = crearMotorDeSesion({ programa: programaConVariasFases });
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar });
    // La fase de escritura dispara las sugerencias de Groq antes de abrir la siguiente: sin el
    // await, el phase.started todavía no se publicó.
    await motor.cerrarFaseActual();

    const iniciadas = eventosPublicados(publicar, EVENTOS.FASE_INICIADA);
    expect(iniciadas).toHaveLength(1);
    // conexion_sugerida no abre fase propia: el disparo de Groq ya ocurrió al cerrar.
    expect(iniciadas[0]).toMatchObject({ phaseType: 'conexion_libre' });
  });

  it('hace expirar una oferta sin respuesta y la reofrece con un turno nuevo', () => {
    // Reporte de prueba en vivo: una oferta sin responder "no expiraba" en varios minutos. La
    // oferta sí expira a los 20 s; al ser el único candidato, se le reofrece con otro turnId.
    let estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
    ]);
    const publicar = vi.fn((name, data) => {
      estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data } });
    });
    const motor = crearMotorDeSesion({ programa: PROGRAMA });
    const presencia = [{ participantId: 'ana', nombre: 'Ana', conectado: true }];

    motor.sincronizar({ estado, presencia, publicar });
    motor.sincronizar({ estado, presencia, publicar });
    const primeraOferta = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO)[0];
    expect(primeraOferta.candidateId).toBe('ana');

    vi.advanceTimersByTime(21 * 1000);
    motor.sincronizar({ estado, presencia, publicar });

    const expirados = eventosPublicados(publicar, EVENTOS.TURNO_EXPIRADO);
    expect(expirados).toHaveLength(1);
    expect(expirados[0].turnId).toBe(primeraOferta.turnId);

    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);
    expect(ofertas).toHaveLength(2);
    expect(ofertas[1].turnId).not.toBe(primeraOferta.turnId);
  });

  it('adopta la oferta de turno que quedó huérfana y la hace expirar', () => {
    // El temporizador de la oferta vivía en la pestaña que se cerró: sin adopción, la oferta
    // queda colgada para siempre y la ruleta no vuelve a girar.
    const estado = construirEstado([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
      evento(EVENTOS.TURNO_OFRECIDO, {
        turnId: 't-huerfano',
        candidateId: 'ana',
        ofrecidoEn: Date.now() - 60 * 1000,
        expiraEn: Date.now() - 40 * 1000,
        modo: 'argumento',
      }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const expirados = eventosPublicados(publicar, EVENTOS.TURNO_EXPIRADO);

    expect(expirados).toHaveLength(1);
    expect(expirados[0].turnId).toBe('t-huerfano');
  });
});

describe('sorteo de co-moderadores al iniciar la sesión', () => {
  const PRESENCIA_CON_OYENTE = [
    ...PRESENCIA,
    { participantId: 'marta', nombre: 'Marta', conectado: true },
  ];

  function iniciarConPresencia(presencia, eventosDeIngreso) {
    const estado = construirEstado(eventosDeIngreso);
    const publicar = vi.fn();
    const motor = crearMotorDeSesion({ programa: PROGRAMA });
    motor.sincronizar({ estado, presencia, publicar });
    motor.iniciarSesion();
    return eventosPublicados(publicar, EVENTOS.COMODERADORES_SELECCIONADOS)[0];
  }

  it('no sortea a quien está conectado pero aún no confirmó su ingreso (oyente)', () => {
    // Marta está en la sala como oyente: sin excluirla, 3 conectados dejaban 1 co-moderador y
    // el sorteo podía elegirla, quedando co-moderadora y oyente a la vez.
    const seleccion = iniciarConPresencia(PRESENCIA_CON_OYENTE, [
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    ]);

    expect(seleccion.totalParticipantes).toBe(2);
    expect(seleccion.participantIds).toEqual([]);
  });

  it('con suficientes confirmados, el oyente nunca queda entre los sorteados', () => {
    const presencia = [
      ...PRESENCIA_CON_OYENTE,
      { participantId: 'pedro', nombre: 'Pedro', conectado: true },
      { participantId: 'sofia', nombre: 'Sofía', conectado: true },
    ];
    const seleccion = iniciarConPresencia(presencia, [
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'pedro', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'sofia', stanceId: 'derecha' }),
    ]);

    expect(seleccion.totalParticipantes).toBe(4);
    expect(seleccion.participantIds).toHaveLength(1);
    expect(seleccion.participantIds).not.toContain('marta');
  });
});

describe('argumento publicado al aprobarse y evaluación de su exposición', () => {
  const ARGUMENTO_PENDIENTE_DE_ANA = {
    argumentId: 'a1',
    participantId: 'ana',
    posicionEnRonda: 1,
    ronda: 1,
    tipoDeclarado: 'nuevo',
    pendienteDeExposicion: true,
  };

  const CO_MODERADORES = evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] });

  function estadoConExposicionTerminada(eventosExtra = []) {
    return estadoEnDebate([
      CO_MODERADORES,
      evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE_DE_ANA),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 't1', participantId: 'ana', argumentId: 'a1', texto: 'x' }),
      evento(EVENTOS.EXPOSICION_TERMINADA, { turnId: 't1', participantId: 'ana', argumentId: 'a1' }),
      ...eventosExtra,
    ]);
  }

  it('el argumento puntúa apenas se publica, sin esperar a exponerlo', () => {
    const estado = estadoEnDebate([evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE_DE_ANA)]);

    const { publicar } = sincronizarCon(estado);
    const puntajesDeAna = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'ana'
    );

    expect(puntajesDeAna[0].delta).toBe(100);
  });

  it('quien ya publicó su tercera posición sigue en la ruleta para defenderla', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { ...ARGUMENTO_PENDIENTE_DE_ANA, posicionEnRonda: 3 }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas[0].candidateId).toBe('ana');
    expect(ofertas[0].modo).toBe('argumento');
  });

  it('rechazar el turno resta sobre los puntos que el argumento ya había dado', () => {
    // Primero el argumento se publica y puntúa; el rechazo llega después, como en vivo.
    const { estado: estadoConArgumentoPuntuado } = correrMotorYRealimentar(
      estadoEnDebate([evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE_DE_ANA)])
    );
    const estadoConRechazo = [
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
    ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), estadoConArgumentoPuntuado);

    const { estado } = correrMotorYRealimentar(estadoConRechazo);

    expect(estado.participantes.ana.puntajeTotal).toBe(80);
    expect(estado.argumentos.a1).toBeDefined();
  });

  it('las calificaciones no cambian el puntaje mientras el debate sigue', () => {
    const estado = estadoConExposicionTerminada([
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' }),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'diego', calidad: 'buena' }),
    ]);

    const { estado: estadoFinal } = correrMotorYRealimentar(estado);

    expect(estadoFinal.participantes.ana.puntajeTotal).toBe(100);
  });

  it('al cerrar la sesión aplica el ajuste al expositor y los bonos, antes de session.closed', () => {
    const estado = estadoConExposicionTerminada([
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' }),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'diego', calidad: 'buena' }),
    ]);
    const { publicar, motor } = correrMotorYRealimentar(estado);
    publicar.mockClear();

    motor.cerrarSesion();

    const nombres = publicar.mock.calls.map(([nombre]) => nombre);
    const puntajes = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO);
    expect(nombres[nombres.length - 1]).toBe(EVENTOS.SESION_CERRADA);
    expect(puntajes.find((puntaje) => puntaje.participantId === 'ana')).toMatchObject({ delta: 100, nuevoTotal: 200 });
    // Coinciden entre sí: bono de revisión cruzada (3 × 10 en Estándar) para cada uno.
    expect(puntajes.filter((puntaje) => puntaje.categoria === 'co_moderacion').map((p) => p.delta)).toEqual([30, 30]);
  });

  it('si el moderador descarta las calificaciones, cerrar no ajusta nada', () => {
    const estado = estadoConExposicionTerminada([
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' }),
      evento(EVENTOS.EXPOSICION_EVALUADA_POR_MODERADOR, { argumentId: 'a1', decision: 'descartada' }),
    ]);
    const { publicar, motor } = correrMotorYRealimentar(estado);
    publicar.mockClear();

    motor.cerrarSesion();

    expect(eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(0);
    expect(eventosPublicados(publicar, EVENTOS.SESION_CERRADA)).toHaveLength(1);
  });

  it('cerrar dos veces no aplica los ajustes dos veces', () => {
    const estado = estadoConExposicionTerminada([
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' }),
    ]);
    const { publicar, motor } = correrMotorYRealimentar(estado);
    publicar.mockClear();

    motor.cerrarSesion();
    motor.cerrarSesion();

    const ajustesAAna = eventosPublicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO).filter(
      (puntaje) => puntaje.participantId === 'ana'
    );
    expect(ajustesAAna).toHaveLength(1);
  });
});

describe('reasignarRolplayEquilibrado', () => {
  it('reasigna posturas 50/50 a los participantes confirmados', () => {
    const presencia = [
      { participantId: 'ana', nombre: 'Ana', conectado: true },
      { participantId: 'luis', nombre: 'Luis', conectado: true },
    ];
    const estado = estadoEnDebate([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'izquierda' }),
    ]);

    const { publicar, motor } = sincronizarCon(estado);
    publicar.mockClear();

    motor.reasignarRolplayEquilibrado();

    const asignaciones = eventosPublicados(publicar, EVENTOS.POSTURA_ASIGNADA);
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones[0].stanceId).toBe(PROGRAMA.posturas[0].id);
    expect(asignaciones[1].stanceId).toBe(PROGRAMA.posturas[1].id);
  });

  it('ofrece turno inmediatamente a quien ingresó con su argumento de apertura pendienteDeExposicion', () => {
    const estado = construirEstado([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-ana',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
        esArgumentoDeIngreso: true,
        pendienteDeExposicion: true,
      }),
      {
        name: EVENTOS.FASE_INICIADA,
        data: { timestamp: Date.now(), phaseType: 'escritura_argumentos', ronda: 1 },
      },
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas).toHaveLength(1);
    expect(ofertas[0].candidateId).toBe('ana');
    expect(ofertas[0].modo).toBe('argumento');
  });
});

describe('cortacircuitos de ruleta en el motor de sesión', () => {
  it('pausa la ruleta automáticamente cuando fallosConsecutivosDeOferta alcanza 4', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1, pendienteDeExposicion: true }),
    ]);

    const estadoPausado = {
      ...estado,
      turnos: {
        ...estado.turnos,
        fallosConsecutivosDeOferta: 4,
      },
    };

    const { publicar } = sincronizarCon(estadoPausado);
    const eventosPausa = eventosPublicados(publicar, EVENTOS.TURNO_RULETA_PAUSADA);

    expect(eventosPausa).toHaveLength(1);
    expect(eventosPausa[0].motivo).toContain('4 turnos consecutivos');
  });

  it('no ofrece turnos si la ruleta ya está pausada', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1, pendienteDeExposicion: true }),
      evento(EVENTOS.TURNO_RULETA_PAUSADA, { motivo: 'Pausada' }),
    ]);

    const { publicar } = sincronizarCon(estado);
    const ofertas = eventosPublicados(publicar, EVENTOS.TURNO_OFRECIDO);

    expect(ofertas).toHaveLength(0);
  });

  it('permite pausar y reanudar la ruleta manualmente desde el motor', () => {
    const estado = estadoEnDebate();
    const { publicar, motor } = sincronizarCon(estado);
    publicar.mockClear();

    motor.pausarRuleta();
    let eventosPausa = eventosPublicados(publicar, EVENTOS.TURNO_RULETA_PAUSADA);
    expect(eventosPausa).toHaveLength(1);

    publicar.mockClear();
    motor.reanudarRuleta();
    let eventosReanudados = eventosPublicados(publicar, EVENTOS.TURNO_RULETA_REANUDADA);
    expect(eventosReanudados).toHaveLength(1);
  });
});

