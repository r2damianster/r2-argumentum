import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from '../estado/reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import {
  esOyente,
  oyentes,
  participantesConIngresoConfirmado,
  elegirPosturaMenosRepresentada,
  participantesSinIntervenir,
  seAlcanzoElMinimoDeParticipacion,
  ingresoEstaCerrado,
  analizarBalanceDePosturas,
  verificarCupoDePostura,
} from './reglasDeIngreso.js';

const POSTURAS = [
  { id: 'izquierda', etiqueta: 'Más estado' },
  { id: 'derecha', etiqueta: 'Más mercado' },
];

function reducirTodos(eventos) {
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function conectado(participantId) {
  return { participantId, nombre: participantId, conectado: true };
}

describe('oyentes vs participantes', () => {
  it('quien no confirmó su ingreso es oyente', () => {
    const estado = reducirTodos([evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' })]);

    expect(esOyente(estado, 'ana')).toBe(false);
    expect(esOyente(estado, 'luis')).toBe(true);
  });

  it('separa el roster entre confirmados y oyentes', () => {
    const estado = reducirTodos([evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' })]);
    const presencia = [conectado('ana'), conectado('luis')];

    expect(participantesConIngresoConfirmado(estado, presencia).map((p) => p.participantId)).toEqual(['ana']);
    expect(oyentes(estado, presencia).map((p) => p.participantId)).toEqual(['luis']);
  });

  it('confirmar el ingreso fija la postura del participante', () => {
    const estado = reducirTodos([evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'derecha' })]);

    expect(estado.participantes.ana.stanceId).toBe('derecha');
  });
});

describe('asignación balanceada de posturas', () => {
  it('elige la postura que menos gente está defendiendo', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'marta', stanceId: 'derecha' }),
    ]);

    expect(elegirPosturaMenosRepresentada(estado, POSTURAS)).toBe('derecha');
  });

  it('con la sala vacía cualquiera de las dos es válida', () => {
    const elegida = elegirPosturaMenosRepresentada(estadoInicial(), POSTURAS, { participantId: 'ana' });

    expect(POSTURAS.map((postura) => postura.id)).toContain(elegida);
  });

  it('no cuenta a quien todavía no confirmó su ingreso', () => {
    let estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    ]);
    // Luis tiene postura asignada pero nunca confirmó: no debe desbalancear el conteo.
    estado = reducirEventos(estado, evento(EVENTOS.POSTURA_ASIGNADA, { participantId: 'luis', stanceId: 'derecha' }));

    expect(elegirPosturaMenosRepresentada(estado, POSTURAS)).toBe('derecha');
  });

  it('reparte los bandos aunque todos entren con la sala vacía', () => {
    // Ocho personas abriendo la pantalla a la vez ven el mismo estado inicial: el reparto no
    // puede depender del azar de cada cliente o quedan bandos de 5-2-1 (bug real en prueba).
    const quienes = ['ana', 'luis', 'marta', 'diego', 'sofia', 'carlos', 'valeria', 'jorge'];
    const asignadas = quienes.map((quien) =>
      elegirPosturaMenosRepresentada(estadoInicial(), POSTURAS, {
        participantId: quien,
        participantesEnLaSala: quienes,
      })
    );
    const porPostura = POSTURAS.map(
      (postura) => asignadas.filter((asignada) => asignada === postura.id).length
    );

    expect(Math.max(...porPostura) - Math.min(...porPostura)).toBeLessThanOrEqual(1);
  });

  it('reparte de forma pareja a los participantes no confirmados cuando hay 3 posturas y 2 ya confirmados', () => {
    const TRES_POSTURAS = [
      { id: 'izquierda', etiqueta: 'Más estado' },
      { id: 'matizada', etiqueta: 'Matizada' },
      { id: 'derecha', etiqueta: 'Más mercado' },
    ];
    // Ana (izquierda) y Luis (matizada) ya confirmaron
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'matizada' }),
    ]);

    const quienesOleada2 = ['marta', 'pedro', 'silvia'];
    const todosEnLaSala = ['ana', 'luis', ...quienesOleada2];

    const asignadasOleada2 = quienesOleada2.map((quien) =>
      elegirPosturaMenosRepresentada(estado, TRES_POSTURAS, {
        participantId: quien,
        participantesEnLaSala: todosEnLaSala,
      })
    );

    // Con el algoritmo previo, Marta, Pedro y Silvia obtenían todas 'derecha' (1/1/3).
    // Con la distribución virtual, cada una recibe una postura diferente (2/2/1).
    const conteosTotales = TRES_POSTURAS.map((p) => {
      const confirmados = p.id === 'izquierda' || p.id === 'matizada' ? 1 : 0;
      const asignadosNuevos = asignadasOleada2.filter((a) => a === p.id).length;
      return confirmados + asignadosNuevos;
    });

    expect(Math.max(...conteosTotales) - Math.min(...conteosTotales)).toBeLessThanOrEqual(1);
  });

  it('devuelve null si el Programa no tiene posturas activas', () => {
    expect(elegirPosturaMenosRepresentada(estadoInicial(), [])).toBeNull();
  });
});

