import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { exportarAnexoDeIntegridad, exportarSesion } from './exportarSesion.js';

const PROGRAMA_DEL_FORO = {
  programId: 'foro-informe',
  titulo: 'Foro del informe',
  version: '1.0.0',
  actividad: 'foro_escrito',
  perfilDePuntaje: 'estandar',
  integridad: { nivel: 'advertencias' },
  posturas: [
    { id: 'a_favor', etiqueta: 'A favor' },
    { id: 'en_contra', etiqueta: 'En contra' },
  ],
  fases: [{ tipo: 'foro_escrito', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', emoji: '🦊', conectado: true },
  { participantId: 'luis', nombre: 'Luis', emoji: '🐼', conectado: true },
  { participantId: 'carla', nombre: 'Carla', emoji: '🐨', conectado: true },
  { participantId: 'diego', nombre: 'Diego', emoji: '🐯', conectado: true },
];

let marcaDeTiempo = 1000;
function evento(name, data = {}) {
  marcaDeTiempo += 1;
  return { name, data: { timestamp: marcaDeTiempo, ...data } };
}

function construir(programa, eventos) {
  const todos = [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa }), ...eventos];
  return { eventos: todos, estado: todos.reduce(reducirEventos, estadoInicial()) };
}

function sesionDelForo() {
  return construir(PROGRAMA_DEL_FORO, [
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'en_contra' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego', stanceId: 'en_contra' }),
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId: 'p1',
      participantId: 'ana',
      posicionEnRonda: 1,
      ronda: 1,
      stanceId: 'a_favor',
      tipoDeclarado: 'nuevo',
      texto: 'Texto del post de Ana',
      sugerenciaDeIA: { completitud: 'incompleto', falacias: [{ tipo: 'falsa_causa', fragmento: 'x', explicacion: 'y', confianza: 0.9 }] },
    }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId: 'r1',
      participantId: 'luis',
      posicionEnRonda: 1,
      ronda: 1,
      stanceId: 'en_contra',
      tipoDeclarado: 'contraargumento',
      argumentoObjetivoId: 'p1',
      texto: 'Réplica de Luis',
      sugerenciaDeIA: { completitud: 'completo', falacias: [] },
    }),
    evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'me_convencio' }),
    evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 0.5 }),
    evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0.5 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'ana', delta: 100, motivo: 'Post n.º 1', categoria: 'argumento', nuevoTotal: 100 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'luis', delta: 30, motivo: 'Réplica n.º 1', categoria: 'argumento', nuevoTotal: 30 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, {
      participantId: 'ana',
      delta: -50,
      motivo: 'Revisión del aporte: cuenta parcial (mayoría de co-moderadores)',
      categoria: 'argumento',
      nuevoTotal: 50,
    }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'carla', delta: 30, motivo: 'Calidad de sus revisiones', categoria: 'co_moderacion', nuevoTotal: 30 }),
    evento(EVENTOS.SESION_CERRADA),
  ]);
}

