// Puntos y retroalimentación de quien revisa a un par — ver docs/14-control-de-lectura.md.
//
// Reutiliza la misma idea que los co-moderadores (cercanía con la referencia, corregida por azar) y el
// mismo esfuerzo: la referencia es la calificación final del docente. Funciones puras.

import {
  ACIERTO_SIN_REFERENCIA,
  calcularCercaniaEntreNiveles,
  corregirAciertoPorAzar,
} from '../revision/calcularPuntajeDeRevisores.js';
import { VALOR_MAXIMO_DE_NIVEL, valorDelNivel } from '../rubrica/rubrica.js';

// Lo máximo que puede sumar quien revisa por cada revisión completa y acertada. La nota del autor va de 0
// a 10: revisar bien es un complemento, no sustituye escribir bien.
export const PUNTOS_MAXIMOS_POR_REVISION = 1;

const ESCALA_DE_LOS_NIVELES = { minimo: 0, maximo: VALOR_MAXIMO_DE_NIVEL };

// Compara los niveles de un par con los del docente, criterio por criterio. Devuelve la cercanía media
// ponderada por el peso de cada criterio (1 = coincidió en todo) y la diferencia en peldaños de cada uno.
// Solo cuentan los criterios donde existen las dos evaluaciones. Sin ninguno comparable, `cercania` es null.
export function compararConLaReferencia({ rubrica, nivelesDelRevisor, nivelesDeReferencia }) {
  const comparaciones = [];
  let sumaPonderada = 0;
  let sumaDePesos = 0;

  for (const criterio of rubrica) {
    const valorDelRevisor = valorDelNivel(nivelesDelRevisor?.[criterio.id]);
    const valorDeReferencia = valorDelNivel(nivelesDeReferencia?.[criterio.id]);
    if (valorDelRevisor === null || valorDeReferencia === null) {
      continue;
    }
    sumaPonderada += criterio.peso * calcularCercaniaEntreNiveles(valorDelRevisor, valorDeReferencia, ESCALA_DE_LOS_NIVELES);
    sumaDePesos += criterio.peso;
    comparaciones.push({ criterioId: criterio.id, nombre: criterio.nombre, diferenciaDeNiveles: Math.abs(valorDelRevisor - valorDeReferencia) });
  }

  return { cercania: sumaDePesos > 0 ? sumaPonderada / sumaDePesos : null, comparaciones };
}

// Frase para quien revisó, sin revelar el nivel que recibió el texto ni su nota.
export function describirLaDiferencia(diferenciaDeNiveles) {
  if (diferenciaDeNiveles === 0) {
    return 'coincidió con la evaluación del docente';
  }
  return diferenciaDeNiveles === 1 ? 'difirió en 1 nivel' : `difirió en ${diferenciaDeNiveles} niveles`;
}

// `revisiones`: una por cada texto que le tocaba, con `valida` (la envió y el docente no la descartó) y
// `cercania` (null si no hay calificación del docente con qué compararla).
export function calcularPuntosDeUnRevisor({ revisiones, puntosPorRevision = PUNTOS_MAXIMOS_POR_REVISION }) {
  const asignadas = revisiones.length;
  const validas = revisiones.filter((revision) => revision.valida);
  const conReferencia = validas.filter((revision) => revision.cercania !== null);

  const cercaniaPromedio =
    conReferencia.length > 0 ? conReferencia.reduce((suma, revision) => suma + revision.cercania, 0) / conReferencia.length : null;
  const acierto = cercaniaPromedio === null ? ACIERTO_SIN_REFERENCIA : corregirAciertoPorAzar(cercaniaPromedio);
  const esfuerzo = asignadas > 0 ? Math.min(1, validas.length / asignadas) : 0;

  return {
    asignadas,
    hechas: validas.length,
    cercaniaPromedio,
    acierto,
    esfuerzo,
    // Dos decimales: suma a la nota de quien revisa para armar el podio.
    puntos: validas.length === 0 ? 0 : Math.round(puntosPorRevision * asignadas * acierto * esfuerzo * 100) / 100,
  };
}
