import { describe, expect, it } from 'vitest';
import {
  contarConvencimientoCruzado,
  contarReaccionesDeUnAporte,
  reaccionDeParticipante,
  resumirReaccionesDelForo,
} from './contarReacciones.js';

const estado = {
  argumentos: {
    p1: { argumentId: 'p1', participantId: 'ana', stanceId: 'a_favor' },
    p2: { argumentId: 'p2', participantId: 'luis', stanceId: 'en_contra' },
  },
  participantes: {
    ana: { stanceId: 'a_favor' },
    luis: { stanceId: 'en_contra' },
    marta: { stanceId: 'a_favor' },
    pedro: { stanceId: 'en_contra' },
    sofia: { stanceId: null },
  },
  reacciones: {
    p1: { luis: 'me_convencio', pedro: 'me_convencio', marta: 'me_convencio', sofia: 'me_convencio' },
    p2: { ana: 'me_hizo_dudar', marta: 'aporta_evidencia' },
  },
};

describe('contarReaccionesDeUnAporte', () => {
  it('cuenta cada tipo, incluidos los que están en cero', () => {
    expect(contarReaccionesDeUnAporte(estado, 'p1')).toEqual({
      me_convencio: 4,
      me_hizo_dudar: 0,
      aporta_evidencia: 0,
    });
    expect(contarReaccionesDeUnAporte(estado, 'p2')).toEqual({
      me_convencio: 0,
      me_hizo_dudar: 1,
      aporta_evidencia: 1,
    });
  });

  it('un aporte sin reacciones da todo en cero', () => {
    expect(contarReaccionesDeUnAporte({ reacciones: {} }, 'nada')).toEqual({
      me_convencio: 0,
      me_hizo_dudar: 0,
      aporta_evidencia: 0,
    });
  });
});

describe('reaccionDeParticipante', () => {
  it('devuelve la reacción propia o null', () => {
    expect(reaccionDeParticipante(estado, 'p1', 'luis')).toBe('me_convencio');
    expect(reaccionDeParticipante(estado, 'p1', 'nadie')).toBeNull();
  });
});

describe('contarConvencimientoCruzado', () => {
  it('cuenta solo los «me convenció» de quienes defienden la postura contraria', () => {
    // Luis y Pedro (en contra) convencieron-se de Ana (a favor); Marta es del mismo bando y Sofía no tiene postura.
    expect(contarConvencimientoCruzado(estado, 'p1')).toBe(2);
  });

  it('otros tipos de reacción no cuentan como convencimiento', () => {
    expect(contarConvencimientoCruzado(estado, 'p2')).toBe(0);
  });

  it('un aporte sin postura o inexistente no tiene convencimiento cruzado', () => {
    expect(contarConvencimientoCruzado(estado, 'no-existe')).toBe(0);
  });
});

describe('resumirReaccionesDelForo', () => {
  it('suma los totales por tipo y el convencimiento cruzado de todo el foro', () => {
    expect(resumirReaccionesDelForo(estado)).toEqual({
      totalPorTipo: { me_convencio: 4, me_hizo_dudar: 1, aporta_evidencia: 1 },
      convencimientoCruzado: 2,
    });
  });
});
