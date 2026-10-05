import { describe, expect, it, vi } from 'vitest';
import { esUnLimiteDeTasa, publicarConReintentos } from './reintentarPublicacion.js';

const limiteDeCanal = () => Object.assign(new Error('Rate limit exceeded'), { code: 42913, statusCode: 429 });
const sinEspera = { esperar: async () => {}, azar: () => 0.5 };

describe('esUnLimiteDeTasa', () => {
  it('reconoce los rechazos por tasa de Ably y nada más', () => {
    expect(esUnLimiteDeTasa(limiteDeCanal())).toBe(true);
    expect(esUnLimiteDeTasa({ code: 42917 })).toBe(true);
    expect(esUnLimiteDeTasa({ statusCode: 429 })).toBe(true);
    expect(esUnLimiteDeTasa({ code: 40160, statusCode: 401 })).toBe(false);
    expect(esUnLimiteDeTasa(new Error('sin red'))).toBe(false);
    expect(esUnLimiteDeTasa(null)).toBe(false);
  });
});

describe('publicarConReintentos', () => {
  it('si publica a la primera, no espera ni reintenta', async () => {
    const publicar = vi.fn().mockResolvedValue('ok');
    expect(await publicarConReintentos(publicar, sinEspera)).toBe('ok');
    expect(publicar).toHaveBeenCalledTimes(1);
  });

  it('reintenta tras un límite de tasa hasta lograr publicar', async () => {
    const publicar = vi.fn().mockRejectedValueOnce(limiteDeCanal()).mockRejectedValueOnce(limiteDeCanal()).mockResolvedValue('ok');
    expect(await publicarConReintentos(publicar, sinEspera)).toBe('ok');
    expect(publicar).toHaveBeenCalledTimes(3);
  });

  it('la espera crece con cada intento y lleva un factor aleatorio', async () => {
    const esperas = [];
    const publicar = vi.fn().mockRejectedValueOnce(limiteDeCanal()).mockRejectedValueOnce(limiteDeCanal()).mockRejectedValueOnce(limiteDeCanal()).mockResolvedValue('ok');
    await publicarConReintentos(publicar, { esperar: async (ms) => esperas.push(ms), azar: () => 0.5, esperaBaseMs: 500 });
    expect(esperas).toEqual([500, 1000, 2000]);
    await publicarConReintentos(vi.fn().mockRejectedValueOnce(limiteDeCanal()).mockResolvedValue('ok'), {
      esperar: async (ms) => esperas.push(ms),
      azar: () => 0,
      esperaBaseMs: 500,
    });
    expect(esperas.at(-1)).toBe(250); // 500 × (0,5 + 0)
  });

  it('la espera no pasa del máximo', async () => {
    const esperas = [];
    const publicar = vi.fn();
    for (let vez = 0; vez < 5; vez += 1) publicar.mockRejectedValueOnce(limiteDeCanal());
    publicar.mockResolvedValue('ok');
    await publicarConReintentos(publicar, { esperar: async (ms) => esperas.push(ms), azar: () => 0.5, esperaBaseMs: 1000, esperaMaximaMs: 3000 });
    expect(Math.max(...esperas)).toBe(3000);
  });

  it('se rinde tras el máximo de intentos y lanza el último error', async () => {
    const publicar = vi.fn().mockRejectedValue(limiteDeCanal());
    await expect(publicarConReintentos(publicar, { ...sinEspera, maximoDeIntentos: 3 })).rejects.toMatchObject({ code: 42913 });
    expect(publicar).toHaveBeenCalledTimes(3);
  });

  it('un error que no es de tasa se lanza enseguida, sin reintentos', async () => {
    const publicar = vi.fn().mockRejectedValue(new Error('permiso denegado'));
    await expect(publicarConReintentos(publicar, sinEspera)).rejects.toThrow('permiso denegado');
    expect(publicar).toHaveBeenCalledTimes(1);
  });
});
