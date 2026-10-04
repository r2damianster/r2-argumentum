import { describe, expect, it } from 'vitest';
import { agruparSenalesPorParticipante, procesarMensajeDeIntegridad } from './canalPrivado.js';

const CARGA = {
  participantId: 'ana',
  argumentId: 'a1',
  contexto: 'foro',
  senales: [{ tipo: 'pegado', gravedad: 'alta', detalle: 'Pegó 412 caracteres' }],
  gravedadMaxima: 'alta',
  estadisticas: { pegadoCaracteres: 412 },
  advertenciaMostrada: true,
};

function mensaje(extra = {}) {
  return { id: 'm1', clientId: 'ana', timestamp: 1000, data: { ...CARGA }, ...extra };
}

describe('procesarMensajeDeIntegridad', () => {
  it('acepta un mensaje publicado por quien dice ser', () => {
    const registro = procesarMensajeDeIntegridad(mensaje());
    expect(registro).toMatchObject({
      participantId: 'ana',
      argumentId: 'a1',
      contexto: 'foro',
      gravedadMaxima: 'alta',
      advertenciaMostrada: true,
      enviadoEn: 1000,
    });
    expect(registro.senales[0].detalle).toBe('Pegó 412 caracteres');
  });

  it('rechaza una marca publicada a nombre de otra persona: nadie puede acusar a otro', () => {
    expect(procesarMensajeDeIntegridad(mensaje({ clientId: 'luis' }))).toBeNull();
  });

  it('rechaza un mensaje sin identidad del emisor', () => {
    expect(procesarMensajeDeIntegridad(mensaje({ clientId: undefined }))).toBeNull();
  });

  it('rechaza mensajes con forma inválida', () => {
    expect(procesarMensajeDeIntegridad(null)).toBeNull();
    expect(procesarMensajeDeIntegridad(mensaje({ data: 'texto' }))).toBeNull();
    expect(procesarMensajeDeIntegridad(mensaje({ data: { ...CARGA, senales: [] } }))).toBeNull();
    expect(procesarMensajeDeIntegridad(mensaje({ data: { ...CARGA, senales: 'x' } }))).toBeNull();
  });

  it('descarta señales con gravedad inventada y acota el tamaño de los textos', () => {
    const registro = procesarMensajeDeIntegridad(
      mensaje({
        data: {
          ...CARGA,
          senales: [
            { tipo: 'pegado', gravedad: 'apocaliptica', detalle: 'x' },
            { tipo: 'pegado', gravedad: 'media', detalle: 'y'.repeat(5000) },
          ],
        },
      })
    );
    expect(registro.senales).toHaveLength(1);
    expect(registro.senales[0].detalle).toHaveLength(300);
  });

  it('acota la cantidad de señales por mensaje', () => {
    const muchas = Array.from({ length: 50 }, () => ({ tipo: 'pegado', gravedad: 'baja', detalle: 'x' }));
    expect(procesarMensajeDeIntegridad(mensaje({ data: { ...CARGA, senales: muchas } })).senales).toHaveLength(10);
  });

  it('un contexto desconocido queda en null', () => {
    expect(procesarMensajeDeIntegridad(mensaje({ data: { ...CARGA, contexto: 'hackeo' } })).contexto).toBeNull();
  });
});

describe('agruparSenalesPorParticipante', () => {
  const registro = (participantId, gravedadMaxima, enviadoEn) => ({ participantId, gravedadMaxima, enviadoEn });

  it('agrupa por persona, con la más grave primero y lo más reciente primero dentro de cada una', () => {
    const grupos = agruparSenalesPorParticipante([
      registro('luis', 'baja', 5),
      registro('ana', 'media', 1),
      registro('ana', 'alta', 3),
      registro('marta', 'media', 2),
    ]);
    expect(grupos.map((grupo) => [grupo.participantId, grupo.gravedadMaxima])).toEqual([
      ['ana', 'alta'],
      ['marta', 'media'],
      ['luis', 'baja'],
    ]);
    expect(grupos[0].registros.map((item) => item.enviadoEn)).toEqual([3, 1]);
  });

  it('sin registros no hay grupos', () => {
    expect(agruparSenalesPorParticipante([])).toEqual([]);
  });
});

describe('proporción penalizada del mensaje de integridad', () => {
  const base = { id: 'm1', clientId: 'ana', timestamp: 1, data: { participantId: 'ana', contexto: 'entrega_de_lectura', senales: [{ tipo: 'pegado', gravedad: 'alta', detalle: 'x' }] } };

  it('la toma de las estadísticas y la acota entre 0 y 1', () => {
    expect(procesarMensajeDeIntegridad({ ...base, data: { ...base.data, estadisticas: { proporcionPenalizada: 0.42 } } }).proporcionPenalizada).toBe(0.42);
    expect(procesarMensajeDeIntegridad({ ...base, data: { ...base.data, estadisticas: { proporcionPenalizada: 7 } } }).proporcionPenalizada).toBe(1);
    expect(procesarMensajeDeIntegridad({ ...base, data: { ...base.data, estadisticas: { proporcionPenalizada: -3 } } }).proporcionPenalizada).toBe(0);
  });

  it('sin el dato o con basura vale 0', () => {
    expect(procesarMensajeDeIntegridad(base).proporcionPenalizada).toBe(0);
    expect(procesarMensajeDeIntegridad({ ...base, data: { ...base.data, estadisticas: { proporcionPenalizada: 'mucho' } } }).proporcionPenalizada).toBe(0);
  });
});
