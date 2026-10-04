import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

function reducirTodos(eventos) {
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

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

describe('designación de co-moderadores', () => {
  const ingresar = (participantId) => evento(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: 'a_favor' });

  it('marca como co-moderadores a los designados', () => {
    const estado = reducirTodos([
      ingresar('ana'),
      ingresar('luis'),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['ana'] }),
    ]);
    expect(estado.participantes.ana.rol).toBe('co_moderador');
    expect(estado.participantes.luis.rol).toBe('participante');
  });

  it('al volver a designar, quien ya no está en la lista deja de ser co-moderador', () => {
    const estado = reducirTodos([
      ingresar('ana'),
      ingresar('luis'),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['ana'] }),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['luis'] }),
    ]);
    expect(estado.participantes.ana.rol).toBe('participante');
    expect(estado.participantes.luis.rol).toBe('co_moderador');
    expect(estado.coModeradores.participantIds).toEqual(['luis']);
  });

  it('una designación vacía deja a todos como participantes', () => {
    const estado = reducirTodos([
      ingresar('ana'),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['ana'] }),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: [] }),
    ]);
    expect(estado.participantes.ana.rol).toBe('participante');
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


describe('foro escrito: fase con tiempo total', () => {
  it('una fase con duración la guarda; una sin duración no trae tiempo', () => {
    const conTiempo = reducirTodos([evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 })]);
    expect(conTiempo.fase.actual).toMatchObject({ tipo: 'foro_escrito', duracionMin: 20, extensionesMin: 0 });

    const sinTiempo = reducirTodos([evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 })]);
    expect(sinTiempo.fase.actual.duracionMin).toBeUndefined();
  });

  it('el moderador puede extender el tiempo, varias veces', () => {
    const estado = reducirTodos([
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 }),
      evento(EVENTOS.FASE_EXTENDIDA, { minutos: 5 }),
      evento(EVENTOS.FASE_EXTENDIDA, { minutos: 5 }),
    ]);
    expect(estado.fase.actual.extensionesMin).toBe(10);
  });

  it('extender una fase sin tiempo total, o con minutos inválidos, no hace nada', () => {
    const sinTiempo = reducirTodos([
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
      evento(EVENTOS.FASE_EXTENDIDA, { minutos: 5 }),
    ]);
    expect(sinTiempo.fase.actual.extensionesMin).toBeUndefined();

    const invalida = reducirTodos([
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 }),
      evento(EVENTOS.FASE_EXTENDIDA, { minutos: -3 }),
    ]);
    expect(invalida.fase.actual.extensionesMin).toBe(0);
  });
});

describe('foro escrito: reacciones y aportes ocultos', () => {
  const publicarAporte = evento(EVENTOS.ARGUMENTO_PUBLICADO, {
    argumentId: 'p1',
    participantId: 'ana',
    posicionEnRonda: 1,
    ronda: 1,
  });

  it('cada persona tiene una sola reacción por aporte: la nueva reemplaza a la anterior', () => {
    const estado = reducirTodos([
      publicarAporte,
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'me_convencio' }),
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'me_hizo_dudar' }),
    ]);
    expect(estado.reacciones.p1).toEqual({ luis: 'me_hizo_dudar' });
  });

  it('tipo null quita la reacción', () => {
    const estado = reducirTodos([
      publicarAporte,
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'aporta_evidencia' }),
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: null }),
    ]);
    expect(estado.reacciones.p1).toEqual({});
  });

  it('nadie reacciona a lo propio, ni a un aporte que no existe, ni con un tipo inventado', () => {
    const estado = reducirTodos([
      publicarAporte,
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'ana', tipo: 'me_convencio' }),
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'no-existe', participantId: 'luis', tipo: 'me_convencio' }),
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'me_gusta' }),
    ]);
    expect(estado.reacciones).toEqual({});
  });

  it('ocultar un aporte lo marca y restaurarlo lo devuelve, sin borrarlo del estado', () => {
    const oculto = reducirTodos([
      publicarAporte,
      evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'host', motivo: 'Fuera de tema' }),
    ]);
    expect(oculto.argumentos.p1).toMatchObject({ oculto: true, ocultadoPor: 'host', motivoDeOcultar: 'Fuera de tema' });

    const restaurado = reducirEventos(oculto, evento(EVENTOS.APORTE_RESTAURADO, { argumentId: 'p1', porId: 'host' }));
    expect(restaurado.argumentos.p1).toMatchObject({ oculto: false, ocultadoPor: null });
  });

  it('una copia local anterior a las reacciones se actualiza sin romperse', () => {
    const copiaAntigua = { ...estadoInicial() };
    delete copiaAntigua.reacciones;
    const estado = reducirEventos(copiaAntigua, publicarAporte);
    expect(estado.reacciones).toEqual({});
  });
});

