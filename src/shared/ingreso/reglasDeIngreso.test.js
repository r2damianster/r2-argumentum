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
    const elegida = elegirPosturaMenosRepresentada(estadoInicial(), POSTURAS, () => 0);

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
