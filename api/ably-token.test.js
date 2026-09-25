import { describe, it, expect, beforeEach } from 'vitest';
import handler from './ably-token.js';
import { firmarSesionDelHost } from './_sesionDelHost.js';

function respuestaFalsa() {
  const respuesta = { codigo: null, cuerpo: null };
  respuesta.status = (codigo) => {
    respuesta.codigo = codigo;
    return respuesta;
  };
  respuesta.json = (cuerpo) => {
    respuesta.cuerpo = cuerpo;
    return respuesta;
  };
  return respuesta;
}

describe('/api/ably-token', () => {
  beforeEach(() => {
    process.env.ABLY_API_KEY = 'appId.keyId:claveSecretaDePrueba';
    process.env.HOST_PASSWORD = 'clave-del-host';
  });

  it('emite token a un participante con la capacidad limitada a los canales del debate', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'participante-123-abc' } }, respuesta);

    expect(respuesta.codigo).toBe(200);
    expect(respuesta.cuerpo.clientId).toBe('participante-123-abc');
    // Ably devuelve las operaciones ordenadas alfabéticamente.
    expect(JSON.parse(respuesta.cuerpo.capability)).toEqual({
      'debate:*': ['history', 'presence', 'publish', 'subscribe'],
    });
  });

  it('rechaza un clientId con formato inválido', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'a b<script>' } }, respuesta);
    expect(respuesta.codigo).toBe(400);
  });

  it('no da la identidad de host sin la sesión del moderador', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'host' } }, respuesta);
    expect(respuesta.codigo).toBe(401);
  });

  it('no da la identidad de host con un token falso', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'host', hostToken: '9999999999999.abcdef' } }, respuesta);
    expect(respuesta.codigo).toBe(401);
  });

  it('da la identidad de host con la sesión firmada del moderador', async () => {
    const { token } = firmarSesionDelHost('clave-del-host');
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'host', hostToken: token } }, respuesta);
    expect(respuesta.codigo).toBe(200);
    expect(respuesta.cuerpo.clientId).toBe('host');
  });
});