describe('foro escrito: revisión humana de los aportes', () => {
  const PREPARACION = [
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego', stanceId: 'en_contra' }),
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'p1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
  ];

  it('cada co-moderador decide una vez por aporte: la última decisión reemplaza a la anterior', () => {
    const estado = reducirTodos([
      ...PREPARACION,
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 0.5 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0 }),
    ]);
    expect(estado.revisiones.p1.niveles).toEqual({ carla: 0.5, diego: 0 });
  });

  it('solo cuentan los votos de co-moderadores, sobre aportes ajenos y con un nivel válido', () => {
    const estado = reducirTodos([
      ...PREPARACION,
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'ana', nivel: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'no-existe', revisorId: 'carla', nivel: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 0.7 }),
    ]);
    expect(estado.revisiones).toEqual({});
  });

  it('un co-moderador no puede revisar su propio aporte', () => {
    const estado = reducirTodos([
      ...PREPARACION,
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'p2', participantId: 'carla', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p2', revisorId: 'carla', nivel: 1 }),
    ]);
    expect(estado.revisiones.p2).toBeUndefined();
  });

  it('una decisión de co-moderador publicada a nombre de otra persona se ignora', () => {
    const estado = reducirTodos([
      ...PREPARACION,
      { name: EVENTOS.REVISION_REGISTRADA, clientId: 'ana', data: { argumentId: 'p1', revisorId: 'carla', nivel: 1 } },
    ]);
    expect(estado.revisiones).toEqual({});
  });

  it('el moderador decide con su identidad; con otra, la decisión se ignora', () => {
    const delModerador = reducirTodos([
      ...PREPARACION,
      { name: EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, clientId: 'host', data: { argumentId: 'p1', decision: 'evaluada', nivel: 0 } },
    ]);
    expect(delModerador.revisiones.p1.decisionModerador).toEqual({ decision: 'evaluada', nivel: 0 });

    const falsificada = reducirTodos([
      ...PREPARACION,
      { name: EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, clientId: 'ana', data: { argumentId: 'p1', decision: 'evaluada', nivel: 1 } },
    ]);
    expect(falsificada.revisiones).toEqual({});
  });

  it('el moderador puede descartar, evaluar y deshacer; una decisión inválida se ignora', () => {
    const descartada = reducirTodos([
      ...PREPARACION,
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'descartada' }),
    ]);
    expect(descartada.revisiones.p1.decisionModerador).toEqual({ decision: 'descartada', nivel: null });

    const deshecha = reducirEventos(descartada, evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'sin_evaluar' }));
    expect(deshecha.revisiones.p1.decisionModerador).toBeNull();

    const invalida = reducirEventos(descartada, evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'evaluada', nivel: 3 }));
    expect(invalida.revisiones.p1.decisionModerador).toEqual({ decision: 'descartada', nivel: null });
  });

  it('la decisión del moderador convive con los votos de los co-moderadores', () => {
    const estado = reducirTodos([
      ...PREPARACION,
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 1 }),
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'evaluada', nivel: 0.5 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0 }),
    ]);
    expect(estado.revisiones.p1.niveles).toEqual({ carla: 1, diego: 0 });
    expect(estado.revisiones.p1.decisionModerador.nivel).toBe(0.5);
  });
});

describe('foro escrito: quién puede ocultar y reaccionar', () => {
  const BASE = [
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis' }),
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla'] }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'p1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
  ];

  it('un co-moderador puede ocultar, pero no restaurar', () => {
    const oculto = reducirTodos([...BASE, evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'carla' })]);
    expect(oculto.argumentos.p1.oculto).toBe(true);

    const intentoDeRestaurar = reducirEventos(oculto, evento(EVENTOS.APORTE_RESTAURADO, { argumentId: 'p1', porId: 'carla' }));
    expect(intentoDeRestaurar.argumentos.p1.oculto).toBe(true);
  });

  it('un participante común no puede ocultar el aporte de otra persona', () => {
    const estado = reducirTodos([...BASE, evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'luis' })]);
    expect(estado.argumentos.p1.oculto).toBeUndefined();
  });

  it('no se puede ocultar a nombre del moderador desde otra conexión', () => {
    const estado = reducirTodos([
      ...BASE,
      { name: EVENTOS.APORTE_OCULTADO, clientId: 'luis', data: { argumentId: 'p1', porId: 'host' } },
    ]);
    expect(estado.argumentos.p1.oculto).toBeUndefined();
  });

  it('nadie reacciona a nombre de otra persona', () => {
    const estado = reducirTodos([
      ...BASE,
      { name: EVENTOS.REACCION_REGISTRADA, clientId: 'luis', data: { argumentId: 'p1', participantId: 'carla', tipo: 'me_convencio' } },
    ]);
    expect(estado.reacciones).toEqual({});
  });
});
