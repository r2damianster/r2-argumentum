import { describe, expect, it } from 'vitest';
import { calcularPodioPorNota } from './calcularPodioPorNota.js';

describe('calcularPodioPorNota', () => {
  it('ordena de mayor a menor y deja solo cinco lugares', () => {
    const podio = calcularPodioPorNota([
      { participantId: 'a', puntuacion: 6 },
      { participantId: 'b', puntuacion: 9 },
      { participantId: 'c', puntuacion: 7 },
      { participantId: 'd', puntuacion: 8 },
      { participantId: 'e', puntuacion: 5 },
      { participantId: 'f', puntuacion: 4 },
    ]);
    expect(podio.map((lugar) => lugar.lugar)).toEqual([1, 2, 3, 4, 5]);
    expect(podio.map((lugar) => lugar.participantIds[0])).toEqual(['b', 'd', 'c', 'a', 'e']);
  });

  it('una nota exactamente igual comparte lugar y no se salta ninguno', () => {
    const podio = calcularPodioPorNota([
      { participantId: 'a', puntuacion: 9.5 },
      { participantId: 'b', puntuacion: 9.5 },
      { participantId: 'c', puntuacion: 8 },
    ]);
    expect(podio).toEqual([
      { lugar: 1, participantIds: ['a', 'b'] },
      { lugar: 2, participantIds: ['c'] },
    ]);
  });

  it('no incluye a quien no tiene puntuación', () => {
    expect(
      calcularPodioPorNota([
        { participantId: 'a', puntuacion: 0 },
        { participantId: 'b', puntuacion: null },
        { participantId: 'c', puntuacion: 3 },
      ])
    ).toEqual([{ lugar: 1, participantIds: ['c'] }]);
  });

  it('con muchos empatados puede haber más de cinco personas en el podio', () => {
    const empatados = ['a', 'b', 'c', 'd', 'e', 'f'].map((participantId) => ({ participantId, puntuacion: 7 }));
    const podio = calcularPodioPorNota(empatados);
    expect(podio).toHaveLength(1);
    expect(podio[0].participantIds).toHaveLength(6);
  });
});
