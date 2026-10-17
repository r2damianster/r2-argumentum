import { describe, it, expect } from 'vitest';
import {
  algunaCuentaDelHostCoincide,
  cuentasDelHost,
  credencialesDelHostSonValidas,
  firmarSesionDelHost,
  sesionDelHostEsValida,
  DURACION_DE_LA_SESION_DEL_HOST_MS,
} from './_sesionDelHost.js';

describe('credencialesDelHostSonValidas', () => {
  const esperadas = { usuarioEsperado: 'docente', claveEsperada: 'clave-de-prueba' };

  it('acepta usuario y clave correctos', () => {
    expect(
      credencialesDelHostSonValidas({ usuario: 'docente', clave: 'clave-de-prueba' }, esperadas)
    ).toBe(true);
  });

  it('rechaza si falla cualquiera de los dos, o si faltan', () => {
    expect(credencialesDelHostSonValidas({ usuario: 'docente', clave: 'otra' }, esperadas)).toBe(false);
    expect(credencialesDelHostSonValidas({ usuario: 'otro', clave: 'clave-de-prueba' }, esperadas)).toBe(false);
    expect(credencialesDelHostSonValidas({}, esperadas)).toBe(false);
  });
});

describe('cuentas del host', () => {
  const entornoBase = { HOST_USER: 'principal', HOST_PASSWORD: 'clave-principal' };

  it('sin HOST_USERS solo existe la cuenta principal', () => {
    expect(cuentasDelHost(entornoBase)).toEqual([
      { usuarioEsperado: 'principal', claveEsperada: 'clave-principal' },
    ]);
  });

  it('suma las cuentas adicionales de HOST_USERS', () => {
    const cuentas = cuentasDelHost({
      ...entornoBase,
      HOST_USERS: JSON.stringify([{ usuario: 'segunda', clave: 'clave-segunda' }]),
    });
    expect(cuentas).toHaveLength(2);
    expect(algunaCuentaDelHostCoincide({ usuario: 'segunda', clave: 'clave-segunda' }, cuentas)).toBe(true);
    expect(algunaCuentaDelHostCoincide({ usuario: 'principal', clave: 'clave-principal' }, cuentas)).toBe(true);
    expect(algunaCuentaDelHostCoincide({ usuario: 'segunda', clave: 'clave-principal' }, cuentas)).toBe(false);
  });

  it('un HOST_USERS dañado no bloquea la cuenta principal', () => {
    const cuentas = cuentasDelHost({ ...entornoBase, HOST_USERS: 'esto no es json' });
    expect(cuentas).toHaveLength(1);
  });
});

describe('sesión firmada del host', () => {
  const ahora = 1_000_000;

  it('un token recién firmado es válido y caduca a los 7 días', () => {
    const { token, expiraEn } = firmarSesionDelHost('secreto', ahora);
    expect(expiraEn).toBe(ahora + DURACION_DE_LA_SESION_DEL_HOST_MS);
    expect(sesionDelHostEsValida(token, 'secreto', ahora + 1000)).toBe(true);
    expect(sesionDelHostEsValida(token, 'secreto', expiraEn + 1)).toBe(false);
  });

  it('cambiar la clave del host invalida las sesiones anteriores', () => {
    const { token } = firmarSesionDelHost('secreto', ahora);
    expect(sesionDelHostEsValida(token, 'clave-nueva', ahora + 1000)).toBe(false);
  });

  it('rechaza tokens manipulados, vacíos o sin clave configurada', () => {
    const { token } = firmarSesionDelHost('secreto', ahora);
    const [, firma] = token.split('.');
    expect(sesionDelHostEsValida(`${ahora + 999_999_999}.${firma}`, 'secreto', ahora)).toBe(false);
    expect(sesionDelHostEsValida('', 'secreto', ahora)).toBe(false);
    expect(sesionDelHostEsValida(undefined, 'secreto', ahora)).toBe(false);
    expect(sesionDelHostEsValida(token, undefined, ahora + 1000)).toBe(false);
  });
});
