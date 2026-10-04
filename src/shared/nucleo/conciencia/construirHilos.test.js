import { describe, expect, it } from 'vitest';
import { ORDENES_DE_HILOS, construirHilos, ordenarHilos } from './construirHilos.js';

function crearEstado(aportes) {
  return {
    argumentos: Object.fromEntries(aportes.map((aporte) => [aporte.argumentId, { timestamp: 0, ...aporte }])),
    conexiones: {},
    participantes: {},
  };
}

describe('construirHilos', () => {
  it('cada post lleva sus réplicas anidadas, y una réplica a una réplica queda bajo ella', () => {
    const hilos = construirHilos(
      crearEstado([
        { argumentId: 'p1', participantId: 'ana', timestamp: 1 },
        { argumentId: 'r1', participantId: 'luis', timestamp: 2, argumentoObjetivoId: 'p1' },
        { argumentId: 'c1', participantId: 'ana', timestamp: 3, argumentoObjetivoId: 'r1' },
        { argumentId: 'p2', participantId: 'marta', timestamp: 4 },
      ])
    );
    expect(hilos.map((hilo) => hilo.aporte.argumentId)).toEqual(['p1', 'p2']);
    const primero = hilos[0];
    expect(primero.respuestas[0].aporte.argumentId).toBe('r1');
    expect(primero.respuestas[0].respuestas[0].aporte.argumentId).toBe('c1');
    expect(primero.totalDeRespuestas).toBe(2);
    expect(hilos[1].totalDeRespuestas).toBe(0);
  });

  it('la última actividad de un hilo es la de su respuesta más reciente', () => {
    const [hilo] = construirHilos(
      crearEstado([
        { argumentId: 'p1', participantId: 'ana', timestamp: 1 },
        { argumentId: 'r1', participantId: 'luis', timestamp: 50, argumentoObjetivoId: 'p1' },
      ])
    );
    expect(hilo.ultimaActividad).toBe(50);
  });

  it('los aportes ocultos no aparecen, salvo que se pidan (revisión de quienes moderan)', () => {
    const estado = crearEstado([
      { argumentId: 'p1', participantId: 'ana', timestamp: 1, oculto: true },
      { argumentId: 'p2', participantId: 'luis', timestamp: 2 },
    ]);
    expect(construirHilos(estado).map((hilo) => hilo.aporte.argumentId)).toEqual(['p2']);
    expect(construirHilos(estado, { incluirOcultos: true })).toHaveLength(2);
  });

  it('un log con una referencia circular no cuelga la pantalla', () => {
    const hilos = construirHilos(
      crearEstado([
        { argumentId: 'a', participantId: 'ana', timestamp: 1, argumentoObjetivoId: 'b' },
        { argumentId: 'b', participantId: 'luis', timestamp: 2, argumentoObjetivoId: 'a' },
      ])
    );
    expect(hilos).toEqual([]);
  });
});

describe('ordenarHilos', () => {
  const estado = crearEstado([
    { argumentId: 'viejo-sin-respuesta', participantId: 'ana', timestamp: 1 },
    { argumentId: 'con-respuesta', participantId: 'luis', timestamp: 2 },
    { argumentId: 'respuesta', participantId: 'ana', timestamp: 90, argumentoObjetivoId: 'con-respuesta' },
    { argumentId: 'nuevo-sin-respuesta', participantId: 'marta', timestamp: 50 },
  ]);
  const hilos = construirHilos(estado);

  it('por defecto muestra primero lo que se movió más recientemente', () => {
    expect(ordenarHilos(hilos).map((hilo) => hilo.aporte.argumentId)).toEqual([
      'con-respuesta',
      'nuevo-sin-respuesta',
      'viejo-sin-respuesta',
    ]);
  });

  it('con «sin debatir primero» van arriba los que esperan, el más antiguo primero', () => {
    expect(ordenarHilos(hilos, ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO).map((hilo) => hilo.aporte.argumentId)).toEqual([
      'viejo-sin-respuesta',
      'nuevo-sin-respuesta',
      'con-respuesta',
    ]);
  });

  it('no modifica la lista original', () => {
    const copia = [...hilos];
    ordenarHilos(hilos, ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO);
    expect(hilos).toEqual(copia);
  });
});
