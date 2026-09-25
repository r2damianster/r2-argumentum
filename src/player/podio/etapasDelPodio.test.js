import { describe, it, expect } from 'vitest';
import {
  construirEtapasDelPodio,
  puestosRevelados,
  duracionTotalDeLaRevelacionMs,
  PAUSA_ANTES_DEL_PRIMER_LUGAR_MS,
  PAUSA_DE_LA_INTRODUCCION_MS,
  PAUSA_ENTRE_REVELACIONES_MS,
} from './etapasDelPodio.js';

const posturas = (cantidad) => Array.from({ length: cantidad }, (_, indice) => ({ stanceId: `p${indice}` }));
const personas = (cantidad) => Array.from({ length: cantidad }, (_, indice) => ({ participantId: `u${indice}` }));
const claves = (etapas) => etapas.map((etapa) => etapa.clave);

describe('guion de la revelación del podio', () => {
  it('con 3 posturas y 8 personas: introducción, posturas 3→1, individuos 3→1 y resultado', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(3), podioIndividual: personas(8) });

    expect(claves(etapas)).toEqual([
      'introduccion',
      'postura-3', 'postura-2', 'postura-1',
      'individual-3', 'individual-2', 'individual-1',
      'resultado',
    ]);
  });

  it('cada podio se descubre del último lugar al primero', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(3), podioIndividual: personas(5) });
    const posiciones = etapas.filter((etapa) => etapa.tipo === 'individual').map((etapa) => etapa.posicion);

    expect(posiciones).toEqual([3, 2, 1]);
  });

  it('antes de descubrir el primer lugar hay más suspenso que entre los demás', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(3), podioIndividual: personas(5) });
    const antesDelPrimero = etapas.find((etapa) => etapa.clave === 'individual-2');
    const tercero = etapas.find((etapa) => etapa.clave === 'individual-3');

    expect(antesDelPrimero.duracionMs).toBe(PAUSA_ANTES_DEL_PRIMER_LUGAR_MS);
    expect(tercero.duracionMs).toBe(PAUSA_ENTRE_REVELACIONES_MS);
    expect(PAUSA_ANTES_DEL_PRIMER_LUGAR_MS).toBeGreaterThan(PAUSA_ENTRE_REVELACIONES_MS);
  });

  it('con menos de 3 personas el podio solo tiene los puestos que existen', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(2), podioIndividual: personas(2) });

    expect(claves(etapas)).toEqual([
      'introduccion', 'postura-2', 'postura-1', 'individual-2', 'individual-1', 'resultado',
    ]);
  });

  it('con una sola postura no se revela el podio por equipos', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(1), podioIndividual: personas(4) });

    expect(claves(etapas).some((clave) => clave.startsWith('postura'))).toBe(false);
  });

  it('sin participantes solo hay introducción y resultado', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: [], podioIndividual: [] });

    expect(claves(etapas)).toEqual(['introduccion', 'resultado']);
  });

  it('la revelación se toma su tiempo: más de 15 s con el podio completo, y menos de 40 s', () => {
    const total = duracionTotalDeLaRevelacionMs(
      construirEtapasDelPodio({ podioDePosturas: posturas(3), podioIndividual: personas(8) })
    );

    expect(total).toBeGreaterThan(15000);
    expect(total).toBeLessThan(40000);
    expect(PAUSA_DE_LA_INTRODUCCION_MS).toBeGreaterThan(2000);
  });

  it('puestosRevelados acumula los lugares ya descubiertos y no adelanta ninguno', () => {
    const etapas = construirEtapasDelPodio({ podioDePosturas: posturas(3), podioIndividual: personas(5) });
    const indiceDe = (clave) => etapas.findIndex((etapa) => etapa.clave === clave);

    expect([...puestosRevelados(etapas, 0, 'individual')]).toEqual([]);
    expect([...puestosRevelados(etapas, indiceDe('individual-3'), 'individual')]).toEqual([3]);
    expect([...puestosRevelados(etapas, indiceDe('individual-1'), 'individual')].sort()).toEqual([1, 2, 3]);
    // Los individuos no se revelan mientras van las posturas.
    expect([...puestosRevelados(etapas, indiceDe('postura-2'), 'individual')]).toEqual([]);
  });
});
