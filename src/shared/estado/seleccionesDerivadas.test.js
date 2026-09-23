import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import {
  combinarParticipantesConPresencia,
  completarPresenciaConParticipantes,
  nombreDeParticipante,
  obtenerExposicionesSinCalificar,
  calcularPodioDePosturas,
  calcularPodioIndividual,
} from './seleccionesDerivadas.js';

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('turnos rechazados por participante', () => {
  it('cuenta el total aunque la racha se haya cortado al aceptar un turno', () => {
    const estado = [
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't2', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't2', participantId: 'ana' }),
    ].reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());

    const [ana] = combinarParticipantesConPresencia(estado, [{ participantId: 'ana', nombre: 'Ana' }]);

    expect(ana.rechazosAcumulados).toBe(0);
    expect(ana.turnosRechazadosEnTotal).toBe(1);
  });
});

function reducir(eventos) {
  return eventos.reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());
}

describe('nombres de quien ya se desconectó (bug: nombre reemplazado por ID tras refrescar el host)', () => {
  const estadoConMateo = reducir([
    evento(EVENTOS.INGRESO_CONFIRMADO, {
      participantId: 'participante-1-abc',
      stanceId: 'izquierda',
      nombre: 'Mateo',
      emoji: '🦊',
    }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'derecha', nombre: 'Ana', emoji: '🐼' }),
  ]);

  it('el reducer conserva nombre y emoji del ingreso confirmado', () => {
    expect(estadoConMateo.participantes['participante-1-abc']).toMatchObject({ nombre: 'Mateo', emoji: '🦊' });
  });

  it('suma al roster a quien ya no está en presence, marcado como desconectado', () => {
    // Host que refrescó: presence solo trae a Ana, que sigue conectada.
    const presenciaTrasRefrescar = [{ participantId: 'ana', nombre: 'Ana', emoji: '🐼', conectado: true }];
    const completa = completarPresenciaConParticipantes(presenciaTrasRefrescar, estadoConMateo.participantes);

    expect(completa).toHaveLength(2);
    expect(nombreDeParticipante(completa, 'participante-1-abc')).toBe('🦊 Mateo');
    expect(completa.find((presente) => presente.participantId === 'participante-1-abc').conectado).toBe(false);
  });

  it('no duplica a quien sí está en presence y devuelve la misma referencia si no hay nada que sumar', () => {
    const presencia = [
      { participantId: 'ana', nombre: 'Ana', emoji: '🐼', conectado: true },
      { participantId: 'participante-1-abc', nombre: 'Mateo', emoji: '🦊', conectado: true },
    ];
    expect(completarPresenciaConParticipantes(presencia, estadoConMateo.participantes)).toBe(presencia);
  });

  it('el marcador distingue a quien está sin conexión', () => {
    const completa = completarPresenciaConParticipantes([], estadoConMateo.participantes);
    const marcador = combinarParticipantesConPresencia(estadoConMateo, completa);
    expect(marcador.every((participante) => participante.conectado === false)).toBe(true);
  });
});

describe('el moderador termina un turno que quedó abierto', () => {
  const preparado = [
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
    evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
  ];

  it('libera el turno en curso y conserva el argumento listo de quien hablaba', () => {
    const estado = reducir([...preparado, evento(EVENTOS.TURNO_TERMINADO_POR_HOST, { turnId: 't1', participantId: 'ana' })]);
    expect(estado.turnos.turnoEnCurso).toBeNull();
    expect(estado.participantes.ana.argumentoListo).toBe(true);
    expect(estado.participantes.ana.intervenciones).toBe(0);
  });

  it('ignora un cierre de otro turno', () => {
    const estado = reducir([...preparado, evento(EVENTOS.TURNO_TERMINADO_POR_HOST, { turnId: 'viejo', participantId: 'ana' })]);
    expect(estado.turnos.turnoEnCurso?.turnId).toBe('t1');
  });
});

