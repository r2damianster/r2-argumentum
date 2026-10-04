import { describe, expect, it } from 'vitest';
import {
  BANDAS_DE_SIMILITUD,
  ORIGENES_DE_SIMILITUD,
  UMBRALES_DE_SIMILITUD_POR_DEFECTO,
  analizarSimilitudDeLasEntregas,
  clasificarSimilitud,
  dividirEnPalabras,
  resolverUmbralesDeSimilitud,
} from './similitudDeTextos.js';

const TEXTO_ORIGINAL =
  'La investigación formativa permite que el estudiante aprenda a formular preguntas y a buscar evidencia para responderlas con método.';

describe('clasificarSimilitud', () => {
  it('usa las cuatro bandas con los umbrales de siempre', () => {
    expect(clasificarSimilitud(0)).toBe(BANDAS_DE_SIMILITUD.SIN_INDICIO);
    expect(clasificarSimilitud(19)).toBe(BANDAS_DE_SIMILITUD.SIN_INDICIO);
    expect(clasificarSimilitud(20)).toBe(BANDAS_DE_SIMILITUD.ATENCION);
    expect(clasificarSimilitud(40)).toBe(BANDAS_DE_SIMILITUD.ALTO);
    expect(clasificarSimilitud(60)).toBe(BANDAS_DE_SIMILITUD.PROBABLE_COPIA);
    expect(clasificarSimilitud(100)).toBe(BANDAS_DE_SIMILITUD.PROBABLE_COPIA);
  });

  it('respeta umbrales propios y descarta los inválidos', () => {
    expect(resolverUmbralesDeSimilitud({ umbralesDeSimilitud: { atencion: 10, alto: 30, probableCopia: 50 } })).toEqual({
      atencion: 10,
      alto: 30,
      probableCopia: 50,
    });
    expect(resolverUmbralesDeSimilitud({ umbralesDeSimilitud: { atencion: 50, alto: 30, probableCopia: 20 } })).toEqual(
      UMBRALES_DE_SIMILITUD_POR_DEFECTO
    );
    expect(resolverUmbralesDeSimilitud({})).toEqual(UMBRALES_DE_SIMILITUD_POR_DEFECTO);
  });
});

describe('dividirEnPalabras', () => {
  it('pasa a minúsculas, conserva tildes y ñ y puede dejar fuera las citas', () => {
    expect(dividirEnPalabras('El Año, pasó!')).toEqual(['el', 'año', 'pasó']);
    expect(dividirEnPalabras('Dijo «esto es una cita larga» y siguió', { excluirCitas: true })).toEqual(['dijo', 'y', 'siguió']);
    expect(dividirEnPalabras('Dijo "otra cita" y “otra más” fin', { excluirCitas: true })).toEqual(['dijo', 'y', 'fin']);
  });
});

describe('analizarSimilitudDeLasEntregas', () => {
  it('una copia literal de otra entrega da casi 100 % y la señala con sus fragmentos', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: TEXTO_ORIGINAL },
        { id: 'beto', texto: TEXTO_ORIGINAL },
        { id: 'carla', texto: 'Aprender a investigar me ayuda a decidir mejor en mi trabajo porque pido datos antes de opinar sobre un problema real.' },
      ],
    });
    expect(resultado.beto.porcentaje).toBe(100);
    expect(resultado.beto.banda).toBe(BANDAS_DE_SIMILITUD.PROBABLE_COPIA);
    expect(resultado.beto).toMatchObject({ origen: ORIGENES_DE_SIMILITUD.OTRA_ENTREGA, conId: 'ana' });
    expect(resultado.beto.fragmentos[0]).toContain('la investigación formativa permite que');
    expect(resultado.carla).toMatchObject({ porcentaje: 0, banda: BANDAS_DE_SIMILITUD.SIN_INDICIO, fragmentos: [] });
  });

  it('con palabras sueltas en común pero sin secuencias de cinco, no hay parecido', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: 'La investigación sirve para decidir con datos y evitar errores costosos en el trabajo diario.' },
        { id: 'beto', texto: 'Sirve la investigación, para mí, decidir con calma; los datos evitan errores, pero el trabajo cuesta.' },
      ],
    });
    expect(resultado.ana.porcentaje).toBe(0);
  });

  it('una copia parcial cae en una banda intermedia', () => {
    const copiaParcial = `${TEXTO_ORIGINAL} Además, yo creo que esto me servirá mucho en mi carrera profesional futura porque ahora entiendo.`;
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: TEXTO_ORIGINAL },
        { id: 'beto', texto: copiaParcial },
      ],
    });
    // Casi todo lo de Ana está en Beto; lo de Beto que viene de Ana es solo una parte.
    expect(resultado.ana.porcentaje).toBe(100);
    expect(resultado.beto.porcentaje).toBeGreaterThan(30);
    expect(resultado.beto.porcentaje).toBeLessThan(100);
  });

  it('lo citado entre comillas no cuenta como copia', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: TEXTO_ORIGINAL },
        { id: 'beto', texto: `Según el texto, «${TEXTO_ORIGINAL}» y por eso pienso que hay que practicar con proyectos pequeños desde el primer semestre.` },
      ],
    });
    expect(resultado.beto.porcentaje).toBeLessThan(20);
  });

  it('compara con el texto de referencia y con los ejemplos, y dice cuál', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [{ id: 'ana', texto: TEXTO_ORIGINAL }],
      referencias: [{ id: 'lectura', origen: ORIGENES_DE_SIMILITUD.TEXTO_DE_REFERENCIA, texto: `${TEXTO_ORIGINAL} Y sigue el resto del texto de la lectura.` }],
    });
    expect(resultado.ana).toMatchObject({ porcentaje: 100, origen: ORIGENES_DE_SIMILITUD.TEXTO_DE_REFERENCIA, conId: 'lectura' });
  });

  it('un texto muy corto no tiene huellas y no se marca', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: 'Muy corto' },
        { id: 'beto', texto: 'Muy corto' },
      ],
    });
    expect(resultado.ana.porcentaje).toBe(0);
  });

  it('lista las coincidencias que pasan de sin indicio', () => {
    const resultado = analizarSimilitudDeLasEntregas({
      entregas: [
        { id: 'ana', texto: TEXTO_ORIGINAL },
        { id: 'beto', texto: TEXTO_ORIGINAL },
        { id: 'carla', texto: TEXTO_ORIGINAL },
      ],
    });
    expect(resultado.ana.coincidencias.map((coincidencia) => coincidencia.conId).sort()).toEqual(['beto', 'carla']);
  });
});
