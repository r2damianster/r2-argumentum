import { describe, expect, it } from 'vitest';
import {
  calcularMetricasDeParticipacion,
  calcularOrdinalDelTipo,
  clasificarAportes,
  listarPostsSinDebatir,
  listarRespuestasPendientesParaParticipante,
} from './calcularMetricasDeParticipacion.js';

const MINUTO = 60 * 1000;
const AHORA = 10_000_000;

function crearEstado({ participantes, aportes, respuestas = [] }) {
  const argumentos = Object.fromEntries(
    aportes.map((aporte) => [aporte.argumentId, { stanceId: 'a_favor', timestamp: AHORA, ...aporte }])
  );
  const conexiones = Object.fromEntries(
    respuestas.map(([origen, destino], indice) => [
      `enlace-${indice}`,
      { linkId: `enlace-${indice}`, sourceArgumentId: origen, targetArgumentId: destino },
    ])
  );
  return {
    participantes: Object.fromEntries(
      participantes.map(([participantId, rol = 'participante', ingresoConfirmado = true]) => [
        participantId,
        { participantId, rol, ingresoConfirmado },
      ])
    ),
    argumentos,
    conexiones,
  };
}

describe('clasificarAportes', () => {
  it('separa posts de réplicas según las conexiones', () => {
    const estado = crearEstado({
      participantes: [['ana'], ['luis']],
      aportes: [
        { argumentId: 'post-1', participantId: 'ana' },
        { argumentId: 'replica-1', participantId: 'luis' },
      ],
      respuestas: [['replica-1', 'post-1']],
    });
    const { posts, replicas, respuestasPorPost } = clasificarAportes(estado);
    expect(posts.map((post) => post.argumentId)).toEqual(['post-1']);
    expect(replicas.map((replica) => replica.argumentId)).toEqual(['replica-1']);
    expect(respuestasPorPost).toEqual({ 'post-1': 1 });
  });

  it('responderse a uno mismo no cuenta como réplica', () => {
    const estado = crearEstado({
      participantes: [['ana']],
      aportes: [
        { argumentId: 'post-1', participantId: 'ana' },
        { argumentId: 'post-2', participantId: 'ana' },
      ],
      respuestas: [['post-2', 'post-1']],
    });
    expect(clasificarAportes(estado).replicas).toHaveLength(0);
  });

  it('ignora los aportes ocultos', () => {
    const estado = crearEstado({
      participantes: [['ana']],
      aportes: [{ argumentId: 'post-1', participantId: 'ana', oculto: true }],
    });
    expect(clasificarAportes(estado).posts).toHaveLength(0);
  });
});

describe('calcularMetricasDeParticipacion', () => {
  it('al principio, sin ningún post, todo es cero', () => {
    const estado = crearEstado({ participantes: [['ana'], ['luis']], aportes: [] });
    expect(calcularMetricasDeParticipacion(estado)).toMatchObject({
      totalDePosts: 0,
      totalDeReplicas: 0,
      postsPorDebatiente: 0,
      replicasPorPost: 0,
      postsSinDebatir: 0,
      porcentajeDePostsSinDebatir: 0,
      debatientesSinIntervenir: 2,
    });
  });

  it('calcula promedios y porcentaje sin debatir', () => {
    const estado = crearEstado({
      participantes: [['ana'], ['luis'], ['marta'], ['pedro']],
      aportes: [
        { argumentId: 'post-1', participantId: 'ana' },
        { argumentId: 'post-2', participantId: 'luis' },
        { argumentId: 'replica-1', participantId: 'marta' },
      ],
      respuestas: [['replica-1', 'post-1']],
    });
    const metricas = calcularMetricasDeParticipacion(estado);
    expect(metricas.totalDePosts).toBe(2);
    expect(metricas.totalDeReplicas).toBe(1);
    expect(metricas.postsPorDebatiente).toBe(0.5);
    expect(metricas.replicasPorPost).toBe(0.5);
    expect(metricas.postsSinDebatir).toBe(1);
    expect(metricas.porcentajeDePostsSinDebatir).toBe(50);
    expect(metricas.debatientesSinIntervenir).toBe(1);
  });

  it('los co-moderadores y quienes no ingresaron no cuentan como debatientes', () => {
    const estado = crearEstado({
      participantes: [['ana'], ['comod', 'co_moderador'], ['oyente', 'participante', false]],
      aportes: [],
    });
    expect(calcularMetricasDeParticipacion(estado).totalDeDebatientes).toBe(1);
  });
});

