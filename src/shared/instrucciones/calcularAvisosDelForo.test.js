import { describe, expect, it } from 'vitest';
import { calcularAvisosDelForo } from './calcularAvisosDelForo.js';

const MINUTO = 60 * 1000;
const INICIO = 8_000_000;
const FASE_DEL_FORO = { tipo: 'foro_escrito', iniciadaEn: INICIO, duracionMin: 20, extensionesMin: 0 };

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
  { participantId: 'marta', nombre: 'Marta', conectado: true },
];

function crearEstado({ fase = FASE_DEL_FORO, argumentos = {}, cerrada = false, stances = ['a', 'b', 'a'] } = {}) {
  const ids = ['ana', 'luis', 'marta'];
  return {
    programa: { posturas: [{ id: 'a', etiqueta: 'A' }, { id: 'b', etiqueta: 'B' }] },
    fase: { actual: fase, historial: [] },
    sesion: { cerrada },
    participantes: Object.fromEntries(
      ids.map((participantId, indice) => [
        participantId,
        { participantId, rol: 'participante', ingresoConfirmado: true, stanceId: stances[indice] },
      ])
    ),
    argumentos,
    conexiones: {},
  };
}

function ids(avisos) {
  return avisos.map((aviso) => aviso.id);
}

describe('calcularAvisosDelForo', () => {
  it('no avisa nada con la sesión cerrada ni en la fase de cierre', () => {
    expect(calcularAvisosDelForo(crearEstado({ cerrada: true }), PRESENCIA, INICIO)).toEqual([]);
    expect(calcularAvisosDelForo(crearEstado({ fase: { tipo: 'cierre_y_ranking' } }), PRESENCIA, INICIO)).toEqual([]);
  });

  it('avisa si pasan 2 minutos sin ningún post', () => {
    const pronto = calcularAvisosDelForo(crearEstado(), PRESENCIA, INICIO + 1 * MINUTO);
    expect(ids(pronto)).not.toContain('foro-sin-posts');
    const tarde = calcularAvisosDelForo(crearEstado(), PRESENCIA, INICIO + 3 * MINUTO);
    expect(ids(tarde)).toContain('foro-sin-posts');
  });

  it('avisa de los posts que llevan más de 2 minutos sin respuesta', () => {
    const estado = crearEstado({
      argumentos: { p1: { argumentId: 'p1', participantId: 'ana', timestamp: INICIO + MINUTO } },
    });
    expect(ids(calcularAvisosDelForo(estado, PRESENCIA, INICIO + 2 * MINUTO))).not.toContain('posts-sin-debatir');
    const aviso = calcularAvisosDelForo(estado, PRESENCIA, INICIO + 4 * MINUTO).find((a) => a.id === 'posts-sin-debatir');
    expect(aviso.texto).toMatch(/1 post/);
    expect(aviso.detalle).toContain('Ana');
  });

  it('un post con respuesta ya no está sin debatir', () => {
    const estado = crearEstado({
      argumentos: {
        p1: { argumentId: 'p1', participantId: 'ana', timestamp: INICIO },
        r1: { argumentId: 'r1', participantId: 'luis', timestamp: INICIO + 1000, argumentoObjetivoId: 'p1' },
      },
    });
    expect(ids(calcularAvisosDelForo(estado, PRESENCIA, INICIO + 10 * MINUTO))).not.toContain('posts-sin-debatir');
  });

  it('avisa de quienes no han publicado nada pasados 5 minutos', () => {
    const estado = crearEstado({
      argumentos: { p1: { argumentId: 'p1', participantId: 'ana', timestamp: INICIO } },
    });
    const aviso = calcularAvisosDelForo(estado, PRESENCIA, INICIO + 6 * MINUTO).find((a) => a.id === 'sin-intervenir');
    expect(aviso.texto).toMatch(/2 persona/);
    expect(aviso.detalle).toContain('Luis');
    expect(aviso.detalle).toContain('Marta');
  });

  it('en los últimos 2 minutos avisa y sugiere extender el tiempo', () => {
    const aviso = calcularAvisosDelForo(crearEstado(), PRESENCIA, INICIO + 19 * MINUTO).find((a) => a.id === 'tiempo-final');
    expect(aviso).toBeDefined();
  });

  it('avisa si todas las personas que entraron defienden la misma postura', () => {
    const estado = crearEstado({ stances: ['a', 'a', 'a'] });
    expect(ids(calcularAvisosDelForo(estado, PRESENCIA, INICIO))).toContain('desbalance-extremo-posturas');
  });
});
