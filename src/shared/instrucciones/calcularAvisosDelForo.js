// Avisos automáticos para el moderador durante el foro escrito (docs/13). Es la versión del foro de
// calcularAvisos.js: en el foro no hay ruleta ni turnos, así que los avisos hablan de lo que sí
// importa — que se publique, que se responda y que se aproveche el tiempo.

import { TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';
import { analizarBalanceDePosturas } from '../ingreso/reglasDeIngreso.js';
import { calcularTiempoRestante } from '../nucleo/temporizador/calcularTiempoRestante.js';
import {
  MINUTOS_PARA_CONSIDERAR_SIN_DEBATIR,
  calcularMetricasDeParticipacion,
  listarPostsSinDebatir,
} from '../nucleo/conciencia/calcularMetricasDeParticipacion.js';
import { GRAVEDAD } from './calcularAvisos.js';

const MINUTOS_SIN_POSTS_PARA_AVISAR = 2;
const MINUTOS_SIN_INTERVENIR_PARA_AVISAR = 5;
const MAXIMO_DE_NOMBRES_EN_EL_DETALLE = 4;

export function calcularAvisosDelForo(estado, presencia, ahora = Date.now()) {
  if (estado.sesion.cerrada) {
    return [];
  }
  const fase = estado.fase.actual;
  if (fase?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING) {
    return [];
  }

  const avisos = [];
  const nombreDe = (participantId) =>
    presencia.find((presente) => presente.participantId === participantId)?.nombre ?? participantId;
  const unirNombres = (ids) => {
    const nombres = ids.slice(0, MAXIMO_DE_NOMBRES_EN_EL_DETALLE).map(nombreDe).join(', ');
    return ids.length > MAXIMO_DE_NOMBRES_EN_EL_DETALLE ? `${nombres} y ${ids.length - MAXIMO_DE_NOMBRES_EN_EL_DETALLE} más` : nombres;
  };

  const balance = analizarBalanceDePosturas(estado, presencia, estado.programa?.posturas ?? []);
  if (balance.hayDesbalanceExtremo) {
    avisos.push({
      id: 'desbalance-extremo-posturas',
      gravedad: GRAVEDAD.ALTA,
      texto: `Alerta de desbalance: las ${balance.totalConfirmados} personas que entraron están en «${balance.posturaDominanteEtiqueta}».`,
      detalle: 'No hay nadie en la(s) postura(s) opuesta(s): el foro tendría un solo lado.',
    });
  }

  if (fase?.tipo !== TIPOS_DE_FASE.FORO_ESCRITO) {
    return avisos;
  }

  const minutosDesdeElInicio = fase.iniciadaEn ? (ahora - fase.iniciadaEn) / 60000 : 0;
  const metricas = calcularMetricasDeParticipacion(estado);

  if (metricas.totalDePosts === 0 && minutosDesdeElInicio >= MINUTOS_SIN_POSTS_PARA_AVISAR) {
    avisos.push({
      id: 'foro-sin-posts',
      gravedad: GRAVEDAD.MEDIA,
      texto: `Pasaron ${Math.floor(minutosDesdeElInicio)} minutos y nadie ha publicado.`,
      detalle: 'Puedes recordar la pregunta guía en voz alta o pedir que alguien abra el foro.',
    });
  }

  const sinDebatirHaceTiempo = listarPostsSinDebatir(estado, {
    ahora,
    minutosMinimos: MINUTOS_PARA_CONSIDERAR_SIN_DEBATIR,
  });
  if (sinDebatirHaceTiempo.length > 0) {
    avisos.push({
      id: 'posts-sin-debatir',
      gravedad: GRAVEDAD.MEDIA,
      texto: `${sinDebatirHaceTiempo.length} post(s) llevan más de ${MINUTOS_PARA_CONSIDERAR_SIN_DEBATIR} minutos sin que nadie les responda.`,
      detalle: `De: ${unirNombres(sinDebatirHaceTiempo.map((post) => post.participantId))}. Los participantes ya ven el aviso; puedes invitar a la clase a responderles.`,
    });
  }

  if (metricas.debatientesSinIntervenir > 0 && minutosDesdeElInicio >= MINUTOS_SIN_INTERVENIR_PARA_AVISAR) {
    const idsSinIntervenir = Object.values(estado.participantes)
      .filter((participante) => participante.ingresoConfirmado && participante.rol !== 'co_moderador')
      .filter(
        (participante) =>
          !Object.values(estado.argumentos).some((aporte) => aporte.participantId === participante.participantId)
      )
      .map((participante) => participante.participantId);
    avisos.push({
      id: 'sin-intervenir',
      gravedad: GRAVEDAD.ALTA,
      texto: `${idsSinIntervenir.length} persona(s) todavía no han publicado nada.`,
      detalle: `Quedan por participar: ${unirNombres(idsSinIntervenir)}.`,
    });
  }

  const { enAvisoFinal } = calcularTiempoRestante({
    iniciadaEn: fase.iniciadaEn,
    duracionMin: fase.duracionMin,
    extensionesMin: fase.extensionesMin ?? 0,
    ahora,
  });
  if (enAvisoFinal) {
    avisos.push({
      id: 'tiempo-final',
      gravedad: GRAVEDAD.MEDIA,
      texto: 'Quedan menos de 2 minutos de escritura.',
      detalle: 'Si el grupo está en medio de una buena discusión, puedes extender el tiempo.',
    });
  }

  return avisos;
}
