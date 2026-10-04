import { describe, it, expect } from 'vitest';
import { armarProgramaDeLaSesion } from './programaDeLaSesion.js';

const posturasDelPrograma = [
  { id: 'izquierda', etiqueta: 'Izquierda', color: '#c00' },
  { id: 'derecha', etiqueta: 'Derecha', color: '#00c' },
  { id: 'centro', etiqueta: 'Centro', color: '#0c0' },
];

const programaBase = { titulo: 'Izquierda o derecha', temaCentral: 'Tema', posturas: posturasDelPrograma };

describe('armarProgramaDeLaSesion', () => {
  it('conserva el perfil, el idioma y las posturas nuevas que eligió el moderador', () => {
    const programa = armarProgramaDeLaSesion({
      programaBase,
      posturasDelPrograma,
      idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha', 'centro']),
      perfilDePuntaje: 'estandar',
      permitirPosturasNuevas: true,
      idioma: 'en',
    });

    expect(programa.perfilDePuntaje).toBe('estandar');
    expect(programa.permitirPosturasNuevas).toBe(true);
    expect(programa.idioma).toBe('en');
    expect(programa.titulo).toBe('Izquierda o derecha');
  });

  it('descarta la fase apertura_simultanea de Programas antiguos: ya no existe', () => {
    const programa = armarProgramaDeLaSesion({
      programaBase: {
        ...programaBase,
        fases: [
          { tipo: 'apertura_simultanea', duracionMin: 3 },
          { tipo: 'escritura_argumentos', ronda: 1 },
          { tipo: 'cierre_y_ranking' },
        ],
      },
      posturasDelPrograma,
      idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha']),
      perfilDePuntaje: 'liviano',
    });

    expect(programa.fases.map((fase) => fase.tipo)).toEqual(['escritura_argumentos', 'cierre_y_ranking']);
  });

  it('preserva y permite cambiar asignacionPostura', () => {
    const programa = armarProgramaDeLaSesion({
      programaBase: { ...programaBase, asignacionPostura: 'aleatoria' },
      posturasDelPrograma,
      idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha']),
      perfilDePuntaje: 'liviano',
      permitirPosturasNuevas: false,
      idioma: 'es',
      asignacionPostura: 'por_argumento',
    });

    expect(programa.asignacionPostura).toBe('por_argumento');
  });

  it('deja fuera las posturas destildadas sin perder el resto de la configuración', () => {
    const programa = armarProgramaDeLaSesion({
      programaBase,
      posturasDelPrograma,
      idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha']),
      perfilDePuntaje: 'estricto',
      permitirPosturasNuevas: false,
      idioma: 'es',
    });

    expect(programa.posturas.map((postura) => postura.id)).toEqual(['izquierda', 'derecha']);
    expect(programa.perfilDePuntaje).toBe('estricto');
  });

  it('no arma nada con menos de dos posturas', () => {
    const programa = armarProgramaDeLaSesion({
      programaBase,
      posturasDelPrograma,
      idsDePosturasSeleccionadas: new Set(['izquierda']),
      perfilDePuntaje: 'estandar',
      permitirPosturasNuevas: false,
      idioma: 'es',
    });

    expect(programa).toBeNull();
  });
});

describe('armarProgramaDeLaSesion: moderación', () => {
  const base = {
    programaBase,
    posturasDelPrograma,
    idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha']),
    perfilDePuntaje: 'liviano',
  };

  it('sin elegir nada rige el modo reglamentario', () => {
    expect(armarProgramaDeLaSesion(base).moderacion).toEqual({ modo: 'reglamentario', numeroFijo: null });
  });

  it('conserva el modo y el número fijo que eligió el moderador', () => {
    const programa = armarProgramaDeLaSesion({ ...base, moderacion: { modo: 'fijo', numeroFijo: 2 } });
    expect(programa.moderacion).toEqual({ modo: 'fijo', numeroFijo: 2 });
  });

  it('un Programa que ya traía moderación la conserva si el moderador no cambia nada', () => {
    const programa = armarProgramaDeLaSesion({
      ...base,
      programaBase: { ...programaBase, moderacion: { modo: 'ninguno' } },
    });
    expect(programa.moderacion.modo).toBe('ninguno');
  });
});

describe('armarProgramaDeLaSesion: integridad', () => {
  const base = {
    programaBase,
    posturasDelPrograma,
    idsDePosturasSeleccionadas: new Set(['izquierda', 'derecha']),
    perfilDePuntaje: 'liviano',
  };

  it('sin elegir nada la integridad queda apagada', () => {
    expect(armarProgramaDeLaSesion(base).integridad).toEqual({ nivel: 'ninguna' });
  });

  it('conserva el nivel que eligió el moderador', () => {
    expect(armarProgramaDeLaSesion({ ...base, integridad: { nivel: 'restrictiva' } }).integridad.nivel).toBe('restrictiva');
  });

  it('un nivel inválido vuelve a apagada', () => {
    expect(armarProgramaDeLaSesion({ ...base, integridad: { nivel: 'inventado' } }).integridad.nivel).toBe('ninguna');
  });
});
