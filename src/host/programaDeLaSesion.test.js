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
