import { describe, expect, it } from 'vitest';
import {
  asignarRevisionesEntrePares,
  listarAutoresQueRevisa,
  listarRevisoresDeUnAutor,
} from './asignarRevisionesEntrePares.js';

function azarSembrado(semilla = 7) {
  let estado = semilla;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

const IDS = Array.from({ length: 12 }, (_, indice) => `p${indice}`);

describe('asignarRevisionesEntrePares', () => {
  it('cada persona revisa la cantidad pedida y nunca a sí misma', () => {
    const { asignaciones, revisionesPorPersona } = asignarRevisionesEntrePares({ autoresIds: IDS, revisionesPorPersona: 2, azar: azarSembrado() });
    expect(revisionesPorPersona).toBe(2);
    for (const id of IDS) {
      expect(asignaciones[id]).toHaveLength(2);
      expect(asignaciones[id]).not.toContain(id);
      expect(new Set(asignaciones[id]).size).toBe(2);
    }
  });

  it('la carga queda pareja: cada texto recibe tantas revisiones como cada persona hace', () => {
    const { asignaciones } = asignarRevisionesEntrePares({ autoresIds: IDS, revisionesPorPersona: 3, azar: azarSembrado(3) });
    for (const id of IDS) {
      expect(listarRevisoresDeUnAutor(asignaciones, id)).toHaveLength(3);
    }
  });

  it('con pocas entregas no hay revisión entre pares', () => {
    expect(asignarRevisionesEntrePares({ autoresIds: ['a', 'b'] })).toEqual({
      asignaciones: {},
      revisionesPorPersona: 0,
      motivo: 'pocas_entregas',
    });
  });

  it('con tres personas alcanza, y acota las revisiones a n − 1', () => {
    const { asignaciones, revisionesPorPersona } = asignarRevisionesEntrePares({ autoresIds: ['a', 'b', 'c'], revisionesPorPersona: 5 });
    expect(revisionesPorPersona).toBe(2);
    expect(listarAutoresQueRevisa(asignaciones, 'a').sort()).toEqual(['b', 'c']);
  });

  it('ignora duplicados y no modifica la lista recibida', () => {
    const entrada = ['a', 'b', 'c', 'a'];
    const { asignaciones } = asignarRevisionesEntrePares({ autoresIds: entrada, revisionesPorPersona: 1 });
    expect(Object.keys(asignaciones).sort()).toEqual(['a', 'b', 'c']);
    expect(entrada).toEqual(['a', 'b', 'c', 'a']);
  });

  it('el reparto cambia con el azar', () => {
    const uno = asignarRevisionesEntrePares({ autoresIds: IDS, revisionesPorPersona: 1, azar: azarSembrado(1) }).asignaciones;
    const otro = asignarRevisionesEntrePares({ autoresIds: IDS, revisionesPorPersona: 1, azar: azarSembrado(99) }).asignaciones;
    expect(uno).not.toEqual(otro);
  });
});