describe('listarPostsSinDebatir', () => {
  const estado = crearEstado({
    participantes: [['ana'], ['luis'], ['marta']],
    aportes: [
      { argumentId: 'viejo-igual', participantId: 'ana', stanceId: 'a_favor', timestamp: AHORA - 6 * MINUTO },
      { argumentId: 'viejo-contrario', participantId: 'luis', stanceId: 'en_contra', timestamp: AHORA - 4 * MINUTO },
      { argumentId: 'reciente', participantId: 'marta', stanceId: 'en_contra', timestamp: AHORA - 30 * 1000 },
    ],
  });

  it('el más antiguo va primero', () => {
    const lista = listarPostsSinDebatir(estado, { ahora: AHORA });
    expect(lista.map((post) => post.argumentId)).toEqual(['viejo-igual', 'viejo-contrario', 'reciente']);
  });

  it('prefiere los de la postura contraria a la de quien pregunta', () => {
    const lista = listarPostsSinDebatir(estado, { ahora: AHORA, posturaDeQuienPregunta: 'a_favor' });
    expect(lista[0].argumentId).toBe('viejo-contrario');
  });

  it('no ofrece los posts propios', () => {
    const lista = listarPostsSinDebatir(estado, { ahora: AHORA, participantIdDeQuienPregunta: 'ana' });
    expect(lista.map((post) => post.argumentId)).not.toContain('viejo-igual');
  });

  it('puede exigir un tiempo mínimo de espera', () => {
    const lista = listarPostsSinDebatir(estado, { ahora: AHORA, minutosMinimos: 2 });
    expect(lista.map((post) => post.argumentId)).toEqual(['viejo-igual', 'viejo-contrario']);
  });
});

describe('listarRespuestasPendientesParaParticipante', () => {
  it('lista las respuestas que recibí y no he contestado, y deja de listarlas al contestar', () => {
    const sinContestar = crearEstado({
      participantes: [['ana'], ['luis']],
      aportes: [
        { argumentId: 'post-ana', participantId: 'ana', timestamp: AHORA - 5 * MINUTO },
        { argumentId: 'replica-luis', participantId: 'luis', timestamp: AHORA - 3 * MINUTO },
      ],
      respuestas: [['replica-luis', 'post-ana']],
    });
    expect(
      listarRespuestasPendientesParaParticipante(sinContestar, 'ana').map((respuesta) => respuesta.argumentId)
    ).toEqual(['replica-luis']);

    const contestada = crearEstado({
      participantes: [['ana'], ['luis']],
      aportes: [
        { argumentId: 'post-ana', participantId: 'ana', timestamp: AHORA - 5 * MINUTO },
        { argumentId: 'replica-luis', participantId: 'luis', timestamp: AHORA - 3 * MINUTO },
        { argumentId: 'contrarreplica-ana', participantId: 'ana', timestamp: AHORA - 1 * MINUTO },
      ],
      respuestas: [
        ['replica-luis', 'post-ana'],
        ['contrarreplica-ana', 'replica-luis'],
      ],
    });
    expect(listarRespuestasPendientesParaParticipante(contestada, 'ana')).toEqual([]);
  });

  it('a quien no le han respondido no le aparece nada', () => {
    const estado = crearEstado({
      participantes: [['ana'], ['luis']],
      aportes: [{ argumentId: 'post-ana', participantId: 'ana' }],
    });
    expect(listarRespuestasPendientesParaParticipante(estado, 'ana')).toEqual([]);
  });
});

describe('réplicas que declaran su objetivo en el propio aporte', () => {
  it('se reconocen aunque la conexión todavía no haya llegado', () => {
    const estado = crearEstado({
      participantes: [['ana'], ['luis']],
      aportes: [
        { argumentId: 'post-ana', participantId: 'ana' },
        { argumentId: 'replica-luis', participantId: 'luis', argumentoObjetivoId: 'post-ana' },
      ],
    });
    const { posts, replicas } = clasificarAportes(estado);
    expect(posts.map((aporte) => aporte.argumentId)).toEqual(['post-ana']);
    expect(replicas.map((aporte) => aporte.argumentId)).toEqual(['replica-luis']);
  });
});

describe('calcularOrdinalDelTipo', () => {
  const estado = crearEstado({
    participantes: [['ana'], ['luis']],
    aportes: [
      { argumentId: 'luis-post', participantId: 'luis', timestamp: 1 },
      { argumentId: 'ana-post-1', participantId: 'ana', timestamp: 2 },
      { argumentId: 'ana-replica-1', participantId: 'ana', timestamp: 3, argumentoObjetivoId: 'luis-post' },
      { argumentId: 'ana-post-2', participantId: 'ana', timestamp: 4 },
      { argumentId: 'ana-replica-2', participantId: 'ana', timestamp: 5, argumentoObjetivoId: 'luis-post' },
    ],
  });

  it('numera por separado los posts y las réplicas de cada persona, por orden de publicación', () => {
    const ordinal = (id) => calcularOrdinalDelTipo(estado, estado.argumentos[id]);
    expect(ordinal('ana-post-1')).toEqual({ esReplica: false, ordinalDelTipo: 1 });
    expect(ordinal('ana-post-2')).toEqual({ esReplica: false, ordinalDelTipo: 2 });
    expect(ordinal('ana-replica-1')).toEqual({ esReplica: true, ordinalDelTipo: 1 });
    expect(ordinal('ana-replica-2')).toEqual({ esReplica: true, ordinalDelTipo: 2 });
    expect(ordinal('luis-post')).toEqual({ esReplica: false, ordinalDelTipo: 1 });
  });

  it('ocultar un aporte no corre el orden de los demás', () => {
    const conOculto = crearEstado({
      participantes: [['ana']],
      aportes: [
        { argumentId: 'p1', participantId: 'ana', timestamp: 1, oculto: true },
        { argumentId: 'p2', participantId: 'ana', timestamp: 2 },
      ],
    });
    expect(calcularOrdinalDelTipo(conOculto, conOculto.argumentos.p2).ordinalDelTipo).toBe(2);
  });
});
