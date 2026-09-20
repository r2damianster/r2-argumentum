import { describe, it, expect } from 'vitest';
import {
  calcularZoomDelNavegador,
  zoomEstaMuyReducido,
  factorParaLeerElAviso,
  porcentajeDeZoom,
} from './zoomDelNavegador.js';
import { calcularFactorDeCompensacion } from './compensarZoomDelNavegador.js';

describe('zoom del navegador', () => {
  it('al 100 % el cociente queda cerca de 1 y no se avisa', () => {
    const zoom = calcularZoomDelNavegador({ outerWidth: 1936, innerWidth: 1920 });

    expect(zoomEstaMuyReducido(zoom)).toBe(false);
  });

  it('con DevTools acoplado (ventana interna más angosta) no se avisa', () => {
    const zoom = calcularZoomDelNavegador({ outerWidth: 1936, innerWidth: 1300 });

    expect(zoomEstaMuyReducido(zoom)).toBe(false);
  });

  it('al 33 % (innerWidth triplicado) se avisa y se lee el porcentaje', () => {
    const zoom = calcularZoomDelNavegador({ outerWidth: 1936, innerWidth: 5800 });

    expect(zoomEstaMuyReducido(zoom)).toBe(true);
    expect(porcentajeDeZoom(zoom)).toBe(33);
  });

  it('con medidas ausentes o inválidas asume 100 %', () => {
    expect(calcularZoomDelNavegador({ outerWidth: 0, innerWidth: 1000 })).toBe(1);
    expect(calcularZoomDelNavegador({ outerWidth: 1000, innerWidth: undefined })).toBe(1);
  });

  it('un outerWidth absurdo (ventana minimizada) no se toma por zoom: sería menos de 25 %', () => {
    const zoom = calcularZoomDelNavegador({ outerWidth: 160, innerWidth: 1143 });

    expect(zoom).toBe(1);
    expect(zoomEstaMuyReducido(zoom)).toBe(false);
  });

  it('el aviso se agranda al revés del zoom, con tope', () => {
    expect(factorParaLeerElAviso(1)).toBe(1);
    expect(factorParaLeerElAviso(0.5)).toBe(2);
    expect(factorParaLeerElAviso(0.1)).toBe(4);
  });
});


describe('compensación del zoom reducido', () => {
  it('no toca la página con zoom normal', () => {
    expect(calcularFactorDeCompensacion(1)).toBe(1);
    expect(calcularFactorDeCompensacion(0.9)).toBe(1);
  });

  it('con el zoom muy reducido amplía en proporción inversa, con tope', () => {
    expect(calcularFactorDeCompensacion(0.5)).toBe(2);
    expect(calcularFactorDeCompensacion(1936 / 5800)).toBeCloseTo(3, 0);
    expect(calcularFactorDeCompensacion(0.1)).toBe(4);
  });
});
