import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

function reducirTodos(eventos) {
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('apertura — máquina de rondas', () => {
  it('registra la ronda vigente con su plazo', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
    ]);

    expect(estado.apertura).toMatchObject({ ronda: 1, expiraEn: 4000, cerrada: false });
  });

  it('la extensión mueve el plazo de la ronda en curso', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_EXTENDIDA, { ronda: 1, hasta: 64000 }),
    ]);

    expect(estado.apertura.expiraEn).toBe(64000);
  });

  it('ignora una extensión dirigida a otra ronda', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 2, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_EXTENDIDA, { ronda: 1, hasta: 64000 }),
    ]);

    expect(estado.apertura.expiraEn).toBe(4000);
  });

  it('un cierre no final deja la sesión esperando la decisión del host, sin excluir a nadie', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_CERRADA, {
        ronda: 1,
        aprobados: ['ana'],
        pendientes: ['luis'],
        esFinal: false,
      }),
    ]);

    expect(estado.apertura.esperandoSegundaOportunidad).toBe(true);
    expect(estado.participantes.luis?.sinArgumentoDeApertura).toBeFalsy();
  });

  it('el cierre final marca a los pendientes como sin argumento', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 2, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_CERRADA, {
        ronda: 2,
        aprobados: ['ana'],
        pendientes: ['luis'],
        esFinal: true,
      }),
    ]);

    expect(estado.participantes.luis.sinArgumentoDeApertura).toBe(true);
    expect(estado.participantes.ana?.sinArgumentoDeApertura).toBeFalsy();
    expect(estado.apertura.esperandoSegundaOportunidad).toBe(false);
  });
});

describe('argumentos', () => {
  it('posicionesCompletadas nunca retrocede ante eventos fuera de orden', () => {
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a2',
        participantId: 'ana',
        posicionEnRonda: 2,
        ronda: 1,
      }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(estado.participantes.ana.posicionesCompletadas).toBe(2);
  });
});

