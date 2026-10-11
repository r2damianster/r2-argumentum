import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultarGroqConEsquema, consultarGroqConReintentos } from './_consultarGroq.js';

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

describe('consultarGroqConEsquema', () => {
  const esquema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'], additionalProperties: false };
  const respuestaCorrecta = respuestaDeGroq({ ok: true, status: 200, cuerpo: { choices: [{ message: { content: '{"a":1}' } }] } });

  it('pide structured outputs en modo estricto', async () => {
    const llamada = vi.fn().mockResolvedValue(respuestaCorrecta);
    vi.stubGlobal('fetch', llamada);
    const resultado = await consultarGroqConEsquema({ model: 'm' }, { nombre: 'prueba', esquema });
    expect(resultado).toEqual({ resultado: { a: 1 } });
    const cuerpo = JSON.parse(llamada.mock.calls[0][1].body);
    expect(cuerpo.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'prueba', strict: true, schema: esquema } });
  });

  it('si Groq rechaza el esquema (400) repite la consulta con json_object', async () => {
    const llamada = vi
      .fn()
      .mockResolvedValueOnce(respuestaDeGroq({ ok: false, status: 400 }))
      .mockResolvedValueOnce(respuestaCorrecta);
    vi.stubGlobal('fetch', llamada);
    const resultado = await consultarGroqConEsquema({ model: 'm' }, { nombre: 'prueba', esquema });
    expect(resultado).toEqual({ resultado: { a: 1 } });
    expect(JSON.parse(llamada.mock.calls[1][1].body).response_format).toEqual({ type: 'json_object' });
  });
});
