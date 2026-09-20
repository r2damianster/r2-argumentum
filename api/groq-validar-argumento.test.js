import { describe, it, expect } from 'vitest';
import { construirPromptSistema } from './groq-validar-argumento.js';

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

