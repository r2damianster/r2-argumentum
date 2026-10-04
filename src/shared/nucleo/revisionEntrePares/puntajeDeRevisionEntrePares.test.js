import { describe, expect, it } from 'vitest';
import { calcularPuntosDeUnRevisor, compararConLaReferencia, describirLaDiferencia } from './puntajeDeRevisionEntrePares.js';

const RUBRICA = [
  { id: 'a', nombre: 'Pertinencia', peso: 50 },
  { id: 'b', nombre: 'Estructura', peso: 50 },
];

describe('compararConLaReferencia', () => {
  it('coincidir en todo da cercanía 1', () => {
    const { cercania, comparaciones } = compararConLaReferencia({
      rubrica: RUBRICA,
      nivelesDelRevisor: { a: 'bueno', b: 'excelente' },
      nivelesDeReferencia: { a: 'bueno', b: 'excelente' },
    });
    expect(cercania).toBe(1);
    expect(comparaciones.map((comparacion) => comparacion.diferenciaDeNiveles)).toEqual([0, 0]);
  });

  it('el extremo opuesto da cercanía 0 y pondera por peso', () => {
    expect(
      compararConLaReferencia({
        rubrica: RUBRICA,
        nivelesDelRevisor: { a: 'excelente', b: 'insuficiente' },
        nivelesDeReferencia: { a: 'insuficiente', b: 'excelente' },
      }).cercania
    ).toBe(0);

    const ponderada = compararConLaReferencia({
      rubrica: [
        { id: 'a', nombre: 'A', peso: 75 },
        { id: 'b', nombre: 'B', peso: 25 },
      ],
      nivelesDelRevisor: { a: 'excelente', b: 'insuficiente' },
      nivelesDeReferencia: { a: 'excelente', b: 'excelente' },
    });
    expect(ponderada.cercania).toBe(0.75);
  });

  it('solo compara los criterios donde hay las dos evaluaciones', () => {
    const resultado = compararConLaReferencia({
      rubrica: RUBRICA,
      nivelesDelRevisor: { a: 'bueno' },
      nivelesDeReferencia: { a: 'aceptable', b: 'bueno' },
    });
    expect(resultado.comparaciones).toHaveLength(1);
    expect(resultado.comparaciones[0]).toMatchObject({ criterioId: 'a', diferenciaDeNiveles: 1 });
    expect(compararConLaReferencia({ rubrica: RUBRICA, nivelesDelRevisor: {}, nivelesDeReferencia: {} }).cercania).toBeNull();
  });
});

describe('describirLaDiferencia', () => {
  it('no revela el nivel, solo cuánto difirió', () => {
    expect(describirLaDiferencia(0)).toBe('coincidió con la evaluación del docente');
    expect(describirLaDiferencia(1)).toBe('difirió en 1 nivel');
    expect(describirLaDiferencia(3)).toBe('difirió en 3 niveles');
  });
});

describe('calcularPuntosDeUnRevisor', () => {
  it('acertar en todo y haber hecho todas las revisiones da el máximo', () => {
    const puntos = calcularPuntosDeUnRevisor({
      revisiones: [
        { valida: true, cercania: 1 },
        { valida: true, cercania: 1 },
      ],
    });
    expect(puntos).toMatchObject({ asignadas: 2, hechas: 2, acierto: 1, esfuerzo: 1, puntos: 2 });
  });

  it('votar como el azar (cercanía 0,5) no suma', () => {
    expect(calcularPuntosDeUnRevisor({ revisiones: [{ valida: true, cercania: 0.5 }, { valida: true, cercania: 0.5 }] }).puntos).toBe(0);
  });

  it('haber hecho solo una de dos baja el esfuerzo', () => {
    const puntos = calcularPuntosDeUnRevisor({ revisiones: [{ valida: true, cercania: 1 }, { valida: false, cercania: null }] });
    expect(puntos).toMatchObject({ hechas: 1, esfuerzo: 0.5, puntos: 1 });
  });

  it('sin referencia del docente el acierto es neutro (reconoce el esfuerzo)', () => {
    const puntos = calcularPuntosDeUnRevisor({ revisiones: [{ valida: true, cercania: null }, { valida: true, cercania: null }] });
    expect(puntos.acierto).toBe(0.5);
    expect(puntos.puntos).toBe(1);
  });

  it('no revisar nada no da puntos', () => {
    expect(calcularPuntosDeUnRevisor({ revisiones: [{ valida: false, cercania: null }] }).puntos).toBe(0);
    expect(calcularPuntosDeUnRevisor({ revisiones: [] }).puntos).toBe(0);
  });
});
