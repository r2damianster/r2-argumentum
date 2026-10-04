// Capa instruccional del control de lectura: «qué está pasando y qué tengo que hacer». Misma forma que
// la del debate y la del foro ({ ahora, puedes, tienesQue }) para usar el mismo componente. Función pura.

import { DECISIONES_DE_CONFIRMACION, TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';
import { calcularTiempoRestante, formatearCuentaAtras } from '../nucleo/temporizador/calcularTiempoRestante.js';

export function calcularInstruccionesDelControlDeLectura(estado, participantId, _presencia, { ahora = Date.now() } = {}) {
  if (estado.sesion.cerrada) {
    return { ahora: 'La actividad terminó. Mira el podio.', puedes: [], tienesQue: null };
  }

  const fase = estado.fase.actual;
  const entrega = estado.lectura?.entregas?.[participantId] ?? null;

  if (!fase && estado.fase.historial.length === 0) {
    return {
      ahora: 'Estás en la sala. El docente todavía no abre el control de lectura.',
      puedes: ['Esperar: cuando empiece verás la consigna y podrás escribir'],
      tienesQue: null,
    };
  }

  // Revisión entre pares: quien entregó revisa los textos que le tocaron antes de que se acabe el tiempo.
  if (fase?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES) {
    if (!entrega) {
      return {
        ahora: 'Es la revisión entre pares y no entregaste un texto, así que no revisas.',
        puedes: ['Esperar el resultado final'],
        tienesQue: null,
      };
    }
    const { restanteMs, haVencido } = calcularTiempoRestante({
      iniciadaEn: fase.iniciadaEn,
      duracionMin: fase.duracionMin,
      extensionesMin: fase.extensionesMin ?? 0,
      ahora,
    });
    const autoresQueRevisan = Object.keys(estado.lectura?.entregas ?? {}).length;
    const revisionesPedidas = Math.min(estado.programa?.revisionDePares?.revisionesPorPersona ?? 2, Math.max(0, autoresQueRevisan - 1));
    const enviadas = Object.keys(estado.lectura?.revisiones?.[participantId] ?? {}).length;
    const faltan = Math.max(0, revisionesPedidas - enviadas);
    return {
      ahora: haVencido ? 'El tiempo de revisión se agotó.' : `Revisa los textos de tus compañeros. Quedan ${formatearCuentaAtras(restanteMs)}.`,
      puedes: ['Leer cada texto y marcar un nivel por criterio', 'Dejar un comentario para tu compañero (el docente lo aprueba antes)'],
      tienesQue:
        haVencido || faltan === 0
          ? null
          : {
              texto: `Te faltan ${faltan} revisión(es) por enviar.`,
              consecuencia: 'Sumas puntos por revisar bien: cada revisión enviada cuenta, y más si tu criterio coincide con el del docente.',
            },
    };
  }

  if (entrega?.devueltaEn && !entrega.confirmacion) {
    const { restanteMs, haVencido } = calcularTiempoRestante({
      iniciadaEn: entrega.devueltaEn,
      duracionMin: entrega.confirmaHasta ? (entrega.confirmaHasta - entrega.devueltaEn) / 60000 : null,
      ahora,
    });
    return {
      ahora: 'Tu docente te devolvió comentarios sobre tu texto.',
      puedes: ['Leer los comentarios de cada criterio', 'Decir si estás de acuerdo o no'],
      tienesQue: haVencido
        ? null
        : {
            texto: 'Responde si estás de acuerdo con los comentarios.',
            consecuencia:
              restanteMs === null
                ? 'Si no respondes, tu entrega se confirma sola.'
                : `Te quedan ${formatearCuentaAtras(restanteMs)}; si no respondes, tu entrega se confirma sola.`,
          },
    };
  }

  if (entrega?.confirmacion) {
    const respuesta = {
      [DECISIONES_DE_CONFIRMACION.DE_ACUERDO]: 'Dijiste que estás de acuerdo.',
      [DECISIONES_DE_CONFIRMACION.EN_DESACUERDO]: 'Dijiste que no estás de acuerdo: el docente lo revisará.',
      [DECISIONES_DE_CONFIRMACION.AUTOMATICA]: 'Tu entrega se confirmó sola.',
    }[entrega.confirmacion.decision];
    return { ahora: `Listo. ${respuesta}`, puedes: ['Esperar el podio final'], tienesQue: null };
  }

  if (entrega) {
    return {
      ahora: 'Entregaste tu texto. El docente lo está revisando.',
      puedes: ['Esperar la devolución: llegarán comentarios por cada criterio'],
      tienesQue: null,
    };
  }

  if (fase?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA) {
    const { restanteMs, haVencido } = calcularTiempoRestante({
      iniciadaEn: fase.iniciadaEn,
      duracionMin: fase.duracionMin,
      extensionesMin: fase.extensionesMin ?? 0,
      ahora,
    });
    return {
      ahora: haVencido ? 'El tiempo se agotó.' : `Escribe tu texto. Quedan ${formatearCuentaAtras(restanteMs)}.`,
      puedes: ['Escribir con tus propias palabras', 'Seguir la estructura que pide la consigna', 'Enviar cuando termines (no se puede editar después)'],
      tienesQue: haVencido
        ? null
        : {
            texto: 'Envía tu texto antes de que se acabe el tiempo.',
            consecuencia: 'Si el tiempo termina, se envía solo lo que tengas escrito.',
          },
    };
  }

  return {
    ahora: 'El tiempo de escritura terminó y no entregaste un texto.',
    puedes: ['Esperar el resultado final'],
    tienesQue: null,
  };
}
