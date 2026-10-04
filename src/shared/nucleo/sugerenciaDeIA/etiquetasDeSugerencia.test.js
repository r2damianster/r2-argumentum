import { describe, expect, it } from 'vitest';
import {
  describirCompletitud,
  describirFalacias,
  sugerenciaMerecePrioridad,
} from './etiquetasDeSugerencia.js';

describe('describirCompletitud', () => {
  it('traduce cada nivel a una etiqueta legible', () => {
    expect(describirCompletitud({ completitud: 'completo' })).toBe('Completo');
    expect(describirCompletitud({ completitud: 'incompleto' })).toBe('Incompleto');
    expect(describirCompletitud({ completitud: 'sin_razon' })).toBe('Sin razón');
  });

  it('sin sugerencia o con un valor desconocido no devuelve nada', () => {
    expect(describirCompletitud(null)).toBeNull();
    expect(describirCompletitud({ completitud: 'excelente' })).toBeNull();
  });
});

describe('describirFalacias', () => {
  it('agrega la etiqueta legible de cada tipo y conserva el resto', () => {
    const [falacia] = describirFalacias({
      falacias: [{ tipo: 'ad_hominem', fragmento: 'eres', explicacion: 'x', confianza: 0.9 }],
    });
    expect(falacia.etiqueta).toBe('Ataque a la persona (ad hominem)');
    expect(falacia.fragmento).toBe('eres');
  });

  it('sin sugerencia da una lista vacía', () => {
    expect(describirFalacias(undefined)).toEqual([]);
  });
});

describe('sugerenciaMerecePrioridad', () => {
  it('un aporte completo y sin falacias no sube en la cola de revisión', () => {
    expect(sugerenciaMerecePrioridad({ completitud: 'completo', falacias: [] })).toBe(false);
  });

  it('incompleto, sin razón o con una posible falacia sube en la cola', () => {
    expect(sugerenciaMerecePrioridad({ completitud: 'incompleto', falacias: [] })).toBe(true);
    expect(sugerenciaMerecePrioridad({ completitud: 'sin_razon', falacias: [] })).toBe(true);
    expect(sugerenciaMerecePrioridad({ completitud: 'completo', falacias: [{ tipo: 'falsa_causa' }] })).toBe(true);
  });

  it('sin sugerencia (la IA falló) no cambia la prioridad', () => {
    expect(sugerenciaMerecePrioridad(null)).toBe(false);
  });
});
