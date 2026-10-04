import { describe, expect, it } from 'vitest';
import { derivarClientIdDelSecreto as derivarEnElServidor } from '../../../api/_identidadDelParticipante.js';
import { crearIdentidadSegura, derivarClientIdDelSecreto, generarSecretoAleatorio } from './identidadDelParticipante.js';

describe('identidad inviolable del participante', () => {
  it('el navegador y el servidor derivan exactamente el mismo clientId', async () => {
    for (const secreto of ['a'.repeat(32), generarSecretoAleatorio(), generarSecretoAleatorio()]) {
      expect(await derivarClientIdDelSecreto(secreto)).toBe(derivarEnElServidor(secreto));
    }
  });

  it('el id cumple el formato que acepta el servidor y no deja deducir el secreto', async () => {
    const { participantId, secreto } = await crearIdentidadSegura();
    expect(participantId).toMatch(/^p-[0-9a-f]{32}$/);
    expect(secreto).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(participantId).not.toContain(secreto.slice(0, 8));
  });

  it('cada ingreso genera una identidad distinta', async () => {
    const [una, otra] = [await crearIdentidadSegura(), await crearIdentidadSegura()];
    expect(una.participantId).not.toBe(otra.participantId);
    expect(una.secreto).not.toBe(otra.secreto);
  });
});
