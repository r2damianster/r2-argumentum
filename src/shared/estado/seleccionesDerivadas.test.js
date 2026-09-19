import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import {
  combinarParticipantesConPresencia,
  completarPresenciaConParticipantes,
  nombreDeParticipante,
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
