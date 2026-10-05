import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultarGroqConReintentos } from './_consultarGroq.js';

function respuestaDeGroq({ ok, status, cuerpo = {}, reintentarEn = null }) {
  return { ok, status, json: async () => cuerpo, headers: { get: (nombre) => (nombre === 'retry-after' ? reintentarEn : null) } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('consultarGroqConReintentos: límite por minuto', () => {
  it('si Groq sigue en 429 tras los reintentos, devuelve el estado y la espera que pidió', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaDeGroq({ ok: false, status: 429, reintentarEn: '11' })));
    const promesa = consultarGroqConReintentos('{}');
    await vi.runAllTimersAsync();
    const resultado = await promesa;
    expect(resultado.error).toBe('Groq devolvió un error');
    expect(resultado.estado).toBe(429);
    expect(resultado.reintentarEnSegundos).toBe(11);
  });

  it('un 429 sin retry-after no inventa una espera', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaDeGroq({ ok: false, status: 429 })));
    const promesa = consultarGroqConReintentos('{}');
    await vi.runAllTimersAsync();
    const resultado = await promesa;
    expect(resultado.estado).toBe(429);
    expect(resultado.reintentarEnSegundos).toBeUndefined();
  });

  it('un error de la petición (400) no se reintenta ni pide esperar', async () => {
    const llamada = vi.fn().mockResolvedValue(respuestaDeGroq({ ok: false, status: 400 }));
    vi.stubGlobal('fetch', llamada);
    const resultado = await consultarGroqConReintentos('{}');
    expect(llamada).toHaveBeenCalledTimes(1);
    expect(resultado.estado).toBe(400);
    expect(resultado.reintentarEnSegundos).toBeUndefined();
  });

  it('una respuesta correcta devuelve el JSON del modelo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaDeGroq({ ok: true, status: 200, cuerpo: { choices: [{ message: { content: '{"a":1}' } }] } })));
    expect(await consultarGroqConReintentos('{}')).toEqual({ resultado: { a: 1 } });
  });
});
