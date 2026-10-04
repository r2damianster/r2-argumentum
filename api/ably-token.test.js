import { describe, it, expect, beforeEach } from 'vitest';
import handler, { capacidadSegunLaIdentidad } from './ably-token.js';
import { firmarSesionDelHost } from './_sesionDelHost.js';
import { NOMBRE_DE_LA_CABECERA_DEL_SECRETO, derivarClientIdDelSecreto } from './_identidadDelParticipante.js';

// Una identidad de participante válida: el id sale del secreto (ver _identidadDelParticipante.js).
const SECRETO_DE_ANA = 'secreto-de-ana-0123456789abcdefghijklmnopqrstuv';
const SECRETO_DE_BETO = 'secreto-de-beto-0123456789abcdefghijklmnopqrstu';
const ID_DE_ANA = derivarClientIdDelSecreto(SECRETO_DE_ANA);
const ID_DE_BETO = derivarClientIdDelSecreto(SECRETO_DE_BETO);
const comoAna = { query: { clientId: ID_DE_ANA }, headers: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: SECRETO_DE_ANA } };

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
    await handler(comoAna, respuesta);

    expect(respuesta.codigo).toBe(200);
    expect(respuesta.cuerpo.clientId).toBe(ID_DE_ANA);
    // Ably devuelve las operaciones ordenadas alfabéticamente.
    expect(JSON.parse(respuesta.cuerpo.capability)).toEqual({
      'debate:sala:*': ['history', 'presence', 'publish', 'subscribe'],
      'debate:integridad:*': ['publish'],
      'debate:entrega:*': ['publish'],
      [`debate:devolucion:${ID_DE_ANA}:*`]: ['history', 'subscribe'],
    });
  });

  it('un participante no puede leer las entregas de nadie ni la devolución de otra persona', async () => {
    const respuesta = respuestaFalsa();
    await handler(comoAna, respuesta);
    const capacidad = JSON.parse(respuesta.cuerpo.capability);
    expect(capacidad['debate:entrega:*']).toEqual(['publish']);
    expect(capacidad['debate:docente:*']).toBeUndefined();
    expect(capacidad['debate:devolucion:*']).toBeUndefined();
    expect(Object.keys(capacidad).filter((canal) => canal.startsWith('debate:devolucion:'))).toEqual([
      `debate:devolucion:${ID_DE_ANA}:*`,
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
    await handler(comoAna, respuesta);
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
    for (const identidad of ['host', ID_DE_ANA]) {
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

  describe('identidad inviolable del participante', () => {
    it('no da un token para el clientId de otra persona, aunque se vea en la presencia', async () => {
      const respuesta = respuestaFalsa();
      // Beto conoce el id público de Ana, pero no su secreto: usa el suyo.
      await handler({ query: { clientId: ID_DE_ANA }, headers: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: SECRETO_DE_BETO } }, respuesta);
      expect(respuesta.codigo).toBe(401);
      expect(respuesta.cuerpo.capability).toBeUndefined();
    });

    it('sin el secreto no hay token', async () => {
      const respuesta = respuestaFalsa();
      await handler({ query: { clientId: ID_DE_ANA }, headers: {} }, respuesta);
      expect(respuesta.codigo).toBe(401);
      const sinCabeceras = respuestaFalsa();
      await handler({ query: { clientId: ID_DE_ANA } }, sinCabeceras);
      expect(sinCabeceras.codigo).toBe(401);
    });

    it('un id con el formato antiguo (sin secreto) ya no obtiene token', async () => {
      const respuesta = respuestaFalsa();
      await handler({ query: { clientId: 'participante-123-abc' }, headers: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: SECRETO_DE_ANA } }, respuesta);
      expect(respuesta.codigo).toBe(401);
    });

    it('cada persona obtiene token solo para su propio id', async () => {
      const respuesta = respuestaFalsa();
      await handler({ query: { clientId: ID_DE_BETO }, headers: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: SECRETO_DE_BETO } }, respuesta);
      expect(respuesta.codigo).toBe(200);
      expect(JSON.parse(respuesta.cuerpo.capability)[`debate:devolucion:${ID_DE_BETO}:*`]).toBeDefined();
      expect(JSON.parse(respuesta.cuerpo.capability)[`debate:devolucion:${ID_DE_ANA}:*`]).toBeUndefined();
    });

    it('el secreto debe tener un formato razonable', async () => {
      const respuesta = respuestaFalsa();
      await handler({ query: { clientId: derivarClientIdDelSecreto('corto') }, headers: { [NOMBRE_DE_LA_CABECERA_DEL_SECRETO]: 'corto' } }, respuesta);
      expect(respuesta.codigo).toBe(401);
    });
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
