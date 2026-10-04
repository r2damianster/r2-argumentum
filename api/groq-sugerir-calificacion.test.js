import { beforeEach, describe, expect, it } from 'vitest';
import handler, {
  construirPromptDeCalificacion,
  contarPalabras,
  normalizarSugerenciaDeCalificacion,
} from './groq-sugerir-calificacion.js';
import { firmarSesionDelHost } from './_sesionDelHost.js';

const RUBRICA = [
  { id: 'pertinencia', nombre: 'Pertinencia', descripcion: 'Responde a la consigna' },
  { id: 'estructura', nombre: 'Estructura', descripcion: 'Sigue la estructura' },
];
const ESTRUCTURA = {
  nombre: 'PEEL',
  numeroDeParrafos: 2,
  distribucion: 'compacta',
  partes: [
    { nombre: 'Punto', descripcion: 'La idea principal' },
    { nombre: 'Evidencia', descripcion: 'Un dato' },
  ],
};

function respuestaFalsa() {
  const respuesta = { codigo: null, cuerpo: null };
  respuesta.status = (codigo) => {
    respuesta.codigo = codigo;
    return respuesta;
  };
  respuesta.json = (cuerpo) => {
    respuesta.cuerpo = cuerpo;
    return respuesta;
  };
  return respuesta;
}

describe('construirPromptDeCalificacion', () => {
  const prompt = construirPromptDeCalificacion({
    nombreDelIdioma: 'español',
    consigna: 'Explica la idea central.',
    estructura: ESTRUCTURA,
    rubrica: RUBRICA,
    claves: '',
  });

  it('deja claro que solo sugiere, que el texto es anónimo y que no se juzga la postura', () => {
    expect(prompt).toContain('SUGIERE');
    expect(prompt).toContain('El docente decide');
    expect(prompt).toContain('anónimo');
    expect(prompt).toContain('no la postura');
  });

  it('incluye la consigna, la estructura y los ids de la rúbrica', () => {
    expect(prompt).toContain('Explica la idea central.');
    expect(prompt).toContain('PEEL');
    expect(prompt).toContain('id "pertinencia"');
    expect(prompt).toContain('toda la estructura dentro de cada párrafo');
  });

  it('las claves de la lectura solo aparecen si existen', () => {
    expect(prompt).not.toContain('Ideas clave');
    const conClaves = construirPromptDeCalificacion({
      nombreDelIdioma: 'español',
      consigna: 'x',
      estructura: ESTRUCTURA,
      rubrica: RUBRICA,
      claves: '- idea uno',
    });
    expect(conClaves).toContain('Ideas clave');
    expect(conClaves).toContain('- idea uno');
  });

  it('la escritura libre no pide estructura', () => {
    const libre = construirPromptDeCalificacion({
      nombreDelIdioma: 'español',
      consigna: 'x',
      estructura: { nombre: 'Libre', numeroDeParrafos: 1, partes: [] },
      rubrica: RUBRICA,
      claves: '',
    });
    expect(libre).toContain('Escritura libre');
  });
});

