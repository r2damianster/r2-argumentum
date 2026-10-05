import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { EVENTOS, TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS } from './estadoPublicoDeEntregas.js';
import {
  INTERVALO_ENTRE_AVISOS_DE_ENTREGAS_MS,
  calcularEntregasPorAnunciar,
  esperaParaElProximoAviso,
  laEntregaLlegoATiempo,
} from './entregasAgrupadas.js';

function aplicar(estado, name, data, clientId) {
  return reducirEventos(estado, { name, data, ...(clientId ? { clientId } : {}) });
}

function sala(...nombres) {
  let estado = estadoInicial();
  for (const participantId of nombres) {
    estado = aplicar(estado, EVENTOS.INGRESO_CONFIRMADO, { participantId, nombre: participantId, emoji: '🦊' }, participantId);
  }
  return aplicar(estado, EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 }, 'host');
}

const textoRecibido = (extra = {}) => ({ texto: 'x', palabras: 80, parrafos: 2, enviadoPorTiempo: false, enviadoEn: 5000, ...extra });

describe('el host anuncia las entregas en lote (reducer)', () => {
  const lote = (entregas) => ({ entregas, timestamp: 9000 });

  it('registra varias entregas de un solo evento, con sus conteos y sin texto', () => {
    const estado = aplicar(
      sala('ana', 'beto'),
      EVENTOS.LECTURA_ENTREGAS_REGISTRADAS,
      lote([
        { participantId: 'ana', palabras: 80, parrafos: 2, entregadaEn: 5000, texto: 'no debería guardarse' },
        { participantId: 'beto', palabras: 40, parrafos: 1, enviadoPorTiempo: true, entregadaEn: 6000 },
      ]),
      'host'
    );
    expect(Object.keys(estado.lectura.entregas).sort()).toEqual(['ana', 'beto']);
    expect(estado.lectura.entregas.ana).toMatchObject({ palabras: 80, parrafos: 2, entregadaEn: 5000, enviadaPorTiempo: false });
    expect(estado.lectura.entregas.beto.enviadaPorTiempo).toBe(true);
    expect(JSON.stringify(estado.lectura)).not.toContain('no debería guardarse');
  });

  it('solo vale si lo publica el host: un participante no puede anunciar entregas ajenas', () => {
    const estado = aplicar(sala('ana', 'beto'), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote([{ participantId: 'beto', palabras: 5, parrafos: 1 }]), 'ana');
    expect(estado.lectura?.entregas ?? {}).toEqual({});
  });

  it('ignora a quien no ingresó, al host, los repetidos y lo que ya estaba entregado', () => {
    let estado = aplicar(sala('ana'), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(
      estado,
      EVENTOS.LECTURA_ENTREGAS_REGISTRADAS,
      lote([
        { participantId: 'ana', palabras: 999, parrafos: 9 },
        { participantId: 'intruso', palabras: 5, parrafos: 1 },
        { participantId: 'host', palabras: 5, parrafos: 1 },
      ]),
      'host'
    );
    expect(Object.keys(estado.lectura.entregas)).toEqual(['ana']);
    expect(estado.lectura.entregas.ana.palabras).toBe(50);
  });

  it('un lote repetido no cambia nada y un evento mal formado se ignora', () => {
    const una = aplicar(sala('ana'), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote([{ participantId: 'ana', palabras: 10, parrafos: 1 }]), 'host');
    expect(aplicar(una, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote([{ participantId: 'ana', palabras: 99, parrafos: 1 }]), 'host').lectura).toEqual(una.lectura);
    expect(aplicar(una, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, { entregas: 'no es una lista' }, 'host').lectura).toEqual(una.lectura);
  });

  it('una entrega anunciada en lote se puede devolver igual que una suelta', () => {
    let estado = aplicar(sala('ana'), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote([{ participantId: 'ana', palabras: 10, parrafos: 1 }]), 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 99999, timestamp: 8000 }, 'host');
    expect(estado.lectura.entregas.ana.devueltaEn).toBe(8000);
  });
});

