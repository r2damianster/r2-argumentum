// Guion de la revelación del podio en la pantalla final del participante. Es lógica pura para que
// se pueda probar sin navegador (ver etapasDelPodio.test.js).
//
// El podio se «toma su tiempo»: primero una introducción, luego cada podio se descubre del último
// lugar al primero, con una pausa más larga antes del primer lugar. Al final aparece el resultado
// personal, los créditos y la tabla completa.

export const PAUSA_DE_LA_INTRODUCCION_MS = 2600;
export const PAUSA_ENTRE_REVELACIONES_MS = 2600;
export const PAUSA_ANTES_DEL_PRIMER_LUGAR_MS = 3400;
export const MAXIMO_DE_PUESTOS_EN_EL_PODIO = 3;

function etapasDeUnPodio(tipo, cantidadDeEntradas) {
  const puestos = Math.min(MAXIMO_DE_PUESTOS_EN_EL_PODIO, cantidadDeEntradas);
  const etapas = [];
  for (let posicion = puestos; posicion >= 1; posicion -= 1) {
    etapas.push({
      clave: `${tipo}-${posicion}`,
      tipo,
      posicion,
      // La pausa es lo que dura la etapa ANTES de pasar a la siguiente: antes de descubrir el
      // primer lugar se deja más suspenso.
      duracionMs: posicion === 2 ? PAUSA_ANTES_DEL_PRIMER_LUGAR_MS : PAUSA_ENTRE_REVELACIONES_MS,
    });
  }
  return etapas;
}

// `podioDePosturas`: solo posturas con integrantes. `podioIndividual`: participantes (sin co-moderadores).
export function construirEtapasDelPodio({ podioDePosturas, podioIndividual }) {
  const etapas = [{ clave: 'introduccion', tipo: 'introduccion', duracionMs: PAUSA_DE_LA_INTRODUCCION_MS }];

  // Con una sola postura no hay competencia entre equipos que revelar.
  if (podioDePosturas.length >= 2) {
    etapas.push(...etapasDeUnPodio('postura', podioDePosturas.length));
  }
  if (podioIndividual.length >= 1) {
    etapas.push(...etapasDeUnPodio('individual', podioIndividual.length));
  }

  etapas.push({ clave: 'resultado', tipo: 'resultado', duracionMs: 0 });
  return etapas;
}

// Qué puestos de un podio ya se pueden mostrar cuando la revelación va en `indiceDeEtapa`.
export function puestosRevelados(etapas, indiceDeEtapa, tipo) {
  const revelados = new Set();
  etapas.forEach((etapa, indice) => {
    if (etapa.tipo === tipo && indice <= indiceDeEtapa) {
      revelados.add(etapa.posicion);
    }
  });
  return revelados;
}

export function duracionTotalDeLaRevelacionMs(etapas) {
  return etapas.reduce((suma, etapa) => suma + etapa.duracionMs, 0);
}