describe('argumento en exposición (énfasis al recibir la palabra)', () => {
  const ingreso = evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' });
  const aceptado = evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' });

  it('se pega al turno en curso de quien lo anuncia', () => {
    const estado = reducir([
      ingreso,
      aceptado,
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, {
        turnId: 't1',
        participantId: 'ana',
        texto: 'El mercado regula mejor porque compite.',
        tipoDeclarado: 'nuevo',
        stanceId: 'izquierda',
      }),
    ]);
    expect(estado.turnos.turnoEnCurso.presentacion.texto).toBe('El mercado regula mejor porque compite.');
  });

  it('ignora el anuncio de un turno que ya no es el que está en curso', () => {
    const estado = reducir([
      ingreso,
      aceptado,
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 'otro-turno', participantId: 'ana', texto: 'tarde' }),
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 't1', participantId: 'luis', texto: 'ajeno' }),
    ]);
    expect(estado.turnos.turnoEnCurso.presentacion).toBeUndefined();
  });

  it('desaparece con el turno cuando el argumento se publica', () => {
    const estado = reducir([
      ingreso,
      aceptado,
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 't1', participantId: 'ana', texto: 'algo' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        turnId: 't1',
        ronda: 1,
        posicionEnRonda: 1,
        texto: 'algo',
      }),
    ]);
    expect(estado.turnos.turnoEnCurso).toBeNull();
  });
});

describe('exposiciones por calificar de un co-moderador', () => {
  const estadoConDosExposiciones = () =>
    reducir([
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a2', participantId: 'luis', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 't1', participantId: 'ana', argumentId: 'a1', texto: 'x' }),
      evento(EVENTOS.EXPOSICION_TERMINADA, { turnId: 't1', participantId: 'ana', argumentId: 'a1' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't2', candidateId: 'luis' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't2', participantId: 'luis' }),
      evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, { turnId: 't2', participantId: 'luis', argumentId: 'a2', texto: 'y' }),
    ]);

  it('ofrece primero la que se está diciendo ahora y después las ya terminadas', () => {
    const pendientes = obtenerExposicionesSinCalificar(estadoConDosExposiciones(), { coModeradorId: 'carla' });

    expect(pendientes.map((exposicion) => exposicion.argumentId)).toEqual(['a2', 'a1']);
  });

  it('no vuelve a ofrecer la que este co-moderador ya calificó, pero sí al otro', () => {
    const estado = reducirEventos(
      estadoConDosExposiciones(),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' })
    );

    expect(obtenerExposicionesSinCalificar(estado, { coModeradorId: 'carla' }).map((e) => e.argumentId)).toEqual(['a2']);
    expect(obtenerExposicionesSinCalificar(estado, { coModeradorId: 'diego' })).toHaveLength(2);
  });

  it('nadie califica su propia exposición', () => {
    const pendientes = obtenerExposicionesSinCalificar(estadoConDosExposiciones(), {
      coModeradorId: 'carla',
      excluirParticipantId: 'luis',
    });

    expect(pendientes.map((exposicion) => exposicion.argumentId)).toEqual(['a1']);
  });
});

describe('podios de posturas e individual', () => {
  const programaSimulado = {
    posturas: [
      { id: 'izquierda', etiqueta: 'Izquierda', color: '#2563eb' },
      { id: 'derecha', etiqueta: 'Derecha', color: '#dc2626' },
    ],
  };

  const estadoSimulado = reducir([
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda', nombre: 'Ana' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha', nombre: 'Luis' }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'ana', delta: 50, nuevoTotal: 50 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'luis', delta: 20, nuevoTotal: 20 }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', stanceId: 'izquierda', texto: 'Premisa A' }),
  ]);

  it('calcularPodioDePosturas ordena las posturas por puntaje total acumulado', () => {
    const podio = calcularPodioDePosturas(estadoSimulado, programaSimulado, []);
    expect(podio[0].stanceId).toBe('izquierda');
    expect(podio[0].puntajeTotalPostura).toBe(50);
    expect(podio[1].stanceId).toBe('derecha');
    expect(podio[1].puntajeTotalPostura).toBe(20);
  });

  it('calcularPodioIndividual incluye a todos los estudiantes ordenados por puntaje', () => {
    const podio = calcularPodioIndividual(estadoSimulado, []);
    expect(podio).toHaveLength(2);
    expect(podio[0].participantId).toBe('ana');
    expect(podio[0].posicion).toBe(1);
    expect(podio[1].participantId).toBe('luis');
    expect(podio[1].posicion).toBe(2);
  });
});
