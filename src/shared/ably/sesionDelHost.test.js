import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { guardarSesionDelHost, iniciarSesionDelHost, leerSesionDelHost } from './sesionDelHost.js';

function almacenamientoFalso() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };
}

function respuestaFalsa(estado, cuerpo = {}) {
  return { status: estado, ok: estado >= 200 && estado < 300, json: async () => cuerpo };
}

describe('sesión del host en el navegador', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', almacenamientoFalso());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin nada guardado no hay sesión', () => {
    expect(leerSesionDelHost()).toBeNull();
  });

  it('guarda y lee una sesión vigente', () => {
    guardarSesionDelHost({ token: 'abc', expiraEn: 5000 });
    expect(leerSesionDelHost(1000)).toEqual({ token: 'abc', expiraEn: 5000 });
  });

  it('una sesión caducada se trata como sin sesión', () => {
    guardarSesionDelHost({ token: 'abc', expiraEn: 5000 });
    expect(leerSesionDelHost(6000)).toBeNull();
  });

  it('guardar null cierra la sesión', () => {
    guardarSesionDelHost({ token: 'abc', expiraEn: 5000 });
    guardarSesionDelHost(null);
    expect(leerSesionDelHost(1000)).toBeNull();
  });

  it('contenido dañado en localStorage no rompe: es sin sesión', () => {
    localStorage.setItem('r2-argumentum-host-sesion', '{no es json');
    expect(leerSesionDelHost()).toBeNull();
  });
});

describe('iniciarSesionDelHost', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', almacenamientoFalso());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con credenciales correctas guarda la sesión que devuelve el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaFalsa(200, { token: 't', expiraEn: Date.now() + 60_000 })));

    const resultado = await iniciarSesionDelHost({ usuario: 'u', clave: 'c' });

    expect(resultado.sesion.token).toBe('t');
    expect(leerSesionDelHost()?.token).toBe('t');
  });

  it('401 → usuario o clave incorrectos, y no guarda nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaFalsa(401)));

    const resultado = await iniciarSesionDelHost({ usuario: 'u', clave: 'mala' });

    expect(resultado.mensajeDeError).toBe('Usuario o clave incorrectos.');
    expect(leerSesionDelHost()).toBeNull();
  });

  it('503 → avisa que el servidor no tiene la clave configurada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaFalsa(503)));

    const resultado = await iniciarSesionDelHost({ usuario: 'u', clave: 'c' });

    expect(resultado.mensajeDeError).toContain('HOST_PASSWORD');
  });

  it('sin red → mensaje de conexión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('sin red');
    }));

    const resultado = await iniciarSesionDelHost({ usuario: 'u', clave: 'c' });

    expect(resultado.mensajeDeError).toContain('conectar');
  });
});