describe('mínimo de participación: todos al menos una vez', () => {
  const presencia = [conectado('ana'), conectado('luis')];

  it('cuenta como intervención un argumento publicado', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(participantesSinIntervenir(estado, presencia)).toEqual(['luis']);
    expect(seAlcanzoElMinimoDeParticipacion(estado, presencia)).toBe(false);
  });

  it('se alcanza el mínimo cuando ya intervinieron todos', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a2', participantId: 'luis', posicionEnRonda: 1, ronda: 1 }),
    ]);

    expect(seAlcanzoElMinimoDeParticipacion(estado, presencia)).toBe(true);
  });

  it('los co-moderadores no cuentan para el mínimo: no argumentan', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['luis'], totalParticipantes: 2 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
    ]);

    expect(seAlcanzoElMinimoDeParticipacion(estado, presencia)).toBe(true);
  });

  it('los oyentes tampoco cuentan: nunca entraron al debate', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, { argumentId: 'a1', participantId: 'ana', posicionEnRonda: 1, ronda: 1 }),
    ]);

    expect(seAlcanzoElMinimoDeParticipacion(estado, presencia)).toBe(true);
  });
});

describe('cierre del ingreso', () => {
  it('el ingreso se cierra cuando arranca la primera fase', () => {
    const antes = estadoInicial();
    const despues = reducirEventos(antes, evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos' }));

    expect(ingresoEstaCerrado(antes)).toBe(false);
    expect(ingresoEstaCerrado(despues)).toBe(true);
  });
});

describe('analizarBalanceDePosturas', () => {
  it('detecta desbalance monopostura cuando todos están en una misma postura', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'marta', stanceId: 'izquierda' }),
    ]);
    const presencia = [conectado('ana'), conectado('luis'), conectado('marta')];

    const analisis = analizarBalanceDePosturas(estado, presencia, POSTURAS);
    expect(analisis.hayDesbalanceExtremo).toBe(true);
    expect(analisis.posturaDominanteId).toBe('izquierda');
    expect(analisis.totalConfirmados).toBe(3);
  });

  it('no marca desbalance si hay al menos dos posturas representadas', () => {
    const estado = reducirTodos([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    ]);
    const presencia = [conectado('ana'), conectado('luis')];

    const analisis = analizarBalanceDePosturas(estado, presencia, POSTURAS);
    expect(analisis.hayDesbalanceExtremo).toBe(false);
  });
});

describe('cupo de postura al confirmar (solo asignación aleatoria)', () => {
  const TRES_POSTURAS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const confirmados = (asignaciones) =>
    reducirTodos(asignaciones.map(([participantId, stanceId]) => evento(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId })));

  it('permite la postura mientras no llene su cupo', () => {
    const estado = confirmados([['p1', 'a'], ['p2', 'b']]);
    const resultado = verificarCupoDePostura(estado, TRES_POSTURAS, 'c', {
      participantId: 'p3',
      participantesEnLaSala: ['p1', 'p2', 'p3'],
    });

    expect(resultado).toMatchObject({ permitida: true, cupo: 1 });
  });

  it('con 8 personas y 3 posturas el cupo es 3: la cuarta persona de una postura no pasa', () => {
    const estado = confirmados([['p1', 'b'], ['p2', 'b'], ['p3', 'b'], ['p4', 'a'], ['p5', 'c'], ['p6', 'c'], ['p7', 'a']]);
    const sala = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const resultado = verificarCupoDePostura(estado, TRES_POSTURAS, 'b', { participantId: 'p8', participantesEnLaSala: sala });

    expect(resultado.permitida).toBe(false);
    expect(resultado.cupo).toBe(3);
    // 'a' y 'c' tienen 2 cada una: la sugerida es una de las menos representadas, nunca 'b'.
    expect(['a', 'c']).toContain(resultado.posturaSugerida);
  });

  it('el reparto 1/3/4 de la prueba en vivo ya no es posible: la cuarta de mercado se desvía a la que tiene una', () => {
    const estado = confirmados([['p1', 'a'], ['p2', 'b'], ['p3', 'b'], ['p4', 'c'], ['p5', 'c'], ['p6', 'c'], ['p7', 'b']]);
    const sala = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const resultado = verificarCupoDePostura(estado, TRES_POSTURAS, 'c', { participantId: 'p8', participantesEnLaSala: sala });

    expect(resultado).toMatchObject({ permitida: false, posturaSugerida: 'a' });
  });

  it('no cuenta a la propia persona si ya figuraba en la postura', () => {
    const estado = confirmados([['p1', 'a'], ['p2', 'b']]);
    const resultado = verificarCupoDePostura(estado, TRES_POSTURAS, 'a', {
      participantId: 'p1',
      participantesEnLaSala: ['p1', 'p2', 'p3'],
    });

    expect(resultado.permitida).toBe(true);
  });

  it('una postura que no está en la lista (propuesta nueva) no se bloquea', () => {
    const estado = confirmados([['p1', 'a']]);
    const resultado = verificarCupoDePostura(estado, TRES_POSTURAS, 'nueva', { participantId: 'p2', participantesEnLaSala: ['p1', 'p2'] });

    expect(resultado.permitida).toBe(true);
  });
});
