import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { DECISIONES_DE_CONFIRMACION, EVENTOS, TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { PERFILES_DE_AHORRO } from '../capacidad/modosDeAhorro.js';
import { MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS } from './estadoPublicoDeEntregas.js';
import { estadoPrivadoInicial } from './estadoPrivadoDelDocente.js';
import {
  INTERVALO_ENTRE_AVISOS_EN_LOTE_MS,
  calcularAnunciosPorHacer,
  clavesDeLosAnuncios,
  contarAnunciosPorHacer,
  esperaParaElProximoAviso,
  laEntregaLlegoATiempo,
  laRevisionLlegoATiempo,
} from './anunciosEnLote.js';

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

const lote = (extra) => ({ timestamp: 9000, ...extra });

describe('el host anuncia las entregas en lote (reducer)', () => {
  it('registra varias entregas de un solo evento, con sus conteos y sin texto', () => {
    const estado = aplicar(
      sala('ana', 'beto'),
      EVENTOS.LECTURA_ENTREGAS_REGISTRADAS,
      lote({
        entregas: [
          { participantId: 'ana', palabras: 80, parrafos: 2, entregadaEn: 5000, texto: 'no debería guardarse' },
          { participantId: 'beto', palabras: 40, parrafos: 1, enviadoPorTiempo: true, entregadaEn: 6000 },
        ],
      }),
      'host'
    );
    expect(Object.keys(estado.lectura.entregas).sort()).toEqual(['ana', 'beto']);
    expect(estado.lectura.entregas.ana).toMatchObject({ palabras: 80, parrafos: 2, entregadaEn: 5000, enviadaPorTiempo: false });
    expect(estado.lectura.entregas.beto.enviadaPorTiempo).toBe(true);
    expect(JSON.stringify(estado.lectura)).not.toContain('no debería guardarse');
  });

  it('solo vale si lo publica el host: un participante no puede anunciar entregas ajenas', () => {
    const estado = aplicar(sala('ana', 'beto'), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'beto', palabras: 5, parrafos: 1 }] }), 'ana');
    expect(estado.lectura?.entregas ?? {}).toEqual({});
  });

  it('ignora a quien no ingresó, al host, los repetidos y lo que ya estaba entregado', () => {
    let estado = aplicar(sala('ana'), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(
      estado,
      EVENTOS.LECTURA_ENTREGAS_REGISTRADAS,
      lote({
        entregas: [
          { participantId: 'ana', palabras: 999, parrafos: 9 },
          { participantId: 'intruso', palabras: 5, parrafos: 1 },
          { participantId: 'host', palabras: 5, parrafos: 1 },
        ],
      }),
      'host'
    );
    expect(Object.keys(estado.lectura.entregas)).toEqual(['ana']);
    expect(estado.lectura.entregas.ana.palabras).toBe(50);
  });

  it('un lote repetido no cambia nada y un evento mal formado se ignora', () => {
    const una = aplicar(sala('ana'), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 10, parrafos: 1 }] }), 'host');
    expect(aplicar(una, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 99, parrafos: 1 }] }), 'host').lectura).toEqual(una.lectura);
    expect(aplicar(una, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, { entregas: 'no es una lista' }, 'host').lectura).toEqual(una.lectura);
  });
});

