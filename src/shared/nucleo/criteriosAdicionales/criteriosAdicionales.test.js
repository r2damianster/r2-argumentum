import { describe, expect, it } from 'vitest';
import {
  MAXIMO_DE_CRITERIOS_ACTIVOS,
  aplicarCriteriosElegidos,
  criteriosActivosDelPrograma,
  criteriosParaLaIA,
  normalizarCriteriosAdicionales,
} from './criteriosAdicionales.js';

const ESCENA = { id: 'describe_escena', etiqueta: 'Describe una escena', descripcion: 'Quién, qué ocurre.', activoPorDefecto: true };
const CITA = { id: 'cita_texto', etiqueta: 'Cita el texto', activoPorDefecto: false };

describe('normalizarCriteriosAdicionales', () => {
  it('devuelve lista vacía si el Programa no trae criterios', () => {
    expect(normalizarCriteriosAdicionales(undefined)).toEqual([]);
    expect(normalizarCriteriosAdicionales('texto')).toEqual([]);
  });

  it('lee activoPorDefecto del Programa y activo de la sesión', () => {
    const [escena, cita] = normalizarCriteriosAdicionales([ESCENA, { ...CITA, activo: true }]);
    expect(escena.activo).toBe(true);
    expect(cita.activo).toBe(true);
  });

  it('descarta entradas sin id, sin etiqueta o repetidas', () => {
    const resultado = normalizarCriteriosAdicionales([{ etiqueta: 'sin id' }, { id: 'a' }, ESCENA, ESCENA]);
    expect(resultado.map((criterio) => criterio.id)).toEqual(['describe_escena']);
  });

  it('no deja más de tres criterios activos', () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, etiqueta: id, activoPorDefecto: true }));
    const activos = normalizarCriteriosAdicionales(cinco).filter((criterio) => criterio.activo);
    expect(activos).toHaveLength(MAXIMO_DE_CRITERIOS_ACTIVOS);
    expect(activos.map((criterio) => criterio.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('aplicarCriteriosElegidos', () => {
  it('activa solo los ids elegidos por el moderador', () => {
    const resultado = aplicarCriteriosElegidos([ESCENA, CITA], new Set(['cita_texto']));
    expect(resultado.find((criterio) => criterio.id === 'describe_escena').activo).toBe(false);
    expect(resultado.find((criterio) => criterio.id === 'cita_texto').activo).toBe(true);
  });
});

describe('criteriosActivosDelPrograma y criteriosParaLaIA', () => {
  it('solo cuentan los activos y a la IA solo se le manda id, etiqueta y descripción', () => {
    const programa = { criteriosAdicionales: [ESCENA, CITA] };
    expect(criteriosActivosDelPrograma(programa).map((criterio) => criterio.id)).toEqual(['describe_escena']);
    expect(criteriosParaLaIA(programa)).toEqual([
      { id: 'describe_escena', etiqueta: 'Describe una escena', descripcion: 'Quién, qué ocurre.' },
    ]);
  });

  it('un Programa sin criterios no manda nada a la IA', () => {
    expect(criteriosParaLaIA({})).toEqual([]);
    expect(criteriosParaLaIA(null)).toEqual([]);
  });
});
