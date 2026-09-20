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
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        turnId: 't1',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(estado.participantes.ana.argumentoListo).toBe(false);
  });

  it('un argumento publicado sin turno en curso (ej. ingreso) también consume el "listo" propio', () => {
    // El ingreso nunca pasa por turno.ofrecido/aceptado, pero tampoco depende de este caso:
    // si no hay turnoEnCurso, no hay nadie a quien "cortarle" el turno, así que el listo de
    // quien publica se actualiza igual porque nunca estaba en true en primer lugar.
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-1',
        participantId: 'marta',
        turnId: 'ingreso-marta',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(estado.participantes.marta.argumentoListo).toBe(false);
  });

  it('un bid aprobado de otro participante NO corta el turno de quien tiene la palabra ni le toca su "listo"', () => {
    // Bug real reportado en prueba en vivo: al aprobar el bid de Luis, el reducer cortaba el
    // turno de Ana (que seguía exponiendo) porque el argumento del bid reusa el turnId del
    // turno principal — y de paso apagaba el "listo" de Luis para su propio argumento
    // preparado, que quedaba huérfano.
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'luis' }),
      // El bid de Luis se aprueba mientras Ana sigue con la palabra — motorDeSesion publica
      // esto con turnId: bid.turnoPrincipalId, que es el mismo t1 de Ana.
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'bid-arg-1',
        participantId: 'luis',
        turnId: 't1',
        posicionEnRonda: 1,
        ronda: 1,
        tipoDeclarado: 'contraargumento',
      }),
    ]);

    expect(estado.turnos.turnoEnCurso).toEqual({ turnId: 't1', participantId: 'ana', modo: 'argumento' });
    expect(estado.participantes.luis.argumentoListo).toBe(true);
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

  // docs/04: el tope es de rechazos CONSECUTIVOS. Sin reset, tres rechazos sueltos en toda la
  // sesión dejaban a esa persona en modo forzado para siempre.
  it('aceptar un turno corta la racha de rechazos', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't2', participantId: 'ana', totalRechazosDelParticipante: 2 }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't3', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't3', participantId: 'ana' }),
    ]);

    expect(estado.participantes.ana.rechazosAcumulados).toBe(0);
  });

  it('un turno forzado también corta la racha: si no, todos los siguientes serían forzados', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 3 }),
      evento(EVENTOS.TURNO_FORZADO, { turnId: 't2', participantId: 'ana' }),
    ]);

    expect(estado.participantes.ana.rechazosAcumulados).toBe(0);
  });
});

describe('cortacircuitos de ruleta y rechazos consecutivos', () => {
  it('incrementa fallosConsecutivosDeOferta con rechazos y expiraciones', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_EXPIRADO, { turnId: 't2', candidateId: 'luis' }),
    ]);

    expect(estado.turnos.fallosConsecutivosDeOferta).toBe(2);
  });

  it('reinicia fallosConsecutivosDeOferta a 0 cuando un turno es aceptado', () => {
    const estado = reducirTodos([
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_EXPIRADO, { turnId: 't2', candidateId: 'luis' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't3', participantId: 'marta' }),
    ]);

    expect(estado.turnos.fallosConsecutivosDeOferta).toBe(0);
  });

  it('pausa y reanuda la ruleta con los eventos correspondientes', () => {
    let estado = reducirTodos([
      evento(EVENTOS.TURNO_RULETA_PAUSADA, { motivo: 'Cortacircuitos por 4 rechazos' }),
    ]);

    expect(estado.turnos.ruletaPausada).toBe(true);
    expect(estado.turnos.motivoPausa).toBe('Cortacircuitos por 4 rechazos');

    estado = reducirEventos(estado, evento(EVENTOS.TURNO_RULETA_REANUDADA));

    expect(estado.turnos.ruletaPausada).toBe(false);
    expect(estado.turnos.fallosConsecutivosDeOferta).toBe(0);
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