describe('normalizarSugerenciaDeCalificacion', () => {
  it('conserva una sugerencia bien formada y la marca como completa', () => {
    const resultado = normalizarSugerenciaDeCalificacion(
      {
        niveles: { pertinencia: 'bueno', estructura: 'aceptable' },
        comentariosPorCriterio: { pertinencia: 'Tu texto responde a la consigna.' },
        partesDetectadas: [{ nombre: 'Punto', presente: true }, { nombre: 'Evidencia', presente: false }],
        comentarioGeneral: 'Buen intento.',
        confianza: 0.8,
      },
      { rubrica: RUBRICA, estructura: ESTRUCTURA }
    );
    expect(resultado.completa).toBe(true);
    expect(resultado.niveles).toEqual({ pertinencia: 'bueno', estructura: 'aceptable' });
    expect(resultado.partesDetectadas).toHaveLength(2);
    expect(resultado.confianza).toBe(0.8);
  });

  it('descarta criterios y niveles inventados, y partes que no se pidieron', () => {
    const resultado = normalizarSugerenciaDeCalificacion(
      {
        niveles: { pertinencia: 'genial', estructura: 'bueno', inventado: 'excelente' },
        comentariosPorCriterio: { inventado: 'x', estructura: '  Falta una parte.  ' },
        partesDetectadas: [{ nombre: 'Enlace', presente: true }, { nombre: 'Punto', presente: 'sí' }],
      },
      { rubrica: RUBRICA, estructura: ESTRUCTURA }
    );
    expect(resultado.niveles).toEqual({ estructura: 'bueno' });
    expect(resultado.comentariosPorCriterio).toEqual({ estructura: 'Falta una parte.' });
    expect(resultado.partesDetectadas).toEqual([]);
    expect(resultado.completa).toBe(false);
  });

  it('acota la confianza y los textos largos', () => {
    const resultado = normalizarSugerenciaDeCalificacion(
      { confianza: 7, comentarioGeneral: 'x'.repeat(2000), comentariosPorCriterio: { estructura: 'y'.repeat(2000) } },
      { rubrica: RUBRICA, estructura: ESTRUCTURA }
    );
    expect(resultado.confianza).toBe(1);
    expect(resultado.comentarioGeneral.length).toBeLessThanOrEqual(600);
    expect(resultado.comentariosPorCriterio.estructura.length).toBeLessThanOrEqual(400);
  });

  it('un resultado vacío o roto no rompe nada', () => {
    const resultado = normalizarSugerenciaDeCalificacion(null, { rubrica: RUBRICA, estructura: ESTRUCTURA });
    expect(resultado).toMatchObject({ niveles: {}, completa: false, confianza: null });
  });
});

describe('/api/groq-sugerir-calificacion', () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'clave-de-prueba';
    process.env.HOST_PASSWORD = 'clave-del-host';
  });

  it('solo el host puede pedir una sugerencia', async () => {
    const respuesta = respuestaFalsa();
    await handler({ method: 'POST', body: { texto: 'a b c d e f', consigna: 'x', rubrica: RUBRICA, hostToken: 'falso' } }, respuesta);
    expect(respuesta.codigo).toBe(401);
  });

  it('un texto muy corto no gasta una llamada a Groq', async () => {
    const { token } = firmarSesionDelHost('clave-del-host');
    const respuesta = respuestaFalsa();
    await handler({ method: 'POST', body: { hostToken: token, texto: 'Muy corto', consigna: 'x', rubrica: RUBRICA } }, respuesta);
    expect(respuesta.codigo).toBe(200);
    expect(respuesta.cuerpo).toEqual({ sugerencia: null, motivo: 'texto_muy_corto' });
  });

  it('exige rúbrica y consigna', async () => {
    const { token } = firmarSesionDelHost('clave-del-host');
    const sinRubrica = respuestaFalsa();
    await handler({ method: 'POST', body: { hostToken: token, texto: 'uno dos tres cuatro cinco seis', consigna: 'x', rubrica: [] } }, sinRubrica);
    expect(sinRubrica.codigo).toBe(400);

    const sinConsigna = respuestaFalsa();
    await handler({ method: 'POST', body: { hostToken: token, texto: 'uno dos tres cuatro cinco seis', consigna: ' ', rubrica: RUBRICA } }, sinConsigna);
    expect(sinConsigna.codigo).toBe(400);
  });

  it('rechaza otros métodos', async () => {
    const respuesta = respuestaFalsa();
    await handler({ method: 'GET' }, respuesta);
    expect(respuesta.codigo).toBe(405);
  });

  it('cuenta palabras con tildes y ñ', () => {
    expect(contarPalabras('El año pasó rápido')).toBe(4);
  });
});
