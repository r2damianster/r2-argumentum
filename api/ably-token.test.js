import { describe, it, expect, beforeEach } from 'vitest';
import handler, { capacidadSegunLaIdentidad } from './ably-token.js';
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
      'debate:sala:*': ['history', 'presence', 'publish', 'subscribe'],
      'debate:integridad:*': ['publish'],
      'debate:entrega:*': ['publish'],
      'debate:devolucion:participante-123-abc:*': ['history', 'subscribe'],
    });
  });

  it('un participante no puede leer las entregas de nadie ni la devolución de otra persona', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'participante-123-abc' } }, respuesta);
    const capacidad = JSON.parse(respuesta.cuerpo.capability);
    expect(capacidad['debate:entrega:*']).toEqual(['publish']);
    expect(capacidad['debate:docente:*']).toBeUndefined();
    expect(capacidad['debate:devolucion:*']).toBeUndefined();
    expect(Object.keys(capacidad).filter((canal) => canal.startsWith('debate:devolucion:'))).toEqual([
      'debate:devolucion:participante-123-abc:*',
    ]);
  });

  it('el host lee las entregas y el canal del docente, y publica las devoluciones', async () => {
    const { token } = firmarSesionDelHost('clave-del-host');
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'host', hostToken: token } }, respuesta);
    const capacidad = JSON.parse(respuesta.cuerpo.capability);
    expect(capacidad['debate:entrega:*']).toEqual(['history', 'publish', 'subscribe']);
    expect(capacidad['debate:docente:*']).toEqual(['history', 'publish', 'subscribe']);
    expect(capacidad['debate:devolucion:*']).toEqual(['publish']);
  });

  it('un participante NO puede leer el canal de integridad: solo publicar', async () => {
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'participante-123-abc' } }, respuesta);
    const capacidad = JSON.parse(respuesta.cuerpo.capability);
    expect(capacidad['debate:integridad:*']).toEqual(['publish']);
    expect(capacidad['debate:integridad:*']).not.toContain('subscribe');
    expect(capacidad['debate:integridad:*']).not.toContain('history');
  });

  it('el host sí puede suscribirse y pedir el historial del canal de integridad', async () => {
    const { token } = firmarSesionDelHost('clave-del-host');
    const respuesta = respuestaFalsa();
    await handler({ query: { clientId: 'host', hostToken: token } }, respuesta);
    expect(JSON.parse(respuesta.cuerpo.capability)['debate:integridad:*']).toEqual(['history', 'publish', 'subscribe']);
  });

  it('ningún token alcanza canales fuera de los del debate', () => {
    for (const identidad of ['host', 'participante-1']) {
      for (const canal of Object.keys(capacidadSegunLaIdentidad(identidad))) {
        expect(canal).toMatch(/^debate:(sala|integridad|entrega|docente):\*$|^debate:devolucion:[A-Za-z0-9_-]+:\*$|^debate:devolucion:\*$/);
      }
    }
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