describe('exportarSesion: foro escrito', () => {
  const { eventos, estado } = sesionDelForo();
  const exportado = exportarSesion({ eventos, estado, programa: PROGRAMA_DEL_FORO, presencia: PRESENCIA });

  it('conserva lo de siempre y declara la actividad', () => {
    expect(exportado.actividad).toBe('foro_escrito');
    expect(exportado.estadoDeLaSesion).toBe('cerrada');
    expect(exportado.eventLogCompleto).toBe(eventos);
    expect(exportado.podioIndividual.length).toBeGreaterThan(0);
    expect(exportado.rankingPorPostura).toBeDefined();
  });

  it('explica de dónde sale el puntaje de cada persona, incluidos los co-moderadores', () => {
    const ana = exportado.desglosePorParticipante.find((fila) => fila.participantId === 'ana');
    expect(ana.nombre).toContain('Ana');
    expect(ana.subtotales.aportes).toBe(100);
    expect(ana.subtotales.revision).toBe(-50);
    expect(ana.totalFinal).toBe(50);
    const carla = exportado.desglosePorParticipante.find((fila) => fila.participantId === 'carla');
    expect(carla.rol).toBe('co_moderador');
    expect(carla.subtotales.coModeracion).toBe(30);
  });

  it('incluye la revisión aporte por aporte, con el nivel final y el ajuste', () => {
    const post = exportado.foro.revisionDeAportes.find((aporte) => aporte.argumentId === 'p1');
    expect(post).toMatchObject({
      autor: expect.stringContaining('Ana'),
      puntajeAlPublicar: 100,
      nivelFinal: 0.5,
      etiquetaDelNivelFinal: 'Cuenta parcial',
      origenDelNivelFinal: 'mayoria',
      ajusteAplicado: -50,
      votosDeCoModeradores: { cuenta: 0, parcial: 2, noCuenta: 0 },
    });
    const replica = exportado.foro.revisionDeAportes.find((aporte) => aporte.argumentId === 'r1');
    expect(replica).toMatchObject({ esReplica: true, etiquetaDelNivelFinal: 'Sin revisión: cuenta completo', ajusteAplicado: 0 });
  });

  it('incluye las métricas de participación y las reacciones con el convencimiento cruzado', () => {
    expect(exportado.foro.metricasDeParticipacion).toMatchObject({ totalDePosts: 1, totalDeReplicas: 1, porcentajeDePostsSinDebatir: 0 });
    expect(exportado.foro.reacciones.convencimientoCruzado).toBe(1);
  });

  it('evalúa a los co-moderadores con su acierto, esfuerzo y puntos', () => {
    const carla = exportado.evaluacionDeCoModeradores.find((fila) => fila.coModeradorId === 'carla');
    expect(carla).toMatchObject({ aportesRevisados: 1, aciertoSobreElAzarPorcentaje: 100, puntos: 30 });
  });

  it('resume las sugerencias de la IA solo en agregado, sin dejarlas junto a un nombre en el resumen', () => {
    expect(exportado.foro.resumenDeSugerenciasDeLaIA).toEqual({
      aportesConSugerencia: 2,
      aportesSinSugerencia: 0,
      completos: 1,
      incompletos: 1,
      sinRazon: 0,
      conPosiblesFalacias: 1,
    });
  });

  it('declara el nivel de integridad pero NO lleva las marcas de integridad', () => {
    expect(exportado.integridad).toEqual({ nivel: 'advertencias' });
    expect(JSON.stringify(exportado.foro)).not.toContain('advertenciaMostrada');
  });
});

describe('exportarSesion: debate hablado', () => {
  const programaHablado = { programId: 'h', titulo: 'Hablado', version: '1', perfilDePuntaje: 'estandar', posturas: [{ id: 'a', etiqueta: 'A' }], fases: [] };
  const { eventos, estado } = construir(programaHablado, [
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a' }),
  ]);
  const exportado = exportarSesion({ eventos, estado, programa: programaHablado, presencia: PRESENCIA });

  it('sigue siendo un debate hablado, sin la sección del foro', () => {
    expect(exportado.actividad).toBe('debate_hablado');
    expect(exportado.foro).toBeUndefined();
    expect(exportado.estadoDeLaSesion).toBe('parcial');
  });

  it('también trae el desglose y la evaluación de co-moderadores (vacía si no hubo revisiones)', () => {
    expect(Array.isArray(exportado.desglosePorParticipante)).toBe(true);
    expect(exportado.evaluacionDeCoModeradores).toEqual([]);
    expect(exportado.integridad).toEqual({ nivel: 'ninguna' });
  });
});

describe('exportarAnexoDeIntegridad', () => {
  const { estado } = sesionDelForo();
  const registros = [
    {
      idDelMensaje: 'm1',
      participantId: 'ana',
      argumentId: 'p1',
      contexto: 'foro',
      senales: [{ tipo: 'pegado', gravedad: 'alta', detalle: 'Pegó 412 caracteres' }],
      gravedadMaxima: 'alta',
      estadisticas: { pegadoCaracteres: 412 },
      advertenciaMostrada: true,
      enviadoEn: 5,
    },
  ];
  const anexo = exportarAnexoDeIntegridad({ registros, estado, programa: PROGRAMA_DEL_FORO, presencia: PRESENCIA });

  it('es un archivo aparte, confidencial y con la advertencia de que son señales, no pruebas', () => {
    expect(anexo.confidencial).toBe(true);
    expect(anexo.advertencia).toContain('no pruebas');
    expect(anexo.nivelDeIntegridad).toBe('advertencias');
  });

  it('agrupa por persona con su nombre, la evidencia y el texto del aporte', () => {
    expect(anexo.personas).toHaveLength(1);
    expect(anexo.personas[0].nombre).toContain('Ana');
    expect(anexo.personas[0].registros[0]).toMatchObject({
      textoDelAporte: 'Texto del post de Ana',
      advertenciaMostrada: true,
    });
  });

  it('sin registros no hay personas', () => {
    expect(exportarAnexoDeIntegridad({ registros: [], estado, programa: PROGRAMA_DEL_FORO, presencia: PRESENCIA }).personas).toEqual([]);
  });
});
