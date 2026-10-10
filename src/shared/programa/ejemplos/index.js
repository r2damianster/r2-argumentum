// Catálogo de Programas de Debate de ejemplo, agrupados por categoría.
// Para agregar uno nuevo: crear el archivo .json (ver docs/03-programa-de-debate.md
// para el esquema completo) e importarlo aquí.

import politicaIzquierdaVsDerecha from './politica-izquierda-vs-derecha.json';
import filosofiaLibreAlbedrioVsDeterminismo from './filosofia-libre-albedrio-vs-determinismo.json';
import filosofiaQueNosHaceHumanos from './filosofia-que-nos-hace-humanos.json';
import educacionUtilidadDeLaInvestigacion from './educacion-utilidad-de-la-investigacion.json';
import historiaEcuadorCausasDelPresente from './historia-ecuador-herencia-global-o-decisiones.json';
import foroIaEnLaUniversidad from './foro-ia-en-la-universidad.json';
import foroFormacionEnInvestigacion from './foro-formacion-en-investigacion.json';
import foroNaranjaMecanicaLibreAlbedrio from './foro-naranja-mecanica-libre-albedrio.json';
import lecturaFormacionEnInvestigacion from './lectura-formacion-en-investigacion.json';
import lecturaRebuildTheResultsSection from './lectura-rebuild-the-results-section.json';

export const PROGRAMAS_DE_EJEMPLO = [
  politicaIzquierdaVsDerecha,
  filosofiaLibreAlbedrioVsDeterminismo,
  filosofiaQueNosHaceHumanos,
  educacionUtilidadDeLaInvestigacion,
  historiaEcuadorCausasDelPresente,
  foroIaEnLaUniversidad,
  foroFormacionEnInvestigacion,
  foroNaranjaMecanicaLibreAlbedrio,
  lecturaFormacionEnInvestigacion,
  lecturaRebuildTheResultsSection,
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
