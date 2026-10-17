import { describe, it, expect, vi } from 'vitest';
import handler, {
  CONFIANZA_MINIMA_DEL_PATRON,
  ESQUEMA_DE_VALIDACION,
  construirPromptSistema,
  esquemaDeValidacion,
  interpretarPatronDetectado,
  normalizarPatronRecibido,
} from './groq-validar-argumento.js';

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

describe('patrón de escritura', () => {
  const patronCrudo = {
    nombre: 'CER',
    partes: [
      { nombre: 'Afirmación', descripcion: 'Lo que sostienes.' },
      { nombre: 'Evidencia', descripcion: 'Datos.' },
      { nombre: 'Razonamiento', descripcion: 'La lógica.' },
    ],
  };
  const patron = normalizarPatronRecibido(patronCrudo);
  const idioma = { nombre: 'español', conectores: '"porque"', consecutivos: '"por lo tanto"' };

  it('sin patrón el esquema y el prompt son los de siempre', () => {
    expect(esquemaDeValidacion(null)).toBe(ESQUEMA_DE_VALIDACION);
    const prompt = construirPromptSistema({ instruccionesDelIdioma: idioma, posturasFormateadas: '', ejemplosFormateados: '' });
    expect(prompt).not.toContain('TAREA 3');
  });

  it('con patrón el esquema pide las partes presentes y la confianza, y el prompt las nombra', () => {
    expect(esquemaDeValidacion(patron).required).toEqual(expect.arrayContaining(['partesPresentes', 'confianzaDelPatron']));
    const prompt = construirPromptSistema({ instruccionesDelIdioma: idioma, posturasFormateadas: '', ejemplosFormateados: '', patron });
    expect(prompt).toContain('TAREA 3');
    expect(prompt).toContain('"Razonamiento"');
    expect(prompt).toContain('NO cambia "aprobado"');
  });

  it('un patrón sin partes usables se ignora', () => {
    expect(normalizarPatronRecibido(undefined)).toBeNull();
    expect(normalizarPatronRecibido({ nombre: 'X', partes: [{ nombre: '' }] })).toBeNull();
  });

  it('solo cuenta partes que existen en el patrón y calcula las que faltan', () => {
    const detectado = interpretarPatronDetectado(patron, { partesPresentes: ['Afirmación', 'Inventada'], confianzaDelPatron: 0.9 });
    expect(detectado.partesPresentes).toEqual(['Afirmación']);
    expect(detectado.partesFaltantes).toEqual(['Evidencia', 'Razonamiento']);
  });

  it('ante la duda (confianza baja) no señala nada', () => {
    expect(interpretarPatronDetectado(patron, { partesPresentes: ['Afirmación'], confianzaDelPatron: CONFIANZA_MINIMA_DEL_PATRON - 0.1 })).toBeNull();
    expect(interpretarPatronDetectado(patron, { partesPresentes: ['Afirmación'] })).toBeNull();
  });

  it('la respuesta lleva el patrón detectado y no cambia la aprobación', async () => {
    process.env.GROQ_API_KEY = 'clave-de-prueba';
    const contenido = JSON.stringify({
      aprobado: true,
      motivo: 'ok',
      sugerenciaDeCorreccion: '',
      posturaDetectada: null,
      esPosturaNueva: false,
      posturaSugerida: '',
      confianza: 0.9,
      partesPresentes: ['Afirmación', 'Evidencia'],
      confianzaDelPatron: 0.8,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: contenido } }] }),
      headers: { get: () => null },
    }));
    let cuerpo;
    const respuesta = { status: () => respuesta, json: (valor) => { cuerpo = valor; return respuesta; } };
    await handler(
      { method: 'POST', body: { texto: 'La IA debe permitirse en clase porque da retroalimentación inmediata a cada estudiante.', patron: patronCrudo } },
      respuesta
    );
    vi.unstubAllGlobals();
    delete process.env.GROQ_API_KEY;
    expect(cuerpo.aprobado).toBe(true);
    expect(cuerpo.patron.partesPresentes).toEqual(['Afirmación', 'Evidencia']);
    expect(cuerpo.patron.partesFaltantes).toEqual(['Razonamiento']);
  });
});
