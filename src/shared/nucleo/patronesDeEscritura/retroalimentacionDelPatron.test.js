import { describe, expect, it } from 'vitest';
import { patronDeArgumentoActivo } from './patronDeArgumento.js';
import {
  cargaDelPatronParaElModerador,
  mensajeDeRetroalimentacionDelPatron,
  patronParaLaIA,
  registroDelPatronParaElModerador,
} from './retroalimentacionDelPatron.js';

const conRetroalimentacion = patronDeArgumentoActivo({ patronDeArgumento: { modo: 'con_retroalimentacion', estructura: 'cer' } });
const sinRetroalimentacion = patronDeArgumentoActivo({ patronDeArgumento: { modo: 'sin_retroalimentacion', estructura: 'cer' } });
const detectado = { nombre: 'CER', partesPresentes: ['Afirmación'], partesFaltantes: ['Evidencia', 'Razonamiento'], confianza: 0.8 };

describe('patronParaLaIA', () => {
  it('sin patrón no manda nada', () => {
    expect(patronParaLaIA(null)).toBeNull();
  });

  it('manda el nombre y las partes con su descripción', () => {
    const patron = patronParaLaIA(conRetroalimentacion);
    expect(patron.nombre).toBe('CER');
    expect(patron.partes.map((parte) => parte.nombre)).toEqual(['Afirmación', 'Evidencia', 'Razonamiento']);
    expect(patron.partes[0].descripcion).not.toBe('');
  });
});

describe('mensajeDeRetroalimentacionDelPatron', () => {
  it('con retroalimentación dice qué partes faltan y que puede enviarlo igual', () => {
    const mensaje = mensajeDeRetroalimentacionDelPatron(conRetroalimentacion, detectado);
    expect(mensaje).toContain('1 de 3');
    expect(mensaje).toContain('Evidencia, Razonamiento');
    expect(mensaje).toContain('Puedes enviarlo igual');
  });

  it('en modo evaluación a quien escribe no se le dice nada', () => {
    expect(mensajeDeRetroalimentacionDelPatron(sinRetroalimentacion, detectado)).toBe('');
  });

  it('no dice nada si la IA no detectó nada o ya están todas las partes', () => {
    expect(mensajeDeRetroalimentacionDelPatron(conRetroalimentacion, null)).toBe('');
    expect(
      mensajeDeRetroalimentacionDelPatron(conRetroalimentacion, {
        ...detectado,
        partesPresentes: ['Afirmación', 'Evidencia', 'Razonamiento'],
        partesFaltantes: [],
      })
    ).toBe('');
  });
});

describe('registroDelPatronParaElModerador', () => {
  it('el moderador recibe el registro en ambos modos', () => {
    expect(registroDelPatronParaElModerador(sinRetroalimentacion, detectado)).toEqual({
      modo: 'sin_retroalimentacion',
      estructura: 'cer',
      nombre: 'CER',
      partesPresentes: ['Afirmación'],
      partesFaltantes: ['Evidencia', 'Razonamiento'],
    });
    expect(registroDelPatronParaElModerador(conRetroalimentacion, detectado).modo).toBe('con_retroalimentacion');
  });

  it('sin patrón o sin detección no hay registro', () => {
    expect(registroDelPatronParaElModerador(null, detectado)).toBeNull();
    expect(registroDelPatronParaElModerador(conRetroalimentacion, null)).toBeNull();
  });
});

describe('cargaDelPatronParaElModerador', () => {
  it('suma el id del argumento al registro', () => {
    const carga = cargaDelPatronParaElModerador(sinRetroalimentacion, detectado, 'arg-1');
    expect(carga.argumentId).toBe('arg-1');
    expect(carga.partesFaltantes).toEqual(['Evidencia', 'Razonamiento']);
  });

  it('sin detección, sin patrón o sin argumento no hay carga', () => {
    expect(cargaDelPatronParaElModerador(sinRetroalimentacion, null, 'arg-1')).toBeNull();
    expect(cargaDelPatronParaElModerador(null, detectado, 'arg-1')).toBeNull();
    expect(cargaDelPatronParaElModerador(sinRetroalimentacion, detectado, '')).toBeNull();
  });
});
