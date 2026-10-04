import { describe, expect, it } from 'vitest';
import {
  calcularAjusteDeAportePorRevision,
  calcularPuntajeDeAporte,
  resolverLimitesDeAportesPuntuados,
} from './puntajeDeAportes.js';
import { PERFILES_DE_PUNTAJE } from './perfilesDePuntaje.js';

const estandar = PERFILES_DE_PUNTAJE.estandar;

describe('calcularPuntajeDeAporte', () => {
  it('los tres primeros posts valen las posiciones 1, 2 y 3 del perfil', () => {
    const puntajes = [1, 2, 3].map((ordinalDelTipo) =>
      calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo }, estandar)
    );
    expect(puntajes).toEqual([100, 80, 30]);
  });

  it('el 4.º post se publica pero vale 0', () => {
    expect(calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo: 4 }, estandar)).toBe(0);
  });

  it('cada una de las 5 primeras réplicas vale como la posición de menor valor', () => {
    for (let ordinalDelTipo = 1; ordinalDelTipo <= 5; ordinalDelTipo += 1) {
      expect(calcularPuntajeDeAporte({ esReplica: true, ordinalDelTipo }, estandar)).toBe(30);
    }
    expect(calcularPuntajeDeAporte({ esReplica: true, ordinalDelTipo: 6 }, estandar)).toBe(0);
  });

  it('el máximo de un participante en el foro es 210 + 150 = 360 con el perfil Estándar', () => {
    const posts = [1, 2, 3].reduce(
      (suma, ordinalDelTipo) => suma + calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo }, estandar),
      0
    );
    const replicas = [1, 2, 3, 4, 5, 6, 7].reduce(
      (suma, ordinalDelTipo) => suma + calcularPuntajeDeAporte({ esReplica: true, ordinalDelTipo }, estandar),
      0
    );
    expect(posts + replicas).toBe(360);
  });

  it('escala con el perfil elegido', () => {
    expect(calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo: 1 }, PERFILES_DE_PUNTAJE.liviano)).toBe(10);
    expect(calcularPuntajeDeAporte({ esReplica: true, ordinalDelTipo: 1 }, PERFILES_DE_PUNTAJE.estricto)).toBe(300);
  });

  it('respeta límites propios del Programa', () => {
    const limites = { maxPostsNuevos: 2, maxReplicasPuntuadas: 1 };
    expect(calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo: 3 }, estandar, limites)).toBe(0);
    expect(calcularPuntajeDeAporte({ esReplica: true, ordinalDelTipo: 2 }, estandar, limites)).toBe(0);
  });

  it('el tope de posts nunca pasa de las posiciones que tiene el perfil', () => {
    const limites = { maxPostsNuevos: 10, maxReplicasPuntuadas: 5 };
    expect(calcularPuntajeDeAporte({ esReplica: false, ordinalDelTipo: 4 }, estandar, limites)).toBe(0);
  });
});

describe('resolverLimitesDeAportesPuntuados', () => {
  it('usa los valores por defecto y deja que el Programa los cambie', () => {
    expect(resolverLimitesDeAportesPuntuados({})).toEqual({ maxPostsNuevos: 3, maxReplicasPuntuadas: 5 });
    expect(resolverLimitesDeAportesPuntuados({ limitesDePuntaje: { maxReplicasPuntuadas: 8 } })).toEqual({
      maxPostsNuevos: 3,
      maxReplicasPuntuadas: 8,
    });
  });
});

describe('calcularAjusteDeAportePorRevision', () => {
  it('cuenta completo no cambia el puntaje', () => {
    expect(calcularAjusteDeAportePorRevision({ puntajeProvisional: 80, nivelFinal: 1 })).toBe(0);
  });

  it('parcial resta la mitad y no cuenta lo resta todo', () => {
    expect(calcularAjusteDeAportePorRevision({ puntajeProvisional: 80, nivelFinal: 0.5 })).toBe(-40);
    expect(calcularAjusteDeAportePorRevision({ puntajeProvisional: 80, nivelFinal: 0 })).toBe(-80);
  });

  it('sin revisión el aporte conserva su puntaje', () => {
    expect(calcularAjusteDeAportePorRevision({ puntajeProvisional: 80, nivelFinal: null })).toBe(0);
  });
});
