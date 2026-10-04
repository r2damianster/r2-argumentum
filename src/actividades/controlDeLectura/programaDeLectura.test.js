import { describe, expect, it } from 'vitest';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import {
  armarProgramaDeLaSesionDeLectura,
  conCamposSoloDelHost,
  normalizarProgramaDeLectura,
  normalizarRevisionDePares,
  programaPublicable,
  resolverVentanaDeConfirmacionMin,
  validarProgramaDeLectura,
} from './programaDeLectura.js';

const PROGRAMA_BASE = {
  programId: 'lectura-1',
  titulo: 'Control de lectura',
  temaCentral: 'Tema',
  actividad: 'control_de_lectura',
  consigna: 'Resume la idea central del texto.',
  estructura: 'peel',
  clavesDeLaLectura: '- idea 1\n- idea 2',
  fases: [{ tipo: 'control_de_lectura', duracionMin: 15 }, { tipo: 'cierre_y_ranking' }],
};

describe('programaPublicable', () => {
  it('retira lo que solo debe conocer el host', () => {
    const publicable = programaPublicable({ ...PROGRAMA_BASE, textoDeReferencia: 'texto completo' });
    expect(publicable.clavesDeLaLectura).toBeUndefined();
    expect(publicable.textoDeReferencia).toBeUndefined();
    expect(publicable.consigna).toBe(PROGRAMA_BASE.consigna);
  });

  it('no modifica el Programa original', () => {
    programaPublicable(PROGRAMA_BASE);
    expect(PROGRAMA_BASE.clavesDeLaLectura).toBeDefined();
  });

  it('conCamposSoloDelHost los devuelve al Programa que se guarda para retomar la sesión', () => {
    const publicado = programaPublicable(PROGRAMA_BASE);
    expect(conCamposSoloDelHost(publicado, PROGRAMA_BASE).clavesDeLaLectura).toBe(PROGRAMA_BASE.clavesDeLaLectura);
  });
});

describe('validarProgramaDeLectura', () => {
  it('un Programa completo no tiene errores', () => {
    expect(validarProgramaDeLectura(PROGRAMA_BASE)).toEqual([]);
  });

  it('exige la consigna', () => {
    expect(validarProgramaDeLectura({ ...PROGRAMA_BASE, consigna: '  ' })).toHaveLength(1);
  });

  it('revisa la estructura propia, la distribución y la rúbrica', () => {
    expect(validarProgramaDeLectura({ ...PROGRAMA_BASE, estructura: { nombre: 'X', partes: [] } })).toHaveLength(1);
    expect(
      validarProgramaDeLectura({ ...PROGRAMA_BASE, estructura: { nombre: 'X', partes: [{ nombre: 'Idea' }] } })
    ).toEqual([]);
    expect(validarProgramaDeLectura({ ...PROGRAMA_BASE, distribucion: 'rara' })).toHaveLength(1);
    expect(validarProgramaDeLectura({ ...PROGRAMA_BASE, rubrica: [{ nombre: '' }] })).toHaveLength(1);
  });
});

describe('normalizarProgramaDeLectura', () => {
  it('no tiene posturas ni co-moderadores y activa la integridad por defecto', () => {
    const normalizado = normalizarProgramaDeLectura(PROGRAMA_BASE);
    expect(normalizado.posturas).toEqual([]);
    expect(normalizado.moderacion).toEqual({ modo: 'ninguno' });
    expect(normalizado.integridad.nivel).toBe('advertencias');
    expect(normalizado.ventanaDeConfirmacionMin).toBe(10);
  });

  it('respeta una integridad elegida, incluso apagada', () => {
    expect(normalizarProgramaDeLectura({ ...PROGRAMA_BASE, integridad: { nivel: 'ninguna' } }).integridad.nivel).toBe('ninguna');
  });

  it('normaliza la revisión de pares', () => {
    expect(normalizarRevisionDePares(undefined)).toEqual({ activa: false, revisionesPorPersona: 2, duracionMin: 10 });
    expect(normalizarRevisionDePares({ activa: true, revisionesPorPersona: 99, duracionMin: 7 })).toEqual({
      activa: true,
      revisionesPorPersona: 5,
      duracionMin: 7,
    });
  });

  it('la ventana de confirmación inválida vuelve a 10 minutos', () => {
    expect(resolverVentanaDeConfirmacionMin({ ventanaDeConfirmacionMin: 0 })).toBe(10);
    expect(resolverVentanaDeConfirmacionMin({ ventanaDeConfirmacionMin: 15 })).toBe(15);
  });
});

describe('armarProgramaDeLaSesionDeLectura', () => {
  it('arma las fases según lo elegido: sin revisión de pares', () => {
    const programa = armarProgramaDeLaSesionDeLectura({
      programaBase: PROGRAMA_BASE,
      idioma: 'en',
      duracionDeLaEscrituraMin: 25,
      numeroDeParrafos: 2,
      estructura: 'spre',
      distribucion: 'desarrollada',
      integridad: { nivel: 'restrictiva' },
      revisionDePares: { activa: false },
      ventanaDeConfirmacionMin: 5,
    });
    expect(programa.fases).toEqual([
      { tipo: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 25 },
      { tipo: TIPOS_DE_FASE.CIERRE_Y_RANKING },
    ]);
    expect(programa).toMatchObject({
      idioma: 'en',
      numeroDeParrafos: 2,
      estructura: 'spre',
      distribucion: 'desarrollada',
      ventanaDeConfirmacionMin: 5,
    });
    expect(programa.integridad.nivel).toBe('restrictiva');
  });

  it('con revisión de pares agrega esa fase con su propio tiempo', () => {
    const programa = armarProgramaDeLaSesionDeLectura({
      programaBase: PROGRAMA_BASE,
      idioma: 'es',
      duracionDeLaEscrituraMin: 20,
      numeroDeParrafos: 1,
      revisionDePares: { activa: true, revisionesPorPersona: 2, duracionMin: 8 },
    });
    expect(programa.fases.map((fase) => fase.tipo)).toEqual([
      TIPOS_DE_FASE.CONTROL_DE_LECTURA,
      TIPOS_DE_FASE.REVISION_DE_PARES,
      TIPOS_DE_FASE.CIERRE_Y_RANKING,
    ]);
    expect(programa.fases[1].duracionMin).toBe(8);
  });

  it('sin duración ni número de párrafos elegidos usa los del Programa', () => {
    const programa = armarProgramaDeLaSesionDeLectura({
      programaBase: { ...PROGRAMA_BASE, numeroDeParrafos: 3, idioma: 'en' },
    });
    expect(programa.fases[0].duracionMin).toBe(15);
    expect(programa.numeroDeParrafos).toBe(3);
    expect(programa.idioma).toBe('en');
  });
});