describe('devoluciones, respuestas y revisiones en lote (reducer)', () => {
  const conEntrega = (...nombres) =>
    aplicar(sala(...nombres), EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: nombres.map((participantId) => ({ participantId, palabras: 10, parrafos: 1 })) }), 'host');

  it('el host devuelve a varias personas de un solo aviso, igual que con el aviso suelto', () => {
    const estado = aplicar(
      conEntrega('ana', 'beto'),
      EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS,
      lote({ devoluciones: [{ participantId: 'ana', hasta: 99999, devueltaEn: 8000 }, { participantId: 'beto', hasta: 88888, revisada: false, devueltaEn: 8100 }] }),
      'host'
    );
    expect(estado.lectura.entregas.ana).toMatchObject({ devueltaEn: 8000, confirmaHasta: 99999 });
    expect(estado.lectura.entregas.beto.devueltaEn).toBe(8100);
  });

  it('una devolución revisada no reabre la ventana pero queda marcada', () => {
    let estado = aplicar(conEntrega('ana'), EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, lote({ devoluciones: [{ participantId: 'ana', hasta: 99999, devueltaEn: 8000 }] }), 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, lote({ devoluciones: [{ participantId: 'ana', hasta: 11111, revisada: true, devueltaEn: 9500 }] }), 'host');
    expect(estado.lectura.entregas.ana).toMatchObject({ devueltaEn: 8000, confirmaHasta: 99999, devolucionRevisada: true });
  });

  it('las respuestas y las confirmaciones automáticas entran en lote, y la primera de cada persona es la que vale', () => {
    let estado = aplicar(conEntrega('ana', 'beto'), EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, lote({ devoluciones: [{ participantId: 'ana', hasta: 99999 }, { participantId: 'beto', hasta: 99999 }] }), 'host');
    estado = aplicar(
      estado,
      EVENTOS.LECTURA_CONFIRMACIONES_REGISTRADAS,
      lote({
        confirmaciones: [
          { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.DE_ACUERDO, confirmadaEn: 8500 },
          { participantId: 'beto', decision: DECISIONES_DE_CONFIRMACION.AUTOMATICA },
          { participantId: 'beto', decision: DECISIONES_DE_CONFIRMACION.EN_DESACUERDO },
          { participantId: 'ana', decision: 'inventada' },
        ],
      }),
      'host'
    );
    expect(estado.lectura.entregas.ana.confirmacion).toMatchObject({ decision: 'de_acuerdo', confirmadaEn: 8500 });
    expect(estado.lectura.entregas.beto.confirmacion.decision).toBe('automatica');
  });

  it('no se confirma lo que todavía no se devolvió', () => {
    const estado = aplicar(conEntrega('ana'), EVENTOS.LECTURA_CONFIRMACIONES_REGISTRADAS, lote({ confirmaciones: [{ participantId: 'ana', decision: 'de_acuerdo' }] }), 'host');
    expect(estado.lectura.entregas.ana.confirmacion).toBeNull();
  });

  it('las revisiones enviadas entran en lote, solo de quien entregó y con un índice válido', () => {
    const estado = aplicar(
      conEntrega('ana', 'beto'),
      EVENTOS.LECTURA_REVISIONES_REGISTRADAS,
      lote({ revisiones: [{ participantId: 'ana', indice: 0, enviadaEn: 7000 }, { participantId: 'ana', indice: 1 }, { participantId: 'beto', indice: 99 }, { participantId: 'intruso', indice: 0 }] }),
      'host'
    );
    expect(Object.keys(estado.lectura.revisiones.ana)).toEqual(['0', '1']);
    expect(estado.lectura.revisiones.ana[0].enviadaEn).toBe(7000);
    expect(estado.lectura.revisiones.beto).toBeUndefined();
    expect(estado.lectura.revisiones.intruso).toBeUndefined();
  });

  it('ninguno de los lotes vale si no lo publica el host', () => {
    const base = conEntrega('ana');
    for (const [nombre, carga] of [
      [EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, { devoluciones: [{ participantId: 'ana', hasta: 99999 }] }],
      [EVENTOS.LECTURA_CONFIRMACIONES_REGISTRADAS, { confirmaciones: [{ participantId: 'ana', decision: 'de_acuerdo' }] }],
      [EVENTOS.LECTURA_REVISIONES_REGISTRADAS, { revisiones: [{ participantId: 'ana', indice: 0 }] }],
    ]) {
      expect(aplicar(base, nombre, lote(carga), 'ana').lectura).toEqual(base.lectura);
    }
  });

  it('el aviso suelto sigue funcionando (modo de sala pequeña)', () => {
    let estado = aplicar(conEntrega('ana'), EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 99999, timestamp: 8000 }, 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: 'de_acuerdo', timestamp: 8500 }, 'ana');
    expect(estado.lectura.entregas.ana.confirmacion.decision).toBe('de_acuerdo');
    estado = aplicar(estado, EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.REVISION_DE_PARES, duracionMin: 5, timestamp: 9000 }, 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_REVISION_ENVIADA, { participantId: 'ana', indice: 0, timestamp: 9100 }, 'ana');
    expect(estado.lectura.revisiones.ana[0].enviadaEn).toBe(9100);
  });
});

describe('ingresos en lote (modo masivo)', () => {
  const ingresos = (...ids) => ({ ingresos: ids.map((participantId) => ({ participantId, nombre: `N-${participantId}`, emoji: '🐼' })) });

  it('el host anuncia varios ingresos de una vez y quedan como cualquier ingreso confirmado', () => {
    const estado = aplicar(estadoInicial(), EVENTOS.INGRESOS_REGISTRADOS, ingresos('ana', 'beto'), 'host');
    expect(estado.participantes.ana).toMatchObject({ ingresoConfirmado: true, nombre: 'N-ana', emoji: '🐼' });
    expect(estado.participantes.beto.ingresoConfirmado).toBe(true);
  });

  it('un participante no puede anunciar ingresos y el host no entra como participante', () => {
    expect(Object.keys(aplicar(estadoInicial(), EVENTOS.INGRESOS_REGISTRADOS, ingresos('beto'), 'ana').participantes)).toEqual([]);
    expect(Object.keys(aplicar(estadoInicial(), EVENTOS.INGRESOS_REGISTRADOS, ingresos('host', ''), 'host').participantes)).toEqual([]);
  });

  it('una entrega anunciada después de su ingreso en lote es válida', () => {
    let estado = aplicar(estadoInicial(), EVENTOS.INGRESOS_REGISTRADOS, ingresos('ana'), 'host');
    estado = aplicar(estado, EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 }, 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 3, parrafos: 1 }] }), 'host');
    expect(estado.lectura.entregas.ana.palabras).toBe(3);
  });
});

