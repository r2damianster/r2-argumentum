// Cómo le fue a cada co-moderador, en términos legibles para el informe — ver docs/05-reglas-de-puntaje.md.
// Funciona con cualquier actividad: recibe lo que se revisó en la forma genérica del núcleo.

import { nombreDeParticipante } from '../../estado/seleccionesDerivadas.js';
import {
  calcularPuntajeDeRevisores,
  calcularPuntajeMaximoDeRevisor,
} from '../revision/calcularPuntajeDeRevisores.js';

function aPorcentaje(proporcion) {
  return proporcion === null || proporcion === undefined ? null : Math.round(proporcion * 100);
}

export function describirEvaluacionDeCoModeradores({ revisiones, escala, parametros, presencia = [] }) {
  return calcularPuntajeDeRevisores({
    revisiones,
    escala,
    puntajeMaximo: calcularPuntajeMaximoDeRevisor(parametros),
  })
    .map((revisor) => ({
      coModeradorId: revisor.revisorId,
      nombre: nombreDeParticipante(presencia, revisor.revisorId),
      aportesRevisados: revisor.revisadas,
      aportesConReferencia: revisor.conReferencia,
      cercaniaPromedioPorcentaje: aPorcentaje(revisor.cercaniaPromedio),
      aciertoSobreElAzarPorcentaje: aPorcentaje(revisor.acierto),
      esfuerzoPorcentaje: aPorcentaje(revisor.esfuerzo),
      puntos: revisor.puntos,
    }))
    .sort((revisorA, revisorB) => revisorB.puntos - revisorA.puntos);
}
