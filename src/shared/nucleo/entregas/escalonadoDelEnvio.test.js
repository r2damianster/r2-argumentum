import { describe, expect, it } from 'vitest';
import { MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS } from './estadoPublicoDeEntregas.js';
import { VENTANA_MAXIMA_DEL_ESCALONADO_MS, esperaAleatoriaDelEnvioMs, ventanaDelEscalonadoMs } from './escalonadoDelEnvio.js';

describe('ventanaDelEscalonadoMs', () => {
  it('crece con el tamaño de la sala', () => {
    expect(ventanaDelEscalonadoMs(10)).toBeLessThan(ventanaDelEscalonadoMs(40));
    expect(ventanaDelEscalonadoMs(40)).toBeLessThan(ventanaDelEscalonadoMs(80));
  });

  it('una sala chica casi no espera y una de 80 reparte el envío en unos 20 s', () => {
    expect(ventanaDelEscalonadoMs(5)).toBeLessThan(200);
    expect(ventanaDelEscalonadoMs(40)).toBeGreaterThan(4000);
    expect(ventanaDelEscalonadoMs(40)).toBeLessThan(6000);
    expect(ventanaDelEscalonadoMs(80)).toBeGreaterThan(20000);
    expect(ventanaDelEscalonadoMs(80)).toBeLessThan(22000);
  });

  it('tiene un tope y queda bien por debajo del margen que el host acepta tras el cierre', () => {
    expect(ventanaDelEscalonadoMs(500)).toBe(VENTANA_MAXIMA_DEL_ESCALONADO_MS);
    expect(VENTANA_MAXIMA_DEL_ESCALONADO_MS).toBeLessThan(MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS);
  });

  it('tolera datos raros', () => {
    expect(ventanaDelEscalonadoMs(undefined)).toBeGreaterThanOrEqual(0);
    expect(ventanaDelEscalonadoMs(-3)).toBeGreaterThanOrEqual(0);
  });
});

describe('esperaAleatoriaDelEnvioMs', () => {
  it('va de 0 a la ventana según el azar', () => {
    expect(esperaAleatoriaDelEnvioMs(80, () => 0)).toBe(0);
    expect(esperaAleatoriaDelEnvioMs(80, () => 1)).toBe(ventanaDelEscalonadoMs(80));
    expect(esperaAleatoriaDelEnvioMs(80, () => 0.5)).toBe(Math.round(ventanaDelEscalonadoMs(80) / 2));
  });
});