describe('laEntregaLlegoATiempo', () => {
  const cerrada = (cerradaEn) => ({ fase: { actual: null, historial: [{ tipo: TIPOS_DE_FASE.CONTROL_DE_LECTURA, cerradaEn }] } });

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

describe('laRevisionLlegoATiempo', () => {
  it('durante la fase de revisión, o ya cerrada si se envió mientras estaba abierta', () => {
    const abierta = { fase: { actual: { tipo: TIPOS_DE_FASE.REVISION_DE_PARES }, historial: [] } };
    const cerrada = { fase: { actual: null, historial: [{ tipo: TIPOS_DE_FASE.REVISION_DE_PARES, cerradaEn: 5000 }] } };
    expect(laRevisionLlegoATiempo(abierta, { enviadoEn: 1 })).toBe(true);
    expect(laRevisionLlegoATiempo(cerrada, { enviadoEn: 4000 })).toBe(true);
    expect(laRevisionLlegoATiempo(cerrada, { enviadoEn: 6000 })).toBe(false);
    expect(laRevisionLlegoATiempo({ fase: { actual: null, historial: [] } }, { enviadoEn: 1 })).toBe(false);
  });
});

describe('calcularAnunciosPorHacer', () => {
  const textoRecibido = (extra = {}) => ({ texto: 'x', palabras: 80, parrafos: 2, enviadoPorTiempo: false, enviadoEn: 5000, ...extra });
  const privado = (extra) => ({ ...estadoPrivadoInicial(), ...extra });

  it('con el perfil de sala pequeña no anuncia nada: cada persona avisa lo suyo', () => {
    const anuncios = calcularAnunciosPorHacer({ estado: sala('ana'), estadoPrivado: privado({ textos: { ana: textoRecibido() } }), perfil: PERFILES_DE_AHORRO.pequena });
    expect(contarAnunciosPorHacer(anuncios)).toBe(0);
  });

  it('moderada: solo las entregas, en orden de llegada y sin el texto', () => {
    const estadoPrivado = privado({
      textos: { beto: textoRecibido({ enviadoEn: 7000 }), ana: textoRecibido({ enviadoEn: 6000, palabras: 30 }) },
      confirmaciones: { ana: { decision: 'de_acuerdo', enviadoEn: 1 } },
    });
    const anuncios = calcularAnunciosPorHacer({ estado: sala('ana', 'beto', 'carla'), estadoPrivado, perfil: PERFILES_DE_AHORRO.moderada });
    expect(anuncios.entregas.map((entrega) => entrega.participantId)).toEqual(['ana', 'beto']);
    expect(anuncios.entregas[0]).toEqual({ participantId: 'ana', palabras: 30, parrafos: 2, enviadoPorTiempo: false, entregadaEn: 6000 });
    expect(JSON.stringify(anuncios)).not.toContain('"texto"');
    expect(anuncios.confirmaciones).toEqual([]);
  });

  it('no repite lo ya anunciado, ni lo que ya está en la sala, ni a quien no ingresó, ni lo que llegó fuera de tiempo', () => {
    let estado = sala('ana', 'beto');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 1, parrafos: 1 }] }), 'host');
    const estadoPrivado = privado({ textos: { ana: textoRecibido(), beto: textoRecibido(), intruso: textoRecibido() } });
    const perfil = PERFILES_DE_AHORRO.moderada;
    expect(calcularAnunciosPorHacer({ estado, estadoPrivado, perfil }).entregas.map((entrega) => entrega.participantId)).toEqual(['beto']);
    expect(calcularAnunciosPorHacer({ estado, estadoPrivado, perfil, yaAnunciados: new Set(['entrega:beto']) }).entregas).toEqual([]);

    const cerrado = aplicar(sala('ana'), EVENTOS.FASE_CERRADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, timestamp: 100000 }, 'host');
    expect(calcularAnunciosPorHacer({ estado: cerrado, estadoPrivado: privado({ textos: { ana: textoRecibido({ enviadoEn: 150000 }) } }), perfil }).entregas).toEqual([]);
  });

  it('ahorro: además anuncia devoluciones, respuestas y revisiones, cuando la entrega ya está en la sala', () => {
    let estado = sala('ana', 'beto');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 1, parrafos: 1 }, { participantId: 'beto', palabras: 1, parrafos: 1 }] }), 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, lote({ devoluciones: [{ participantId: 'beto', hasta: 99999 }] }), 'host');
    estado = aplicar(estado, EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.REVISION_DE_PARES, duracionMin: 5, timestamp: 9000 }, 'host');
    const estadoPrivado = privado({
      textos: { ana: textoRecibido(), beto: textoRecibido() },
      devoluciones: { ana: { devueltaEn: 8000, hasta: 70000, revisada: false }, beto: { devueltaEn: 8100, hasta: 99999, revisada: false } },
      confirmaciones: { beto: { decision: 'de_acuerdo', enviadoEn: 8500 }, ana: { decision: 'de_acuerdo', enviadoEn: 8600 } },
      revisionesEnviadas: { ana: { 0: { enviadoEn: 9100 } } },
    });
    const anuncios = calcularAnunciosPorHacer({ estado, estadoPrivado, perfil: PERFILES_DE_AHORRO.ahorro });
    expect(anuncios.devoluciones).toEqual([{ participantId: 'ana', hasta: 70000, revisada: false, devueltaEn: 8000 }]);
    // ana todavía no tiene la devolución en la sala, así que su respuesta espera al siguiente lote; beto sí.
    expect(anuncios.confirmaciones).toEqual([{ participantId: 'beto', decision: 'de_acuerdo', confirmadaEn: 8500 }]);
    expect(anuncios.revisiones).toEqual([{ participantId: 'ana', indice: 0, enviadaEn: 9100 }]);
  });

  it('una devolución revisada tras un desacuerdo también se anuncia', () => {
    let estado = sala('ana');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, lote({ entregas: [{ participantId: 'ana', palabras: 1, parrafos: 1 }] }), 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, lote({ devoluciones: [{ participantId: 'ana', hasta: 99999, devueltaEn: 8000 }] }), 'host');
    const estadoPrivado = privado({ textos: { ana: textoRecibido() }, devoluciones: { ana: { devueltaEn: 8000, hasta: 99999, revisada: true } } });
    const anuncios = calcularAnunciosPorHacer({ estado, estadoPrivado, perfil: PERFILES_DE_AHORRO.ahorro });
    expect(anuncios.devoluciones.map((devolucion) => devolucion.revisada)).toEqual([true]);
  });

  it('masivo: el ingreso privado se anuncia primero y deja anunciar la entrega en el mismo lote', () => {
    const estadoPrivado = privado({
      ingresos: { ana: { nombre: 'Ana', emoji: '🦊', enviadoEn: 2000 } },
      textos: { ana: textoRecibido() },
    });
    const estado = aplicar(estadoInicial(), EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 }, 'host');
    const anuncios = calcularAnunciosPorHacer({ estado, estadoPrivado, perfil: PERFILES_DE_AHORRO.masivo });
    expect(anuncios.ingresos).toEqual([{ participantId: 'ana', nombre: 'Ana', emoji: '🦊', enviadoEn: 2000 }]);
    expect(anuncios.entregas.map((entrega) => entrega.participantId)).toEqual(['ana']);
    // En otros modos el ingreso privado no existe: no se anuncia.
    expect(calcularAnunciosPorHacer({ estado, estadoPrivado, perfil: PERFILES_DE_AHORRO.ahorro }).ingresos).toEqual([]);
  });

  it('las claves de lo anunciado coinciden con lo que se filtra la próxima vez', () => {
    const estadoPrivado = privado({ ingresos: { ana: { nombre: 'Ana', emoji: '🦊', enviadoEn: 2000 } }, textos: { ana: textoRecibido() } });
    const estado = aplicar(estadoInicial(), EVENTOS.FASE_INICIADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 }, 'host');
    const perfil = PERFILES_DE_AHORRO.masivo;
    const primeros = calcularAnunciosPorHacer({ estado, estadoPrivado, perfil });
    const yaAnunciados = new Set(clavesDeLosAnuncios(primeros));
    expect(contarAnunciosPorHacer(calcularAnunciosPorHacer({ estado, estadoPrivado, perfil, yaAnunciados }))).toBe(0);
  });
});

describe('esperaParaElProximoAviso', () => {
  it('el primer aviso sale enseguida y los siguientes respetan el intervalo', () => {
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 0, ahora: 1_000_000 })).toBe(0);
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 1_000_000, ahora: 1_000_000 + 1000 })).toBe(INTERVALO_ENTRE_AVISOS_EN_LOTE_MS - 1000);
    expect(esperaParaElProximoAviso({ ultimoAvisoEn: 1_000_000, ahora: 1_000_000 + INTERVALO_ENTRE_AVISOS_EN_LOTE_MS })).toBe(0);
  });
});
