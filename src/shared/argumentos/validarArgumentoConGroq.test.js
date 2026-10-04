import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVISO_SIN_REVISION_DE_IA, validarArgumentoConGroq } from './validarArgumentoConGroq.js';
import { DECISIONES, decidirValidacion, esDecisionQueBloquea } from './decidirValidacion.js';

const POSTURAS = [
  { id: 'a', etiqueta: 'Postura A' },
  { id: 'b', etiqueta: 'Postura B' },
];

function simularFetch(implementacion) {
  vi.stubGlobal('fetch', vi.fn(implementacion));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validarArgumentoConGroq: Groq nunca condiciona participar', () => {
  it('devuelve la respuesta de Groq cuando todo funciona', async () => {
    const respuestaDeGroq = { aprobado: false, motivo: 'Falta razón', sugerenciaDeCorreccion: 'Agrega una razón' };
    simularFetch(async () => ({ ok: true, json: async () => respuestaDeGroq }));
    expect(await validarArgumentoConGroq({ texto: 'x', posturas: POSTURAS })).toEqual(respuestaDeGroq);
  });

  it.each([
    ['límite de cuota (429)', async () => ({ ok: false, status: 429, json: async () => ({}) })],
    ['error del servidor (502)', async () => ({ ok: false, status: 502, json: async () => ({}) })],
    ['sin clave configurada (500)', async () => ({ ok: false, status: 500, json: async () => ({}) })],
    ['sin red', async () => { throw new Error('offline'); }],
    ['respuesta que no es un veredicto', async () => ({ ok: true, json: async () => ({ cualquierCosa: 1 }) })],
    ['JSON ilegible', async () => ({ ok: true, json: async () => { throw new Error('json'); } })],
  ])('si falla por %s, el argumento pasa con aviso', async (_nombre, implementacion) => {
    simularFetch(implementacion);
    const respuesta = await validarArgumentoConGroq({ texto: 'x', posturas: POSTURAS });
    expect(respuesta.aprobado).toBe(true);
    expect(respuesta.sinRevisarPorIA).toBe(true);
    expect(respuesta.motivo).toBe(AVISO_SIN_REVISION_DE_IA);
  });

  it('sin revisión de la IA la decisión es aprobar con la postura elegida y no bloquea', async () => {
    simularFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const respuesta = await validarArgumentoConGroq({ texto: 'x', posturas: POSTURAS });
    const decision = decidirValidacion({ resultadoDeGroq: respuesta, stanceElegido: 'b', posturas: POSTURAS });
    expect(decision.decision).toBe(DECISIONES.APROBADO);
    expect(decision.posturaDetectada).toBe('b');
    expect(decision.mensaje).toBe(AVISO_SIN_REVISION_DE_IA);
    expect(decision.sinRevisarPorIA).toBe(true);
    expect(esDecisionQueBloquea(decision.decision)).toBe(false);
  });

  it('con asignación por argumento y sin Groq, la persona elige la postura (no se adivina)', async () => {
    simularFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const respuesta = await validarArgumentoConGroq({ texto: 'x', posturas: POSTURAS });
    const decision = decidirValidacion({
      resultadoDeGroq: respuesta,
      stanceElegido: null,
      posturas: POSTURAS,
      asignacionPostura: 'por_argumento',
    });
    expect(decision.decision).toBe(DECISIONES.ELEGIR_POSTURA_A_MANO);
    expect(decision.posturaDetectada).toBeNull();
    expect(esDecisionQueBloquea(decision.decision)).toBe(false);
  });
});
