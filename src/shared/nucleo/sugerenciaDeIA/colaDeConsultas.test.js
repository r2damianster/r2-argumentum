import { describe, expect, it } from 'vitest';
import {
  CONCURRENCIA_DE_CONSULTAS,
  ESPERA_ENTRE_INTENTOS_MS,
  MAXIMO_DE_INTENTOS_AUTOMATICOS,
  PAUSA_MAXIMA_POR_LIMITE_MS,
  PAUSA_MINIMA_POR_LIMITE_MS,
  calcularPausaPorLimite,
  elegirConsultasPendientes,
} from './colaDeConsultas.js';

const entrega = (participantId, extra = {}) => ({ participantId, texto: `Texto de ${participantId}`, sugerenciaConsultada: false, ...extra });

describe('elegirConsultasPendientes', () => {
  it('toma como mucho la concurrencia permitida', () => {
    const cola = ['a', 'b', 'c', 'd'].map((id) => entrega(id));
    expect(elegirConsultasPendientes({ cola, enCurso: new Set() })).toHaveLength(CONCURRENCIA_DE_CONSULTAS);
  });

  it('descuenta las consultas que ya van en vuelo', () => {
    const cola = ['a', 'b', 'c'].map((id) => entrega(id));
    const elegidas = elegirConsultasPendientes({ cola, enCurso: new Set(['a']) });
    expect(elegidas.map((item) => item.participantId)).toEqual(['b']);
  });

  it('no consulta lo que ya tiene sugerencia, ni lo que todavía no tiene texto', () => {
    const cola = [entrega('a', { sugerenciaConsultada: true }), entrega('b', { texto: null }), entrega('c')];
    expect(elegirConsultasPendientes({ cola, enCurso: new Set() }).map((item) => item.participantId)).toEqual(['c']);
  });

  it('un fallo espera antes de reintentar y no pasa del máximo de intentos', () => {
    const cola = [entrega('a')];
    const ahora = 1_000_000;
    const base = { cola, enCurso: new Set(), intentos: { a: 1 }, ultimoIntento: { a: ahora - 1000 }, ahora };

    expect(elegirConsultasPendientes(base)).toEqual([]);
    expect(elegirConsultasPendientes({ ...base, ultimoIntento: { a: ahora - ESPERA_ENTRE_INTENTOS_MS } })).toHaveLength(1);
    expect(
      elegirConsultasPendientes({ ...base, intentos: { a: MAXIMO_DE_INTENTOS_AUTOMATICOS }, ultimoIntento: { a: 0 } })
    ).toEqual([]);
  });
});

describe('pausa por el límite por minuto de Groq', () => {
  it('con la cola pausada no se consulta nada, y al terminar la pausa sigue sola', () => {
    const cola = ['a', 'b'].map((id) => entrega(id));
    const ahora = 1_000_000;
    expect(elegirConsultasPendientes({ cola, enCurso: new Set(), ahora, pausadoHasta: ahora + 10_000 })).toEqual([]);
    expect(elegirConsultasPendientes({ cola, enCurso: new Set(), ahora, pausadoHasta: ahora - 1 })).toHaveLength(2);
  });

  it('la pausa respeta lo que pide Groq, con un mínimo y un máximo', () => {
    expect(calcularPausaPorLimite(20_000)).toBe(20_000);
    expect(calcularPausaPorLimite(100)).toBe(PAUSA_MINIMA_POR_LIMITE_MS);
    expect(calcularPausaPorLimite(10 * 60 * 1000)).toBe(PAUSA_MAXIMA_POR_LIMITE_MS);
    expect(calcularPausaPorLimite(undefined)).toBe(PAUSA_MINIMA_POR_LIMITE_MS);
  });
});