describe('exposición de un argumento ya publicado', () => {
  const ARGUMENTO_PENDIENTE = {
    argumentId: 'a1',
    participantId: 'ana',
    posicionEnRonda: 1,
    ronda: 1,
    pendienteDeExposicion: true,
  };

  const TURNO_ACEPTADO_DE_ANA = [
    evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', modo: 'argumento' }),
    evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
  ];

  const ANUNCIO_DE_ANA = evento(EVENTOS.ARGUMENTO_EN_EXPOSICION, {
    turnId: 't1',
    participantId: 'ana',
    argumentId: 'a1',
    texto: 'texto',
  });

  const EXPOSICION_DE_ANA_EN_CURSO = [
    evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE),
    ...TURNO_ACEPTADO_DE_ANA,
    ANUNCIO_DE_ANA,
  ];

  it('publicar al aprobarse deja el argumento en el mapa, listo para la ruleta y sin contar como intervención', () => {
    const estado = reducirTodos([evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE)]);

    expect(estado.argumentos.a1).toBeDefined();
    expect(estado.participantes.ana).toMatchObject({
      argumentoListo: true,
      argumentoPendienteId: 'a1',
      intervenciones: 0,
      posicionesCompletadas: 1,
    });
  });

  it('publicar un argumento pendiente no cierra el turno de quien habla ahora', () => {
    const estado = reducirTodos([
      ...TURNO_ACEPTADO_DE_ANA,
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { ...ARGUMENTO_PENDIENTE, argumentId: 'a2', posicionEnRonda: 2 }),
    ]);

    expect(estado.turnos.turnoEnCurso?.participantId).toBe('ana');
  });

  it('anunciar la exposición crea el registro que los co-moderadores pueden calificar', () => {
    const estado = reducirTodos(EXPOSICION_DE_ANA_EN_CURSO);

    expect(estado.exposiciones.a1).toMatchObject({ participantId: 'ana', turnId: 't1', estado: 'en_curso' });
  });

  it('terminar la exposición libera el turno, cuenta como intervención y apaga el «listo»', () => {
    const estado = reducirTodos([
      ...EXPOSICION_DE_ANA_EN_CURSO,
      evento(EVENTOS.EXPOSICION_TERMINADA, { turnId: 't1', participantId: 'ana', argumentId: 'a1' }),
    ]);

    expect(estado.turnos.turnoEnCurso).toBeNull();
    expect(estado.exposiciones.a1.estado).toBe('terminada');
    expect(estado.participantes.ana).toMatchObject({
      argumentoListo: false,
      argumentoPendienteId: null,
      intervenciones: 1,
    });
  });

  it('un «terminada» repetido no cuenta dos intervenciones', () => {
    const terminada = evento(EVENTOS.EXPOSICION_TERMINADA, { turnId: 't1', participantId: 'ana', argumentId: 'a1' });
    const estado = reducirTodos([...EXPOSICION_DE_ANA_EN_CURSO, terminada, terminada]);

    expect(estado.participantes.ana.intervenciones).toBe(1);
  });

  it('cada co-moderador califica una vez: la segunda nota reemplaza a la primera', () => {
    const estado = reducirTodos([
      ...EXPOSICION_DE_ANA_EN_CURSO,
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'insuficiente' }),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'buena' }),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'diego', calidad: 'aceptable' }),
    ]);

    expect(estado.exposiciones.a1.calificaciones).toEqual({
      carla: { calidad: 'buena', nota: '' },
      diego: { calidad: 'aceptable', nota: '' },
    });
  });

  it('ignora una calificación con una calidad desconocida o de una exposición inexistente', () => {
    const estado = reducirTodos([
      ...EXPOSICION_DE_ANA_EN_CURSO,
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'a1', coModeradorId: 'carla', calidad: 'genial' }),
      evento(EVENTOS.EXPOSICION_CALIFICADA, { argumentId: 'nada', coModeradorId: 'carla', calidad: 'buena' }),
    ]);

    expect(estado.exposiciones.a1.calificaciones).toEqual({});
    expect(estado.exposiciones.nada).toBeUndefined();
  });

  it('el moderador puede evaluar, cambiar de idea, descartar y deshacer', () => {
    const conDecision = (decision, calidad) =>
      reducirTodos([
        ...EXPOSICION_DE_ANA_EN_CURSO,
        evento(EVENTOS.EXPOSICION_EVALUADA_POR_MODERADOR, { argumentId: 'a1', decision: 'evaluada', calidad: 'buena' }),
        evento(EVENTOS.EXPOSICION_EVALUADA_POR_MODERADOR, { argumentId: 'a1', decision, calidad }),
      ]).exposiciones.a1.decisionModerador;

    expect(conDecision('evaluada', 'insuficiente')).toEqual({ decision: 'evaluada', calidad: 'insuficiente' });
    expect(conDecision('descartada')).toEqual({ decision: 'descartada', calidad: null });
    expect(conDecision('sin_evaluar')).toBeNull();
  });

  it('el host que termina el turno deja la exposición interrumpida y conserva el argumento pendiente', () => {
    const estado = reducirTodos([
      ...EXPOSICION_DE_ANA_EN_CURSO,
      evento(EVENTOS.TURNO_TERMINADO_POR_HOST, { turnId: 't1', participantId: 'ana' }),
    ]);

    expect(estado.exposiciones.a1.estado).toBe('interrumpida');
    expect(estado.participantes.ana.argumentoListo).toBe(true);
  });

  it('una copia local vieja, sin el campo de exposiciones, no rompe el reducer', () => {
    const { exposiciones, ...estadoViejo } = estadoInicial();

    const estado = reducirEventos(estadoViejo, evento(EVENTOS.ARGUMENTO_PUBLICADO, ARGUMENTO_PENDIENTE));

    expect(estado.exposiciones).toEqual({});
  });

  it('el argumento de ingreso con pendienteDeExposicion marca argumentoListo: true y conserva intervenciones: 0', () => {
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'ingreso-ana',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
        esArgumentoDeIngreso: true,
        pendienteDeExposicion: true,
      }),
    ]);

    expect(estado.participantes.ana.argumentoListo).toBe(true);
    expect(estado.participantes.ana.argumentoPendienteId).toBe('ingreso-ana');
    expect(estado.participantes.ana.intervenciones).toBe(0);
  });
});

