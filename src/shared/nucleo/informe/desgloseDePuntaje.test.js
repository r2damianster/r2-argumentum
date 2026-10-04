import { describe, expect, it } from 'vitest';
import { EVENTOS } from '../../eventos/nombresDeEventos.js';
import {
  TIPOS_DE_MOVIMIENTO,
  calcularDesgloseDePuntaje,
  clasificarMovimientoDePuntaje,
} from './desgloseDePuntaje.js';

const puntaje = (participantId, delta, motivo, categoria, nuevoTotal) => ({
  name: EVENTOS.PUNTAJE_ACTUALIZADO,
  data: { participantId, delta, motivo, categoria, nuevoTotal },
});

describe('clasificarMovimientoDePuntaje', () => {
  it('reconoce los motivos que escriben el motor y las actividades', () => {
    const clasificar = (motivo, categoria = 'argumento') => clasificarMovimientoDePuntaje({ motivo, categoria });
    expect(clasificar('Post n.º 1')).toBe(TIPOS_DE_MOVIMIENTO.APORTES);
    expect(clasificar('Réplica n.º 2')).toBe(TIPOS_DE_MOVIMIENTO.APORTES);
    expect(clasificar('Argumento posición 1, ronda 1')).toBe(TIPOS_DE_MOVIMIENTO.APORTES);
    expect(clasificar('Revisión del aporte: parcial (decidió el moderador)')).toBe(TIPOS_DE_MOVIMIENTO.REVISION);
    expect(clasificar('Aporte oculto por la moderación: no cuenta')).toBe(TIPOS_DE_MOVIMIENTO.REVISION);
    expect(clasificar('Exposición evaluada por el moderador')).toBe(TIPOS_DE_MOVIMIENTO.REVISION);
    expect(clasificar('Intervención hablada sin argumento escrito')).toBe(TIPOS_DE_MOVIMIENTO.TURNO_HABLADO);
    expect(clasificar('Rechazó el turno para defender su argumento')).toBe(TIPOS_DE_MOVIMIENTO.PENALIDAD);
    expect(clasificar('Algo nuevo')).toBe(TIPOS_DE_MOVIMIENTO.OTROS);
  });

  it('todo lo de la categoría co_moderacion es co-moderación, sea cual sea su motivo', () => {
    expect(clasificarMovimientoDePuntaje({ motivo: 'Calidad de sus revisiones', categoria: 'co_moderacion' })).toBe(
      TIPOS_DE_MOVIMIENTO.CO_MODERACION
    );
  });
});

describe('calcularDesgloseDePuntaje', () => {
  const eventos = [
    puntaje('ana', 100, 'Post n.º 1', 'argumento', 100),
    puntaje('ana', 80, 'Post n.º 2', 'argumento', 180),
    puntaje('luis', 30, 'Réplica n.º 1', 'argumento', 30),
    { name: EVENTOS.ARGUMENTO_PUBLICADO, data: { participantId: 'ana' } },
    puntaje('ana', -40, 'Revisión del aporte: parcial (mayoría de co-moderadores)', 'argumento', 140),
    puntaje('carla', 30, 'Calidad de sus revisiones: 100 % de acierto', 'co_moderacion', 30),
  ];

  it('agrupa por persona, con subtotales por tipo y el total que quedó en el marcador', () => {
    const desglose = calcularDesgloseDePuntaje(eventos);
    expect(desglose.ana.subtotales[TIPOS_DE_MOVIMIENTO.APORTES]).toBe(180);
    expect(desglose.ana.subtotales[TIPOS_DE_MOVIMIENTO.REVISION]).toBe(-40);
    expect(desglose.ana.totalNominal).toBe(140);
    expect(desglose.ana.totalFinal).toBe(140);
    expect(desglose.ana.movimientos).toHaveLength(3);
    expect(desglose.carla.subtotales[TIPOS_DE_MOVIMIENTO.CO_MODERACION]).toBe(30);
  });

  it('ignora los eventos que no son de puntaje', () => {
    expect(Object.keys(calcularDesgloseDePuntaje(eventos)).sort()).toEqual(['ana', 'carla', 'luis']);
  });

  it('un total que se topó en cero queda distinto del nominal: el informe puede explicarlo', () => {
    const desglose = calcularDesgloseDePuntaje([
      puntaje('pedro', 10, 'Post n.º 1', 'argumento', 10),
      puntaje('pedro', -20, 'Rechazó el turno para defender su argumento', 'argumento', 0),
    ]);
    expect(desglose.pedro.totalNominal).toBe(-10);
    expect(desglose.pedro.totalFinal).toBe(0);
  });

  it('sin eventos de puntaje no hay desglose', () => {
    expect(calcularDesgloseDePuntaje([])).toEqual({});
  });
});
