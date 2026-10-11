import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './groq-sugerir-conexiones.js';

function respuestaSimulada() {
  const respuesta = { codigoDeEstado: null, cuerpo: null };
  respuesta.status = (codigo) => {
    respuesta.codigoDeEstado = codigo;
    return respuesta;
  };
  respuesta.json = (cuerpo) => {
    respuesta.cuerpo = cuerpo;
    return respuesta;
  };
  return respuesta;
}

function respuestaDeGroq(contenido) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: contenido } }] }),
    headers: { get: () => null },
  };
}

const argumentos = [
  { argumentId: 'a1', texto: 'Uno' },
  { argumentId: 'a2', texto: 'Dos' },
];

beforeEach(() => {
  process.env.GROQ_API_KEY = 'clave-de-prueba';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.GROQ_API_KEY;
});

describe('groq-sugerir-conexiones', () => {
  it('descarta sugerencias con ids inventados o que conectan un argumento consigo mismo', async () => {
    const contenido = JSON.stringify({
      sugerencias: [
        { sourceArgumentId: 'a1', targetArgumentId: 'a2', tipoDeRelacion: 'refuerzo', confianza: 0.8 },
        { sourceArgumentId: 'a1', targetArgumentId: 'inventado', tipoDeRelacion: 'dilema', confianza: 0.9 },
        { sourceArgumentId: 'a2', targetArgumentId: 'a2', tipoDeRelacion: 'conexion', confianza: 0.7 },
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaDeGroq(contenido)));
    const respuesta = respuestaSimulada();
    await handler({ method: 'POST', body: { argumentos } }, respuesta);
    expect(respuesta.codigoDeEstado).toBe(200);
    expect(respuesta.cuerpo.sugerencias).toHaveLength(1);
    expect(respuesta.cuerpo.sugerencias[0].targetArgumentId).toBe('a2');
  });

  it('reintenta un fallo transitorio de Groq antes de responder error', async () => {
    vi.useFakeTimers();
    const llamada = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}), headers: { get: () => null } })
      .mockResolvedValueOnce(respuestaDeGroq('{"sugerencias": []}'));
    vi.stubGlobal('fetch', llamada);
    const respuesta = respuestaSimulada();
    const promesa = handler({ method: 'POST', body: { argumentos } }, respuesta);
    await vi.runAllTimersAsync();
    await promesa;
    expect(llamada).toHaveBeenCalledTimes(2);
    expect(respuesta.codigoDeEstado).toBe(200);
    expect(respuesta.cuerpo).toEqual({ sugerencias: [] });
  });

  it('con Groq caído responde 502 sin lanzar', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    const respuesta = respuestaSimulada();
    const promesa = handler({ method: 'POST', body: { argumentos } }, respuesta);
    await vi.runAllTimersAsync();
    await promesa;
    expect(respuesta.codigoDeEstado).toBe(502);
  });
});
