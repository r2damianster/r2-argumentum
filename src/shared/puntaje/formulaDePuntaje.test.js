import { describe, it, expect } from 'vitest';
import {
  calcularPuntajeDeArgumento,
  calcularPuntajeDeTurnoVerbal,
  calcularPenalidadPorRechazoDeTurno,
  calcularBonosDeCoModerador,
  calcularNumeroDeCoModeradores,
  resolverParametrosDePuntaje,
  PERFILES_DE_PUNTAJE,
} from './formulaDePuntaje.js';

describe('tabla de docs/05 con el perfil estándar', () => {
  const estandar = PERFILES_DE_PUNTAJE.estandar;

  it('las tres posiciones en ronda 1 valen su valor base', () => {
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 1, ronda: 1 }, estandar)).toBe(100);
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 2, ronda: 1 }, estandar)).toBe(80);
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 3, ronda: 1 }, estandar)).toBe(30);
  });

  it('ronda 2 aplica el descuento de 0.7 que fija docs/05', () => {
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 1, ronda: 2 }, estandar)).toBe(70);
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 2, ronda: 2 }, estandar)).toBe(56);
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 3, ronda: 2 }, estandar)).toBe(21);
  });

  it('la vía co-moderador aplica sobre el valor ya descontado por ronda', () => {
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 1, ronda: 1, viaCoModerador: true }, estandar)).toBe(50);
    expect(calcularPuntajeDeArgumento({ posicionEnRonda: 1, ronda: 2, viaCoModerador: true }, estandar)).toBe(35);
  });
});

describe('los perfiles mantienen la proporción entre posiciones', () => {
  // El ranking usa cortes por percentil dentro de cada postura, así que lo que importa no es
  // la escala sino que la relación entre posiciones no cambie de un perfil a otro.
  it.each(Object.entries(PERFILES_DE_PUNTAJE))('%s conserva la relación 10 : 8 : 3', (_nombre, perfil) => {
    const [primera, segunda, tercera] = perfil.valoresBasePosicion;

    expect(segunda / primera).toBeCloseTo(0.8, 5);
    expect(tercera / primera).toBeCloseTo(0.3, 5);
  });

  it('cada perfil escala por encima del anterior', () => {
    expect(PERFILES_DE_PUNTAJE.liviano.valoresBasePosicion[0]).toBeLessThan(
      PERFILES_DE_PUNTAJE.estandar.valoresBasePosicion[0]
    );
    expect(PERFILES_DE_PUNTAJE.estandar.valoresBasePosicion[0]).toBeLessThan(
      PERFILES_DE_PUNTAJE.estricto.valoresBasePosicion[0]
    );
  });
});

describe('turno verbal sin argumento escrito', () => {
  it('vale menos que cualquier argumento escrito, pero nunca cero', () => {
    for (const perfil of Object.values(PERFILES_DE_PUNTAJE)) {
      const verbal = calcularPuntajeDeTurnoVerbal(perfil);
      const peorArgumentoEscrito = calcularPuntajeDeArgumento({ posicionEnRonda: 3, ronda: 1 }, perfil);

      expect(verbal).toBeGreaterThan(0);
      expect(verbal).toBeLessThan(peorArgumentoEscrito);
    }
  });
});

describe('penalidad por rechazar el turno', () => {
  it('siempre es negativa, cualquiera sea el perfil', () => {
    for (const perfil of Object.values(PERFILES_DE_PUNTAJE)) {
      expect(calcularPenalidadPorRechazoDeTurno(perfil)).toBeLessThan(0);
    }
  });

  it('el perfil estricto castiga más que el liviano', () => {
    expect(calcularPenalidadPorRechazoDeTurno(PERFILES_DE_PUNTAJE.estricto)).toBeLessThan(
      calcularPenalidadPorRechazoDeTurno(PERFILES_DE_PUNTAJE.liviano)
    );
  });
});

describe('bonos de co-moderación', () => {
  it('escalan con el perfil para seguir siendo comparables al puntaje de argumentar', () => {
    const conLiviano = calcularBonosDeCoModerador(PERFILES_DE_PUNTAJE.liviano);
    const conEstricto = calcularBonosDeCoModerador(PERFILES_DE_PUNTAJE.estricto);

    expect(conLiviano.CASO_ESCALADO_RATIFICADO).toBe(8);
    expect(conEstricto.CASO_ESCALADO_RATIFICADO).toBe(800);
  });

  it('marcar falta sin justificar sigue restando en todos los perfiles', () => {
    for (const perfil of Object.values(PERFILES_DE_PUNTAJE)) {
      expect(calcularBonosDeCoModerador(perfil).FALTA_SIN_JUSTIFICAR_O_REVERTIDA).toBeLessThan(0);
    }
  });
});

describe('resolverParametrosDePuntaje', () => {
  it('el perfil elegido por el docente manda sobre los valores del JSON', () => {
    const parametros = resolverParametrosDePuntaje({
      perfilDePuntaje: 'estricto',
      valoresBasePosicion: [10, 8, 3],
    });

    expect(parametros.valoresBasePosicion).toEqual([1000, 800, 300]);
  });

  it('un Programa viejo sin perfil conserva sus valores explícitos', () => {
    const parametros = resolverParametrosDePuntaje({ valoresBasePosicion: [50, 40, 15], descuentoRonda2: 0.6 });

    expect(parametros.valoresBasePosicion).toEqual([50, 40, 15]);
    expect(parametros.descuentoRonda2).toBe(0.6);
  });

  it('sin Programa cae al perfil por defecto', () => {
    expect(resolverParametrosDePuntaje(null).valoresBasePosicion).toEqual([10, 8, 3]);
  });
});

describe('sorteo de co-moderadores', () => {
  it('respeta el tope máximo configurado', () => {
    expect(calcularNumeroDeCoModeradores(100, 4)).toBe(4);
  });

  it('nunca devuelve cero por la fórmula (el piso de 2 argumentadores lo aplica el motor)', () => {
    expect(calcularNumeroDeCoModeradores(1)).toBe(1);
  });
});
