import { describe, it, expect, vi } from 'vitest';
import handler, { construirPromptSistema } from './groq-validar-argumento.js';

describe('construirPromptSistema', () => {
  it('incluye las instrucciones de validación de dilemas', () => {
    const prompt = construirPromptSistema({
      instruccionesDelIdioma: { nombre: 'español', conectores: '"porque"', consecutivos: '"por lo tanto"' },
      posturasFormateadas: '- id: "p1" → Postura 1',
      ejemplosFormateados: '',
    });

    expect(prompt).toContain('Un DILEMA también es una forma válida');
    expect(prompt).toContain('efectos, consecuencias o alternativas en tensión');
  });
});


describe('razonamiento según el modo de ahorro', () => {
  const argumento = 'La IA debe permitirse en clase porque da retroalimentación inmediata a cada estudiante.';

  async function cuerpoEnviadoAGroq(razonamiento) {
    process.env.GROQ_API_KEY = 'clave-de-prueba';
    const llamada = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"aprobado": true}' } }] }),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', llamada);
    const respuesta = { status: () => respuesta, json: () => respuesta };
    await handler({ method: 'POST', body: { texto: argumento, razonamiento } }, respuesta);
    vi.unstubAllGlobals();
    delete process.env.GROQ_API_KEY;
    return JSON.parse(llamada.mock.calls[0][1].body);
  }

  it('en sala grande (razonamiento bajo) pide poco esfuerzo de razonamiento', async () => {
    expect((await cuerpoEnviadoAGroq('bajo')).reasoning_effort).toBe('low');
  });

  it('en sala pequeña usa el razonamiento por defecto del modelo', async () => {
    expect((await cuerpoEnviadoAGroq('normal')).reasoning_effort).toBeUndefined();
    expect((await cuerpoEnviadoAGroq(undefined)).reasoning_effort).toBeUndefined();
  });
});
