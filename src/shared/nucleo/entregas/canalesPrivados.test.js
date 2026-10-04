import { describe, expect, it } from 'vitest';
import {
  EVENTOS_PRIVADOS,
  MAXIMO_DE_CARACTERES_DE_UNA_ENTREGA,
  nombreDelCanalDeDevolucion,
  nombreDelCanalDeEntregas,
  nombreDelCanalDelDocente,
  procesarMensajeDeEntrega,
  procesarMensajeDelDocente,
} from './canalesPrivados.js';

describe('nombres de canal', () => {
  it('cada canal lleva la sala y el de devolución, además, el cliente', () => {
    expect(nombreDelCanalDeEntregas('1234')).toBe('debate:entrega:1234');
    expect(nombreDelCanalDelDocente('1234')).toBe('debate:docente:1234');
    expect(nombreDelCanalDeDevolucion('participante-1', '1234')).toBe('debate:devolucion:participante-1:1234');
  });
});

describe('procesarMensajeDeEntrega', () => {
  it('acepta un texto publicado por quien dice ser', () => {
    const registro = procesarMensajeDeEntrega({
      name: EVENTOS_PRIVADOS.ENTREGA_TEXTO,
      clientId: 'ana',
      id: 'm1',
      timestamp: 5,
      data: { participantId: 'ana', texto: 'Mi texto', enviadoPorTiempo: true },
    });
    expect(registro).toMatchObject({ participantId: 'ana', texto: 'Mi texto', enviadoPorTiempo: true, enviadoEn: 5 });
  });

  it('rechaza un texto publicado a nombre de otra persona, vacío o sin clientId', () => {
    const base = { name: EVENTOS_PRIVADOS.ENTREGA_TEXTO, data: { participantId: 'ana', texto: 'Hola' } };
    expect(procesarMensajeDeEntrega({ ...base, clientId: 'beto' })).toBeNull();
    expect(procesarMensajeDeEntrega({ ...base })).toBeNull();
    expect(procesarMensajeDeEntrega({ ...base, clientId: 'ana', data: { participantId: 'ana', texto: '   ' } })).toBeNull();
  });

  it('acota el tamaño del texto', () => {
    const registro = procesarMensajeDeEntrega({
      name: EVENTOS_PRIVADOS.ENTREGA_TEXTO,
      clientId: 'ana',
      data: { participantId: 'ana', texto: 'a'.repeat(MAXIMO_DE_CARACTERES_DE_UNA_ENTREGA + 500) },
    });
    expect(registro.texto).toHaveLength(MAXIMO_DE_CARACTERES_DE_UNA_ENTREGA);
  });

  it('acepta la confirmación con su motivo acotado y normaliza la decisión', () => {
    const registro = procesarMensajeDeEntrega({
      name: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION,
      clientId: 'ana',
      data: { participantId: 'ana', decision: 'en_desacuerdo', motivo: '  No coincide  ' },
    });
    expect(registro).toMatchObject({ decision: 'en_desacuerdo', motivo: 'No coincide' });

    const rara = procesarMensajeDeEntrega({
      name: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION,
      clientId: 'ana',
      data: { participantId: 'ana', decision: 'otra cosa' },
    });
    expect(rara.decision).toBe('de_acuerdo');
  });

  it('ignora nombres de evento desconocidos', () => {
    expect(procesarMensajeDeEntrega({ name: 'otra.cosa', clientId: 'ana', data: { participantId: 'ana' } })).toBeNull();
  });
});

describe('procesarMensajeDelDocente', () => {
  it('solo acepta lo que publicó el host', () => {
    const mensaje = { name: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, data: { participantId: 'ana', niveles: {} } };
    expect(procesarMensajeDelDocente({ ...mensaje, clientId: 'ana' })).toBeNull();
    expect(procesarMensajeDelDocente({ ...mensaje, clientId: 'host' })).toMatchObject({ participantId: 'ana' });
  });

  it('descarta eventos que no son suyos o sin participante', () => {
    expect(procesarMensajeDelDocente({ name: 'otra.cosa', clientId: 'host', data: { participantId: 'ana' } })).toBeNull();
    expect(procesarMensajeDelDocente({ name: EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA, clientId: 'host', data: {} })).toBeNull();
  });
});
