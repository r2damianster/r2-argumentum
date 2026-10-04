import { describe, expect, it } from 'vitest';
import { calcularTiempoRestante, formatearCuentaAtras } from './calcularTiempoRestante.js';

const INICIO = 1_000_000;
const MINUTO = 60 * 1000;

describe('calcularTiempoRestante', () => {
  it('calcula cuándo termina y cuánto falta', () => {
    const resultado = calcularTiempoRestante({ iniciadaEn: INICIO, duracionMin: 20, ahora: INICIO + 5 * MINUTO });
    expect(resultado.terminaEn).toBe(INICIO + 20 * MINUTO);
    expect(resultado.restanteMs).toBe(15 * MINUTO);
    expect(resultado.haVencido).toBe(false);
    expect(resultado.enAvisoFinal).toBe(false);
  });

  it('avisa en los últimos 2 minutos', () => {
    const resultado = calcularTiempoRestante({
      iniciadaEn: INICIO,
      duracionMin: 20,
      ahora: INICIO + 18.5 * MINUTO,
    });
    expect(resultado.enAvisoFinal).toBe(true);
    expect(resultado.haVencido).toBe(false);
  });

  it('al llegar a cero ya venció y no hay aviso', () => {
    const resultado = calcularTiempoRestante({ iniciadaEn: INICIO, duracionMin: 20, ahora: INICIO + 21 * MINUTO });
    expect(resultado.haVencido).toBe(true);
    expect(resultado.restanteMs).toBe(0);
    expect(resultado.enAvisoFinal).toBe(false);
  });

  it('una extensión suma tiempo y reabre la cuenta atrás', () => {
    const resultado = calcularTiempoRestante({
      iniciadaEn: INICIO,
      duracionMin: 20,
      extensionesMin: 5,
      ahora: INICIO + 21 * MINUTO,
    });
    expect(resultado.haVencido).toBe(false);
    expect(resultado.restanteMs).toBe(4 * MINUTO);
  });

  it('corrige el reloj de un equipo adelantado', () => {
    const resultado = calcularTiempoRestante({
      iniciadaEn: INICIO,
      duracionMin: 20,
      ahora: INICIO + 5 * MINUTO,
      desfaseDelRelojMs: 2 * MINUTO,
    });
    expect(resultado.restanteMs).toBe(17 * MINUTO);
  });

  it('sin inicio o sin duración no hay cuenta atrás', () => {
    expect(calcularTiempoRestante({ iniciadaEn: null, duracionMin: 20 }).restanteMs).toBeNull();
    expect(calcularTiempoRestante({ iniciadaEn: INICIO, duracionMin: 0 }).restanteMs).toBeNull();
  });
});

describe('formatearCuentaAtras', () => {
  it('muestra minutos y segundos con dos cifras', () => {
    expect(formatearCuentaAtras(15 * MINUTO)).toBe('15:00');
    expect(formatearCuentaAtras(65 * 1000)).toBe('01:05');
    expect(formatearCuentaAtras(0)).toBe('00:00');
  });

  it('redondea hacia arriba para no mostrar 00:00 con tiempo aún disponible', () => {
    expect(formatearCuentaAtras(400)).toBe('00:01');
  });

  it('sin dato devuelve vacío', () => {
    expect(formatearCuentaAtras(null)).toBe('');
  });
});
