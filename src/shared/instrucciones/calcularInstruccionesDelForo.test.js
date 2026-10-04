import { describe, expect, it } from 'vitest';
import { calcularInstruccionesDelForo } from './calcularInstruccionesDelForo.js';

const MINUTO = 60 * 1000;
const INICIO = 5_000_000;

function crearEstado({ fase = null, cerrada = false, participantes = {}, argumentos = {} } = {}) {
  return {
    fase: { actual: fase, historial: [] },
    sesion: { cerrada },
    participantes,
    argumentos,
    conexiones: {},
  };
}

const FASE_DEL_FORO = { tipo: 'foro_escrito', iniciadaEn: INICIO, duracionMin: 20, extensionesMin: 0 };

describe('calcularInstruccionesDelForo', () => {
  it('antes de abrir el foro invita a esperar', () => {
    const instrucciones = calcularInstruccionesDelForo(crearEstado(), 'ana');
    expect(instrucciones.ahora).toMatch(/todavía no abre/);
  });

  it('con el foro abierto dice cuánto tiempo queda y qué se puede hacer', () => {
    const instrucciones = calcularInstruccionesDelForo(crearEstado({ fase: FASE_DEL_FORO }), 'ana', {
      ahora: INICIO + 5 * MINUTO,
    });
    expect(instrucciones.ahora).toContain('Quedan 15:00');
    expect(instrucciones.puedes.join(' ')).toMatch(/Publicar un post/);
    expect(instrucciones.tienesQue).toBeNull();
  });

  it('avisa cuando el tiempo se agotó', () => {
    const instrucciones = calcularInstruccionesDelForo(crearEstado({ fase: FASE_DEL_FORO }), 'ana', {
      ahora: INICIO + 21 * MINUTO,
    });
    expect(instrucciones.ahora).toContain('El tiempo se agotó');
  });

  it('a un co-moderador le dice que revisa y no publica', () => {
    const estado = crearEstado({
      fase: FASE_DEL_FORO,
      participantes: { carla: { participantId: 'carla', rol: 'co_moderador' } },
    });
    const instrucciones = calcularInstruccionesDelForo(estado, 'carla', { ahora: INICIO + MINUTO });
    expect(instrucciones.ahora).toMatch(/co-moderador/);
    expect(instrucciones.puedes.join(' ')).toMatch(/cuenta/);
  });

  it('suma la invitación a contestar cuando le respondieron', () => {
    const estado = crearEstado({
      fase: FASE_DEL_FORO,
      participantes: {
        ana: { participantId: 'ana', rol: 'participante', ingresoConfirmado: true },
        luis: { participantId: 'luis', rol: 'participante', ingresoConfirmado: true },
      },
      argumentos: {
        'post-ana': { argumentId: 'post-ana', participantId: 'ana', timestamp: INICIO },
        'replica-luis': {
          argumentId: 'replica-luis',
          participantId: 'luis',
          timestamp: INICIO + 1000,
          argumentoObjetivoId: 'post-ana',
        },
      },
    });
    const instrucciones = calcularInstruccionesDelForo(estado, 'ana', { ahora: INICIO + 2 * MINUTO });
    expect(instrucciones.puedes.join(' ')).toMatch(/Contestar las 1 respuesta/);
  });

  it('en la fase de cierre explica que se está revisando', () => {
    const estado = crearEstado({ fase: { tipo: 'cierre_y_ranking', iniciadaEn: INICIO } });
    expect(calcularInstruccionesDelForo(estado, 'ana').ahora).toMatch(/revisando/);
  });

  it('con la sesión cerrada remite al resultado', () => {
    expect(calcularInstruccionesDelForo(crearEstado({ cerrada: true }), 'ana').ahora).toMatch(/terminó/);
  });
});