describe('laEntregaLlegoATiempo', () => {
  const cerrada = (cerradaEn) => ({
    fase: { actual: null, historial: [{ tipo: TIPOS_DE_FASE.CONTROL_DE_LECTURA, cerradaEn }] },
  });

  it('con la escritura abierta siempre llega a tiempo', () => {
    expect(laEntregaLlegoATiempo(sala('ana'), { enviadoEn: 1, enviadoPorTiempo: false })).toBe(true);
  });

  it('cerrada: vale lo enviado mientras estaba abierta, aunque el host lo anuncie después', () => {
    expect(laEntregaLlegoATiempo(cerrada(100000), { enviadoEn: 99000, enviadoPorTiempo: false })).toBe(true);
  });

  it('cerrada: una entrega normal posterior no entra; la «por tiempo» entra dentro del margen', () => {
    expect(laEntregaLlegoATiempo(cerrada(100000), { enviadoEn: 101000, enviadoPorTiempo: false })).toBe(false);
    expect(laEntregaLlegoATiempo(cerrada(100000), { enviadoEn: 101000, enviadoPorTiempo: true })).toBe(true);
    expect(laEntregaLlegoATiempo(cerrada(100000), { enviadoEn: 100000 + MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS + 1, enviadoPorTiempo: true })).toBe(false);
  });

  it('sin ninguna fase de escritura no entra nada', () => {
    expect(laEntregaLlegoATiempo({ fase: { actual: null, historial: [] } }, { enviadoEn: 1, enviadoPorTiempo: true })).toBe(false);
  });
});

describe('calcularEntregasPorAnunciar', () => {
  it('lista, en orden de llegada, las entregas con texto que la sala aún no conoce', () => {
    const estado = sala('ana', 'beto', 'carla');
    const estadoPrivado = {
      textos: { beto: textoRecibido({ enviadoEn: 7000 }), ana: textoRecibido({ enviadoEn: 6000, palabras: 30 }) },
    };
    const lista = calcularEntregasPorAnunciar({ estado, estadoPrivado });
    expect(lista.map((entrega) => entrega.participantId)).toEqual(['ana', 'beto']);
    expect(lista[0]).toEqual({ participantId: 'ana', palabras: 30, parrafos: 2, enviadoPorTiempo: false, entregadaEn: 6000 });
    expect(JSON.stringify(lista)).not.toContain('"texto"');
  });

  it('no repite lo ya anunciado, ni lo que ya está en la sala, ni a quien no ingresó', () => {
    let estado = sala('ana', 'beto');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, { entregas: [{ participantId: 'ana', palabras: 1, parrafos: 1 }] }, 'host');
    const estadoPrivado = { textos: { ana: textoRecibido(), beto: textoRecibido(), intruso: textoRecibido() } };
    expect(calcularEntregasPorAnunciar({ estado, estadoPrivado }).map((entrega) => entrega.participantId)).toEqual(['beto']);
    expect(calcularEntregasPorAnunciar({ estado, estadoPrivado, yaAnunciadas: new Set(['beto']) })).toEqual([]);
  });

  it('una entrega que llegó fuera de tiempo no se anuncia nunca', () => {
    let estado = sala('ana');
    estado = aplicar(estado, EVENTOS.FASE_CERRADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, timestamp: 100000 }, 'host');
    const estadoPrivado = { textos: { ana: textoRecibido({ enviadoEn: 150000 }) } };
    expect(calcularEntregasPorAnunciar({ estado, estadoPrivado })).toEqual([]);
  });
});

describe('esperaParaElProximoAviso', () => {
  it('el primer aviso sale enseguida y los siguientes respetan el intervalo', () => {
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 0, ahora: 1_000_000 })).toBe(0);
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 1_000_000, ahora: 1_000_000 + 1000 })).toBe(INTERVALO_ENTRE_AVISOS_DE_ENTREGAS_MS - 1000);
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 1_000_000, ahora: 1_000_000 + INTERVALO_ENTRE_AVISOS_DE_ENTREGAS_MS })).toBe(0);
  });
});
