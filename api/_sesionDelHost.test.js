import { describe, it, expect } from 'vitest';
import {
  credencialesDelHostSonValidas,
  firmarSesionDelHost,
  sesionDelHostEsValida,
  DURACION_DE_LA_SESION_DEL_HOST_MS,
} from './_sesionDelHost.js';

describe('credencialesDelHostSonValidas', () => {
  const esperadas = { usuarioEsperado: 'docente@uleam.edu.ec', claveEsperada: 'clave-de-prueba' };

  it('acepta usuario y clave correctos', () => {
    expect(
      credencialesDelHostSonValidas({ usuario: 'docente@uleam.edu.ec', clave: 'clave-de-prueba' }, esperadas)
    ).toBe(true);
  });

  it('rechaza si falla cualquiera de los dos, o si faltan', () => {
    expect(credencialesDelHostSonValidas({ usuario: 'docente@uleam.edu.ec', clave: 'otra' }, esperadas)).toBe(false);
    expect(credencialesDelHostSonValidas({ usuario: 'otro', clave: 'clave-de-prueba' }, esperadas)).toBe(false);
    expect(credencialesDelHostSonValidas({}, esperadas)).toBe(false);
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
