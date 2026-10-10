import { describe, expect, it } from 'vitest';
import { TIPOS_DE_FALACIA, construirPromptDeEvaluacion, normalizarSugerencia } from './groq-sugerir-evaluacion.js';

const TEXTO = 'Todos los jóvenes usan la IA para copiar, así que la universidad debería prohibirla porque es trampa.';

describe('construirPromptDeEvaluacion', () => {
  const prompt = construirPromptDeEvaluacion({
    nombreDelIdioma: 'español',
    ejemplosFormateados: '',
    textoDelObjetivo: '',
  });

  it('deja claro que la IA solo sugiere y no decide ni puntúa', () => {
    expect(prompt).toContain('SUGIERE');
    expect(prompt).toContain('tú no puntúas ni decides nada');
  });

  it('pide no señalar falacias dudosas y lista los tipos permitidos', () => {
    expect(prompt).toContain('Si dudas, NO la señales');
    for (const tipo of TIPOS_DE_FALACIA) {
      expect(prompt).toContain(tipo);
    }
  });

  it('no juzga la postura ni si se está de acuerdo con el contenido', () => {
    expect(prompt).toContain('nunca si estás de acuerdo con el contenido ni la postura');
  });

  it('incluye el texto al que responde una réplica solo como contexto', () => {
    const conObjetivo = construirPromptDeEvaluacion({
      nombreDelIdioma: 'español',
      ejemplosFormateados: '',
      textoDelObjetivo: 'La IA ayuda a aprender.',
    });
    expect(conObjetivo).toContain('La IA ayuda a aprender.');
    expect(conObjetivo).toContain('solo como contexto');
    expect(prompt).not.toContain('solo como contexto');
  });
});

describe('normalizarSugerencia', () => {
  it('conserva una sugerencia bien formada', () => {
    const resultado = normalizarSugerencia(
      {
        completitud: 'incompleto',
        falacias: [
          {
            tipo: 'generalizacion_apresurada',
            fragmento: 'Todos los jóvenes usan la IA para copiar',
            explicacion: 'Generaliza a todos',
            confianza: 0.8,
          },
        ],
        comentario: 'Falta un dato.',
        confianza: 0.7,
      },
      TEXTO
    );
    expect(resultado.completitud).toBe('incompleto');
    expect(resultado.falacias).toHaveLength(1);
    expect(resultado.comentario).toBe('Falta un dato.');
  });

  it('descarta una completitud inventada', () => {
    expect(normalizarSugerencia({ completitud: 'excelente' }, TEXTO).completitud).toBeNull();
  });

  it('descarta falacias con tipo inventado', () => {
    const resultado = normalizarSugerencia(
      { completitud: 'completo', falacias: [{ tipo: 'magia', fragmento: 'jóvenes', confianza: 0.9 }] },
      TEXTO
    );
    expect(resultado.falacias).toEqual([]);
  });

  it('descarta falacias con poca confianza: ante la duda no se acusa', () => {
    const resultado = normalizarSugerencia(
      { completitud: 'completo', falacias: [{ tipo: 'ad_hominem', fragmento: 'jóvenes', confianza: 0.4 }] },
      TEXTO
    );
    expect(resultado.falacias).toEqual([]);
  });

  it('descarta falacias cuyo fragmento no está en el texto (el modelo a veces «cita» lo que no se dijo)', () => {
    const resultado = normalizarSugerencia(
      { completitud: 'completo', falacias: [{ tipo: 'ad_hominem', fragmento: 'eres tonto', confianza: 0.95 }] },
      TEXTO
    );
    expect(resultado.falacias).toEqual([]);
  });

  it('limita a 3 falacias', () => {
    const falacias = Array.from({ length: 6 }, () => ({
      tipo: 'falsa_causa',
      fragmento: 'es trampa',
      explicacion: 'x',
      confianza: 0.9,
    }));
    expect(normalizarSugerencia({ completitud: 'completo', falacias }, TEXTO).falacias).toHaveLength(3);
  });

  it('una respuesta vacía o rota devuelve una sugerencia sin nada que mostrar, sin lanzar errores', () => {
    expect(normalizarSugerencia(null, TEXTO)).toEqual({ completitud: null, falacias: [], criterios: [], comentario: '', confianza: null });
    expect(normalizarSugerencia({ falacias: 'no es lista' }, TEXTO).falacias).toEqual([]);
  });
});

describe('criterios adicionales', () => {
  const PEDIDOS = [{ id: 'describe_escena', etiqueta: 'Describe una escena', descripcion: '' }];

  it('incluye en el prompt los criterios pedidos y no la tarea si no hay', () => {
    const base = { nombreDelIdioma: 'español', ejemplosFormateados: '', textoDelObjetivo: '' };
    expect(construirPromptDeEvaluacion({ ...base, criterios: PEDIDOS })).toContain('describe_escena');
    expect(construirPromptDeEvaluacion(base)).not.toContain('TAREA 3');
  });

  it('devuelve solo criterios pedidos, con etiqueta y confianza suficiente', () => {
    const resultado = normalizarSugerencia(
      {
        completitud: 'completo',
        criterios: [
          { id: 'describe_escena', cumple: false, confianza: 0.9 },
          { id: 'inventado', cumple: true, confianza: 0.9 },
        ],
      },
      TEXTO,
      PEDIDOS
    );
    expect(resultado.criterios).toEqual([
      { id: 'describe_escena', etiqueta: 'Describe una escena', cumple: false, confianza: 0.9 },
    ]);
  });

  it('ante la duda (confianza baja) o valor no booleano no señala el criterio', () => {
    const resultado = normalizarSugerencia(
      {
        criterios: [
          { id: 'describe_escena', cumple: false, confianza: 0.3 },
          { id: 'describe_escena', cumple: 'si', confianza: 0.9 },
        ],
      },
      TEXTO,
      PEDIDOS
    );
    expect(resultado.criterios).toEqual([]);
  });
});
