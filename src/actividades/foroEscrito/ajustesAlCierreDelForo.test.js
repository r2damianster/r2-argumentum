import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { resolverParametrosDePuntaje } from '../../shared/puntaje/perfilesDePuntaje.js';
import { armarRevisionesDeAportes, calcularAjustesAlCierreDelForo } from './ajustesAlCierreDelForo.js';

const PROGRAMA = { perfilDePuntaje: 'estandar', fases: [], posturas: [] };
const PARAMETROS = resolverParametrosDePuntaje(PROGRAMA);

function evento(name, data = {}, clientId = undefined) {
  return { name, ...(clientId ? { clientId } : {}), data: { timestamp: Date.now(), ...data } };
}

function construirEstado(eventos) {
  return [
    evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego' }),
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
    ...eventos,
  ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), estadoInicial());
}

// Post n.º 1 de Ana (vale 100 en Estándar).
const POST_DE_ANA = evento(EVENTOS.ARGUMENTO_PUBLICADO, {
  argumentId: 'p1',
  participantId: 'ana',
  posicionEnRonda: 1,
  ronda: 1,
  timestamp: 1,
});

const revisar = (revisorId, nivel, argumentId = 'p1') =>
  evento(EVENTOS.REVISION_REGISTRADA, { argumentId, revisorId, nivel });

const delta = (ajustes, participantId, categoria) =>
  ajustes.filter((ajuste) => ajuste.participantId === participantId && ajuste.categoria === categoria).reduce((suma, ajuste) => suma + ajuste.delta, 0);

describe('ajustes del foro al cerrar: el autor del aporte', () => {
  it('sin ninguna revisión el aporte cuenta completo: no hay ajuste', () => {
    const ajustes = calcularAjustesAlCierreDelForo({ estado: construirEstado([POST_DE_ANA]), parametros: PARAMETROS });
    expect(delta(ajustes, 'ana', 'argumento')).toBe(0);
  });

  it('si la mayoría de los co-moderadores dice «parcial», pierde la mitad', () => {
    const estado = construirEstado([POST_DE_ANA, revisar('carla', 0.5), revisar('diego', 0.5)]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(-50);
  });

  it('si la mayoría dice «no cuenta», pierde todo lo que le dio al publicar', () => {
    const estado = construirEstado([POST_DE_ANA, revisar('carla', 0), revisar('diego', 0)]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(-100);
  });

  it('manda el moderador aunque los co-moderadores opinen otra cosa', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      revisar('carla', 0),
      revisar('diego', 0),
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'evaluada', nivel: 1 }),
    ]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(0);
  });

  it('sin co-moderadores, la decisión opcional del moderador alcanza', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'evaluada', nivel: 0 }),
    ]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(-100);
  });

  it('si el moderador descarta las revisiones de los co-moderadores, el aporte conserva su puntaje', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      revisar('carla', 0),
      revisar('diego', 0),
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'descartada' }),
    ]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(0);
  });

  it('un aporte oculto no cuenta: pierde lo que había ganado, aunque lo hayan revisado bien', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      revisar('carla', 1),
      evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'host' }),
    ]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'ana', 'argumento')).toBe(-100);
  });

  it('un aporte que ya valía 0 por pasar el tope no genera ajuste', () => {
    const cuatroPosts = [1, 2, 3, 4].map((numero) =>
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: `p${numero}`,
        participantId: 'ana',
        posicionEnRonda: numero,
        ronda: 1,
        timestamp: numero,
      })
    );
    const estado = construirEstado([...cuatroPosts, revisar('carla', 0, 'p4'), revisar('diego', 0, 'p4')]);
    expect(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS })).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ participantId: 'ana', categoria: 'argumento' })])
    );
  });
});

describe('ajustes del foro al cerrar: los co-moderadores', () => {
  it('quien coincide con el moderador puntúa y quien opina lo contrario no', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      revisar('carla', 1),
      revisar('diego', 0),
      evento(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId: 'p1', decision: 'evaluada', nivel: 1 }),
    ]);
    const ajustes = calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS });
    // Estándar: máximo 210; una revisión = esfuerzo 1/7 → 30 si acertó del todo.
    expect(delta(ajustes, 'carla', 'co_moderacion')).toBe(30);
    expect(delta(ajustes, 'diego', 'co_moderacion')).toBe(0);
  });

  it('sin moderador que evalúe, igual puntúan por el consenso entre ellos', () => {
    const estado = construirEstado([POST_DE_ANA, revisar('carla', 1), revisar('diego', 1)]);
    const ajustes = calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS });
    expect(delta(ajustes, 'carla', 'co_moderacion')).toBe(30);
    expect(delta(ajustes, 'diego', 'co_moderacion')).toBe(30);
  });

  it('los aportes ocultos no entran en la revisión', () => {
    const estado = construirEstado([
      POST_DE_ANA,
      revisar('carla', 1),
      revisar('diego', 1),
      evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'host' }),
    ]);
    expect(armarRevisionesDeAportes(estado)).toEqual([]);
    expect(delta(calcularAjustesAlCierreDelForo({ estado, parametros: PARAMETROS }), 'carla', 'co_moderacion')).toBe(0);
  });

  it('un foro sin ninguna revisión no genera ajustes', () => {
    expect(calcularAjustesAlCierreDelForo({ estado: construirEstado([POST_DE_ANA]), parametros: PARAMETROS })).toEqual([]);
  });
});
