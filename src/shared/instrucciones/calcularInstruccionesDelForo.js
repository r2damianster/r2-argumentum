// Capa instruccional del foro escrito: «qué está pasando y qué puedo hacer», con la misma forma
// que la del debate hablado (ver calcularInstrucciones.js) para que la pantalla use el mismo
// componente. Función pura.

import { TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';
import { calcularTiempoRestante, formatearCuentaAtras } from '../nucleo/temporizador/calcularTiempoRestante.js';
import { listarRespuestasPendientesParaParticipante } from '../nucleo/conciencia/calcularMetricasDeParticipacion.js';
import { listarAportesParaRevisar } from '../nucleo/revision/colaDeRevision.js';

export function calcularInstruccionesDelForo(estado, participantId, { ahora = Date.now() } = {}) {
  const esCoModerador = estado.participantes[participantId]?.rol === 'co_moderador';
  const fase = estado.fase.actual;

  if (estado.sesion.cerrada) {
    return { ahora: 'El foro terminó. Mira tu resultado.', puedes: [], tienesQue: null };
  }

  if (!fase) {
    return {
      ahora: 'Estás en la sala. El moderador todavía no abre el foro.',
      puedes: ['Esperar: cuando empiece, podrás publicar y responder'],
      tienesQue: null,
    };
  }

  const aportesPorRevisar = esCoModerador ? listarAportesParaRevisar(estado, { revisorId: participantId }).length : 0;
  const pendienteDeRevision =
    aportesPorRevisar > 0
      ? {
          texto: `Tienes ${aportesPorRevisar} aporte(s) asignado(s) por revisar.`,
          consecuencia: 'Tu puntaje de co-moderador depende de cuánto revisas y de qué tanto coincide tu criterio con el del grupo y el moderador.',
        }
      : null;

  if (fase.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING) {
    return {
      ahora: 'La escritura terminó. Quienes moderan están revisando los aportes.',
      puedes: esCoModerador ? ['Seguir revisando los aportes pendientes'] : ['Leer lo publicado', 'Esperar el resultado final'],
      tienesQue: pendienteDeRevision,
    };
  }

  const { restanteMs, haVencido } = calcularTiempoRestante({
    iniciadaEn: fase.iniciadaEn,
    duracionMin: fase.duracionMin,
    extensionesMin: fase.extensionesMin ?? 0,
    ahora,
  });
  const tiempo = haVencido ? 'El tiempo se agotó.' : `Quedan ${formatearCuentaAtras(restanteMs)}.`;

  if (esCoModerador) {
    return {
      ahora: `El foro está abierto. ${tiempo} Eres co-moderador: lees y revisas, no publicas.`,
      puedes: ['Leer el foro', 'Decidir si un aporte cuenta, cuenta parcial o no cuenta', 'Ocultar un aporte fuera de lugar'],
      tienesQue: pendienteDeRevision,
    };
  }

  const respuestasPendientes = listarRespuestasPendientesParaParticipante(estado, participantId).length;
  return {
    ahora: `El foro está abierto. ${tiempo}`,
    puedes: [
      'Publicar un post nuevo con tu postura y una razón',
      'Responder a otra persona: apoyar, contradecir, plantear un dilema o conceder',
      'Reaccionar a lo que te convenció o te hizo dudar',
      ...(respuestasPendientes > 0 ? [`Contestar las ${respuestasPendientes} respuesta(s) que recibiste`] : []),
    ],
    tienesQue: null,
  };
}
