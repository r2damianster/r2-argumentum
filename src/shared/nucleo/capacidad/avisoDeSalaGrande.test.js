import { describe, expect, it } from 'vitest';
import {
  PERSONAS_DESDE_LAS_QUE_SE_AVISA,
  PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_DIVIDIR,
  avisoDeSalaGrande,
} from './avisoDeSalaGrande.js';

describe('avisoDeSalaGrande', () => {
  it('con una sala normal no avisa de nada', () => {
    expect(avisoDeSalaGrande(0)).toBeNull();
    expect(avisoDeSalaGrande(40)).toBeNull();
    expect(avisoDeSalaGrande(PERSONAS_DESDE_LAS_QUE_SE_AVISA - 1)).toBeNull();
  });

  it('desde las 60 personas avisa que puede haber retrasos y calificación a mano', () => {
    const aviso = avisoDeSalaGrande(PERSONAS_DESDE_LAS_QUE_SE_AVISA);
    expect(aviso.nivel).toBe('atencion');
    expect(aviso.titulo).toContain('60');
    expect(aviso.texto).toContain('a mano');
  });

  it('desde las 150 recomienda dividir el grupo en varias salas', () => {
    const aviso = avisoDeSalaGrande(PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_DIVIDIR);
    expect(aviso.nivel).toBe('alta');
    expect(aviso.texto).toContain('dividir');
  });

  it('tolera datos raros', () => {
    expect(avisoDeSalaGrande(undefined)).toBeNull();
    expect(avisoDeSalaGrande('200').nivel).toBe('alta');
  });
});
