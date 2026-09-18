import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

function reducirTodos(eventos) {
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('argumento listo — entrada a la ruleta', () => {
  it('preparar un argumento marca al participante como listo', () => {
    const estado = reducirTodos([evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' })]);

    expect(estado.participantes.ana.argumentoListo).toBe(true);
  });

  it('exponer el argumento consume el "listo": hay que preparar otro para volver a la ruleta', () => {
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(estado.participantes.ana.argumentoListo).toBe(false);
  });
});

describe('modo del turno', () => {
  it('por defecto el turno es para defender un argumento escrito', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: 1 }),
    ]);

    expect(estado.turnos.ofertaActiva.modo).toBe('argumento');
  });

  it('el turno hablado se marca como verbal y el modo sobrevive al aceptarlo', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: 1, modo: 'verbal' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
    ]);

    expect(estado.turnos.turnoEnCurso.modo).toBe('verbal');
  });
});

describe('rechazo del turno', () => {
  it('queda registrado con su participante para poder penalizarlo una sola vez', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: 1 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
    ]);

    expect(estado.turnos.rechazos).toEqual([{ turnId: 't1', participantId: 'ana' }]);
  });

  it('acumula un registro por cada rechazo', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't2', participantId: 'luis', totalRechazosDelParticipante: 1 }),
    ]);

    expect(estado.turnos.rechazos).toHaveLength(2);
  });
});

describe('intervención hablada', () => {
  it('cuenta como intervención y libera el turno', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: 1, modo: 'verbal' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, {
        intervencionId: 'v1',
        participantId: 'ana',
        turnId: 't1',
        resumen: 'Habló de la libertad.',
      }),
    ]);

    expect(estado.participantes.ana.intervenciones).toBe(1);
    expect(estado.turnos.turnoEnCurso).toBeNull();
    expect(estado.intervencionesVerbales.v1.calificacion).toBeNull();
  });

  it('el co-moderador la califica una sola vez', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, { intervencionId: 'v1', participantId: 'ana', turnId: 't1' }),
      evento(EVENTOS.INTERVENCION_VERBAL_CALIFICADA, {
        intervencionId: 'v1',
        coModeradorId: 'luis',
        calidad: 'buena',
      }),
      evento(EVENTOS.INTERVENCION_VERBAL_CALIFICADA, {
        intervencionId: 'v1',
        coModeradorId: 'marta',
        calidad: 'insuficiente',
      }),
    ]);

    expect(estado.intervencionesVerbales.v1.calificacion.calidad).toBe('buena');
    expect(estado.intervencionesVerbales.v1.calificacion.coModeradorId).toBe('luis');
  });
});

describe('posturas propuestas', () => {
  it('aceptar una propuesta la deja resuelta con su nuevo id de postura', () => {
    const estado = reducirTodos([
      evento(EVENTOS.POSTURA_PROPUESTA, {
        propuestaId: 'p1',
        participantId: 'ana',
        etiquetaPropuesta: 'Homo viator',
      }),
      evento(EVENTOS.POSTURA_DECISION_MODERADOR, { propuestaId: 'p1', decision: 'aceptada', stanceId: 'homo_viator' }),
    ]);

    expect(estado.posturasPropuestas.p1.decision).toBe('aceptada');
    expect(estado.posturasPropuestas.p1.stanceId).toBe('homo_viator');
  });

  it('una propuesta ya resuelta no se vuelve a decidir', () => {
    const estado = reducirTodos([
      evento(EVENTOS.POSTURA_PROPUESTA, { propuestaId: 'p1', participantId: 'ana', etiquetaPropuesta: 'X' }),
      evento(EVENTOS.POSTURA_DECISION_MODERADOR, { propuestaId: 'p1', decision: 'aceptada', stanceId: 'x' }),
      evento(EVENTOS.POSTURA_DECISION_MODERADOR, { propuestaId: 'p1', decision: 'rechazada', stanceId: null }),
    ]);

    expect(estado.posturasPropuestas.p1.decision).toBe('aceptada');
  });
});
