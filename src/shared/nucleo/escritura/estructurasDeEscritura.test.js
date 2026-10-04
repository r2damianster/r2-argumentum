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
