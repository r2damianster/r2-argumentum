import { describe, expect, it } from 'vitest';
import { CONCURRENCIA_DE_CONSULTAS, ESPERA_ENTRE_INTENTOS_MS, MAXIMO_DE_INTENTOS_AUTOMATICOS, elegirConsultasPendientes } from './colaDeConsultas.js';

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
