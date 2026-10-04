import { describe, expect, it } from 'vitest';
import { crearRecolectorDeSenales, TIPOS_DE_ENTRADA } from './recolectorDeSenales.js';
import {
  calcularDescuentoPorPegado,
  calcularDescuentosAutomaticosPorPegado,
  colorDelIndicadorDePegado,
  normalizarPenalizacionPorPegado,
  penalizacionPorPegadoEstaActiva,
} from './penalizacionPorPegado.js';

const escribir = (recolector, caracteres) => {
  for (let indice = 0; indice < caracteres; indice += 1) {
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 1 });
  }
};

describe('proporción penalizada del recolector', () => {
  it('sin pegar es 0 y un pegado pequeño (menos de 20 caracteres) no penaliza', () => {
    const recolector = crearRecolectorDeSenales();
    escribir(recolector, 100);
    expect(recolector.proporcionPenalizada()).toBe(0);
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 15 });
    expect(recolector.proporcionPenalizada()).toBe(0);
  });

  it('pegar sube la proporción al instante, para avisar mientras se escribe', () => {
    const recolector = crearRecolectorDeSenales();
    escribir(recolector, 100);
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 100 });
    expect(recolector.proporcionPenalizada()).toBe(0.5);
  });

  it('pegar todo el texto es 100 %', () => {
    const recolector = crearRecolectorDeSenales();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 400 });
    expect(recolector.proporcionPenalizada()).toBe(1);
  });

  it('borrar lo pegado devuelve casi toda la oportunidad: queda un residuo pequeño (1 punto con el máximo de 5)', () => {
    const recolector = crearRecolectorDeSenales();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 400 });
    expect(recolector.proporcionPenalizada()).toBe(1);
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.BORRADO, caracteres: 400 });
    expect(recolector.proporcionPenalizada()).toBe(0.2);
    expect(calcularDescuentoPorPegado(recolector.proporcionPenalizada(), { descuentoMaximo: 5 })).toBe(1);
    // Y reescribirlo a mano lo diluye, pero no lo borra.
    escribir(recolector, 400);
    expect(recolector.proporcionPenalizada()).toBeCloseTo(80 / 800, 4);
    expect(recolector.proporcionPenalizada()).toBeGreaterThan(0);
  });

  it('borrar solo una parte de lo pegado conserva el resto', () => {
    const recolector = crearRecolectorDeSenales();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 200 });
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.BORRADO, caracteres: 50 });
    // 150 vigentes + 0,2 × 50 borrados = 160 de 200
    expect(recolector.proporcionPenalizada()).toBeCloseTo(0.8, 4);
  });

  it('el arrastre cuenta igual que pegar', () => {
    const recolector = crearRecolectorDeSenales();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ARRASTRE, caracteres: 300 });
    expect(recolector.proporcionPenalizada()).toBe(1);
  });

  it('el resumen para el envío lleva la proporción penalizada', () => {
    const recolector = crearRecolectorDeSenales();
    escribir(recolector, 100);
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 100 });
    expect(recolector.resumir({ textoFinal: 'x'.repeat(200) }).estadisticas.proporcionPenalizada).toBe(0.5);
  });

  it('al reiniciar (tras enviar) empieza de cero', () => {
    const recolector = crearRecolectorDeSenales();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 400 });
    recolector.reiniciar();
    expect(recolector.proporcionPenalizada()).toBe(0);
  });
});

describe('descuento y color', () => {
  it('el descuento es la proporción por el máximo configurado', () => {
    expect(calcularDescuentoPorPegado(1, { descuentoMaximo: 5 })).toBe(5);
    expect(calcularDescuentoPorPegado(0.5, { descuentoMaximo: 5 })).toBe(2.5);
    expect(calcularDescuentoPorPegado(0, { descuentoMaximo: 5 })).toBe(0);
    expect(calcularDescuentoPorPegado(0.5, { activa: false })).toBe(0);
  });

  it('el máximo se normaliza: por defecto 5 y nunca más de 10', () => {
    expect(normalizarPenalizacionPorPegado(undefined)).toEqual({ activa: true, descuentoMaximo: 5 });
    expect(normalizarPenalizacionPorPegado({ descuentoMaximo: 99 }).descuentoMaximo).toBe(10);
    expect(normalizarPenalizacionPorPegado({ descuentoMaximo: -3 }).descuentoMaximo).toBe(5);
  });

  it('el color va de verde a rojo y no depende de un número visible', () => {
    expect(colorDelIndicadorDePegado(0)).toBe('hsl(120, 75%, 42%)');
    expect(colorDelIndicadorDePegado(0.3)).toBe('hsl(78, 75%, 42%)');
    // El residuo tras borrar lo pegado (20 %) sigue viéndose verde, y claramente distinto del rojo.
    expect(colorDelIndicadorDePegado(0.2)).toBe('hsl(97, 75%, 42%)');
    expect(colorDelIndicadorDePegado(0.6)).toBe('hsl(0, 75%, 42%)');
    expect(colorDelIndicadorDePegado(1)).toBe('hsl(0, 75%, 42%)');
  });
});

describe('calcularDescuentosAutomaticosPorPegado', () => {
  const registro = (participantId, proporcionPenalizada, contexto = 'entrega_de_lectura') => ({ participantId, contexto, proporcionPenalizada });

  it('calcula el descuento de cada persona con la mayor proporción que publicó', () => {
    const descuentos = calcularDescuentosAutomaticosPorPegado({
      registros: [registro('ana', 0.2), registro('ana', 0.8), registro('beto', 0), registro('carla', 0.5, 'foro')],
      programa: { integridad: { nivel: 'advertencias' }, penalizacionPorPegado: { descuentoMaximo: 5 } },
    });
    expect(descuentos).toEqual({ ana: 4 });
  });

  it('con la integridad apagada o la penalización desactivada no hay descuento', () => {
    const registros = [registro('ana', 1)];
    expect(calcularDescuentosAutomaticosPorPegado({ registros, programa: { integridad: { nivel: 'ninguna' } } })).toEqual({});
    expect(
      calcularDescuentosAutomaticosPorPegado({
        registros,
        programa: { integridad: { nivel: 'advertencias' }, penalizacionPorPegado: { activa: false } },
      })
    ).toEqual({});
    expect(penalizacionPorPegadoEstaActiva({ integridad: { nivel: 'advertencias' } })).toBe(true);
  });
});
