import { describe, expect, it } from 'vitest';
import {
  DISTRIBUCIONES_DE_ESTRUCTURA,
  describirLaEstructuraPedida,
  resolverDistribucion,
  resolverEstructuraDelPrograma,
  resolverNumeroDeParrafos,
} from './estructurasDeEscritura.js';

describe('resolverEstructuraDelPrograma', () => {
  it('resuelve una estructura de serie por su id, en el idioma pedido', () => {
    const peelEnEspanol = resolverEstructuraDelPrograma({ estructura: 'peel' }, 'es');
    expect(peelEnEspanol.partes.map((parte) => parte.nombre)).toEqual(['Punto', 'Evidencia', 'Explicación', 'Enlace']);

    const peelEnIngles = resolverEstructuraDelPrograma({ estructura: { id: 'peel' } }, 'en');
    expect(peelEnIngles.partes.map((parte) => parte.nombre)).toEqual(['Point', 'Evidence', 'Explain', 'Link']);
  });

  it('acepta una estructura propia del Programa con textos simples', () => {
    const propia = resolverEstructuraDelPrograma({
      estructura: { nombre: 'Mi esquema', partes: [{ nombre: 'Idea', descripcion: 'La idea' }, { nombre: 'Prueba' }] },
    });
    expect(propia.esLibre).toBe(false);
    expect(propia.partes).toEqual([
      { nombre: 'Idea', descripcion: 'La idea' },
      { nombre: 'Prueba', descripcion: '' },
    ]);
  });

  it('trata una estructura desconocida o ausente como libre', () => {
    expect(resolverEstructuraDelPrograma({ estructura: 'inventada' }).esLibre).toBe(true);
    expect(resolverEstructuraDelPrograma({}).esLibre).toBe(true);
  });

  it('SPRE tiene cuatro partes y CER tres', () => {
    expect(resolverEstructuraDelPrograma({ estructura: 'spre' }).partes).toHaveLength(4);
    expect(resolverEstructuraDelPrograma({ estructura: 'cer' }).partes).toHaveLength(3);
  });
});

describe('distribución y número de párrafos', () => {
  it('la distribución por defecto es compacta', () => {
    expect(resolverDistribucion({})).toBe(DISTRIBUCIONES_DE_ESTRUCTURA.COMPACTA);
    expect(resolverDistribucion({ distribucion: 'desarrollada' })).toBe(DISTRIBUCIONES_DE_ESTRUCTURA.DESARROLLADA);
  });

  it('en la distribución compacta se respeta el número pedido', () => {
    expect(resolverNumeroDeParrafos({ estructura: 'peel', distribucion: 'compacta', numeroDeParrafos: 2 })).toBe(2);
  });

  it('en la desarrollada sube al múltiplo del número de partes', () => {
    expect(resolverNumeroDeParrafos({ estructura: 'peel', distribucion: 'desarrollada', numeroDeParrafos: 2 })).toBe(4);
    expect(resolverNumeroDeParrafos({ estructura: 'peel', distribucion: 'desarrollada', numeroDeParrafos: 5 })).toBe(8);
    expect(resolverNumeroDeParrafos({ estructura: 'cer', distribucion: 'desarrollada', numeroDeParrafos: 3 })).toBe(3);
  });

  it('sin número pide un párrafo', () => {
    expect(resolverNumeroDeParrafos({})).toBe(1);
  });

  it('describe lo que se pide', () => {
    expect(describirLaEstructuraPedida({ estructura: 'libre', numeroDeParrafos: 2 })).toBe('Escritura libre en 2 párrafos.');
    expect(
      describirLaEstructuraPedida({ estructura: 'peel', distribucion: 'desarrollada', numeroDeParrafos: 4 })
    ).toContain('una parte por párrafo');
    expect(describirLaEstructuraPedida({ estructura: 'spre', numeroDeParrafos: 1 })).toContain('dentro de cada párrafo');
  });
});

describe('muestra pedagógica de las estructuras de serie', () => {
  const ESTRUCTURAS_CON_PARTES = ['peel', 'spre', 'prep', 'cer'];

  it('cada estructura explica en qué consiste y trae un ejemplo con una oración por parte, en español e inglés', () => {
    for (const id of ESTRUCTURAS_CON_PARTES) {
      for (const idioma of ['es', 'en']) {
        const estructura = resolverEstructuraDelPrograma({ estructura: id }, idioma);
        expect(estructura.queEs.length, `${id} ${idioma}: qué es`).toBeGreaterThan(40);
        expect(estructura.ejemplo, `${id} ${idioma}: ejemplo`).toHaveLength(estructura.partes.length);
        expect(estructura.ejemplo.every((oracion) => oracion.length > 15)).toBe(true);
      }
    }
  });

  it('la escritura libre da una orientación pero no un ejemplo; una estructura propia no inventa uno', () => {
    const libre = resolverEstructuraDelPrograma({ estructura: 'libre' });
    expect(libre.queEs).toContain('Sin estructura obligatoria');
    expect(libre.ejemplo).toBeNull();
    const propia = resolverEstructuraDelPrograma({ estructura: { nombre: 'Mi esquema', partes: [{ nombre: 'Idea' }] } });
    expect(propia).toMatchObject({ queEs: '', ejemplo: null });
  });
});
