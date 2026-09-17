// Catálogo de Programas de Debate de ejemplo, agrupados por categoría.
// Para agregar uno nuevo: crear el archivo .json (ver docs/03-programa-de-debate.md
// para el esquema completo) e importarlo aquí.

import politicaIzquierdaVsDerecha from './politica-izquierda-vs-derecha.json';
import filosofiaLibreAlbedrioVsDeterminismo from './filosofia-libre-albedrio-vs-determinismo.json';
import filosofiaQueNosHaceHumanos from './filosofia-que-nos-hace-humanos.json';

export const PROGRAMAS_DE_EJEMPLO = [
  politicaIzquierdaVsDerecha,
  filosofiaLibreAlbedrioVsDeterminismo,
  filosofiaQueNosHaceHumanos,
];

export function agruparProgramasPorCategoria(programas) {
  const grupos = new Map();
  for (const programa of programas) {
    const categoria = programa.categoria || 'Sin categoría';
    if (!grupos.has(categoria)) {
      grupos.set(categoria, []);
    }
    grupos.get(categoria).push(programa);
  }
  return grupos;
}
