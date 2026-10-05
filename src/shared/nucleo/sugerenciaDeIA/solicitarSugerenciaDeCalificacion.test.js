import { describe, expect, it, vi } from 'vitest';
import { solicitarSugerenciaDeCalificacion } from './solicitarSugerenciaDeCalificacion.js';

const PROGRAMA = {
  consigna: 'Explica la idea.',
  estructura: 'peel',
  numeroDeParrafos: 2,
  clavesDeLaLectura: 'CLAVES-DEL-HOST',
  idioma: 'es',
};
const RUBRICA = [{ id: 'a', nombre: 'A', descripcion: 'd', peso: 50 }];

describe('solicitarSugerenciaDeCalificacion', () => {
  it('manda la consigna, la estructura, la rúbrica y las claves, y nunca un nombre', async () => {
    const solicitar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sugerencia: { niveles: { a: 'bueno' } } }) });
    const resultado = await solicitarSugerenciaDeCalificacion({ texto: 'Un texto', programa: PROGRAMA, rubrica: RUBRICA, solicitar });

    const [url, opciones] = solicitar.mock.calls[0];
    expect(url).toBe('/api/groq-sugerir-calificacion');
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo).toMatchObject({ consigna: 'Explica la idea.', claves: 'CLAVES-DEL-HOST', idioma: 'es' });
    expect(cuerpo.estructura).toMatchObject({ nombre: 'PEEL', numeroDeParrafos: 2, distribucion: 'compacta' });
    expect(cuerpo.estructura.partes).toHaveLength(4);
    expect(cuerpo.rubrica).toEqual([{ id: 'a', nombre: 'A', descripcion: 'd' }]);
    expect(Object.keys(cuerpo)).not.toContain('participantId');
    expect(resultado.sugerencia.niveles.a).toBe('bueno');
  });

  it('un texto muy corto devuelve sugerencia nula con su motivo', async () => {
    const solicitar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sugerencia: null, motivo: 'texto_muy_corto' }) });
    expect(await solicitarSugerenciaDeCalificacion({ texto: 'x', programa: PROGRAMA, rubrica: RUBRICA, solicitar })).toEqual({
      sugerencia: null,
      motivo: 'texto_muy_corto',
    });
  });

  it('un error del servidor o de red es un fallo, no una excepción', async () => {
    const conError = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await solicitarSugerenciaDeCalificacion({ texto: 'x', programa: PROGRAMA, rubrica: RUBRICA, solicitar: conError })).toEqual({ fallo: true });
    const sinRed = vi.fn().mockRejectedValue(new Error('sin red'));
    expect(await solicitarSugerenciaDeCalificacion({ texto: 'x', programa: PROGRAMA, rubrica: RUBRICA, solicitar: sinRed })).toEqual({ fallo: true });
  });
  it('un límite de tasa de Groq (429) informa cuánto esperar para que la cola se pause', async () => {
    const limite = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ reintentarEnSegundos: 12 }) });
    expect(await solicitarSugerenciaDeCalificacion({ texto: 'x', programa: PROGRAMA, rubrica: RUBRICA, solicitar: limite })).toEqual({
      fallo: true,
      reintentarEnMs: 12000,
    });
    const sinEspera = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    expect(await solicitarSugerenciaDeCalificacion({ texto: 'x', programa: PROGRAMA, rubrica: RUBRICA, solicitar: sinEspera })).toEqual({ fallo: true });
  });
});
