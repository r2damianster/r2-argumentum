import { describe, expect, it } from 'vitest';
import {
  CRITERIOS_BASE_DE_LA_RUBRICA,
  calcularNotaDeRubrica,
  filtrarComentariosPorCriterio,
  filtrarNivelesValidos,
  resolverRubricaDelPrograma,
  rubricaEstaCompleta,
} from './rubrica.js';

const RUBRICA_SIMPLE = [
  { id: 'a', nombre: 'A', peso: 50 },
  { id: 'b', nombre: 'B', peso: 50 },
];

describe('resolverRubricaDelPrograma', () => {
  it('sin rúbrica propia usa los criterios de serie', () => {
    const rubrica = resolverRubricaDelPrograma({});
    expect(rubrica.map((criterio) => criterio.id)).toEqual(CRITERIOS_BASE_DE_LA_RUBRICA.map((criterio) => criterio.id));
  });

  it('suma los criterios de la consigna, en texto simple o con peso', () => {
    const rubrica = resolverRubricaDelPrograma({
      criteriosDeLaConsigna: ['Menciona dos ideas del texto', { nombre: 'Usa un ejemplo propio', peso: 30 }],
    });
    expect(rubrica).toHaveLength(CRITERIOS_BASE_DE_LA_RUBRICA.length + 2);
    expect(rubrica.at(-2)).toMatchObject({ nombre: 'Menciona dos ideas del texto', peso: 15 });
    expect(rubrica.at(-1)).toMatchObject({ nombre: 'Usa un ejemplo propio', peso: 30 });
  });

  it('descarta criterios sin nombre y mantiene los ids únicos', () => {
    const rubrica = resolverRubricaDelPrograma({
      rubrica: [
        { id: 'x', nombre: 'Uno', peso: 10 },
        { id: 'x', nombre: 'Dos', peso: 10 },
        { id: 'y', nombre: '   ', peso: 10 },
      ],
    });
    expect(rubrica.map((criterio) => criterio.id)).toEqual(['x', 'x-2']);
  });

  it('un peso inválido vuelve al valor por defecto', () => {
    const rubrica = resolverRubricaDelPrograma({ rubrica: [{ id: 'x', nombre: 'Uno', peso: -5 }] });
    expect(rubrica[0].peso).toBe(10);
  });
});

describe('calcularNotaDeRubrica', () => {
  it('todo excelente vale 10 y todo insuficiente vale 0', () => {
    expect(calcularNotaDeRubrica(RUBRICA_SIMPLE, { a: 'excelente', b: 'excelente' })).toBe(10);
    expect(calcularNotaDeRubrica(RUBRICA_SIMPLE, { a: 'insuficiente', b: 'insuficiente' })).toBe(0);
  });

  it('pondera por peso y devuelve decimales', () => {
    const rubrica = [
      { id: 'a', nombre: 'A', peso: 75 },
      { id: 'b', nombre: 'B', peso: 25 },
    ];
    // a = excelente (1) con 75; b = aceptable (1/3) con 25 → 75 + 8,33 = 83,33 → 8,33
    expect(calcularNotaDeRubrica(rubrica, { a: 'excelente', b: 'aceptable' })).toBe(8.33);
  });

  it('un criterio sin evaluar cuenta como 0, pero sin ninguna evaluación no hay nota', () => {
    expect(calcularNotaDeRubrica(RUBRICA_SIMPLE, { a: 'excelente' })).toBe(5);
    expect(calcularNotaDeRubrica(RUBRICA_SIMPLE, {})).toBeNull();
    expect(calcularNotaDeRubrica([], { a: 'excelente' })).toBeNull();
  });

  it('ignora niveles que no existen', () => {
    expect(calcularNotaDeRubrica(RUBRICA_SIMPLE, { a: 'genial', b: 'excelente' })).toBe(5);
  });
});

describe('validación de lo que llega de fuera', () => {
  it('rubricaEstaCompleta exige todos los criterios', () => {
    expect(rubricaEstaCompleta(RUBRICA_SIMPLE, { a: 'bueno' })).toBe(false);
    expect(rubricaEstaCompleta(RUBRICA_SIMPLE, { a: 'bueno', b: 'bueno' })).toBe(true);
  });

  it('filtrarNivelesValidos quita criterios inventados y niveles inválidos', () => {
    expect(filtrarNivelesValidos(RUBRICA_SIMPLE, { a: 'bueno', b: 'regular', z: 'excelente' })).toEqual({ a: 'bueno' });
  });

  it('filtrarComentariosPorCriterio acota la longitud y descarta lo que no es criterio', () => {
    const comentarios = filtrarComentariosPorCriterio(RUBRICA_SIMPLE, { a: '  Bien  ', b: '', z: 'x', c: 'y' }, 10);
    expect(comentarios).toEqual({ a: 'Bien' });
    expect(filtrarComentariosPorCriterio(RUBRICA_SIMPLE, { a: 'x'.repeat(50) }, 10).a).toHaveLength(10);
  });
});
