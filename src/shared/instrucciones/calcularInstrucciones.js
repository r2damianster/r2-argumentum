// Qué está pasando y qué tiene que hacer una persona, en cada momento del debate.
//
// Es una función PURA del estado derivado: la misma llamada con otro participantId devuelve lo
// que esa otra persona ve, y por eso alimenta tanto la pantalla del estudiante como la vista
// espejo del moderador (docs/07). Nadie tiene que adivinar si le toca escribir, escuchar o
// prepararse.

import { TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';
import { ingresoEstaCerrado } from '../ingreso/reglasDeIngreso.js';
import { calcularPenalidadPorRechazoDeTurno, resolverParametrosDePuntaje } from '../puntaje/formulaDePuntaje.js';
import {
  obtenerArgumentosSinValidar,
  obtenerBidsAbiertos,
  obtenerSugerenciasVisiblesParaParticipante,
  misArgumentosSinConexionSaliente,
  nombreDeParticipante,
} from '../estado/seleccionesDerivadas.js';

export const URGENCIA = {
  OBLIGATORIO: 'obligatorio',
  OPCIONAL: 'opcional',
};

export function calcularInstruccionesDelParticipante(estado, participantId, presencia = []) {
  const participante = estado.participantes[participantId];
  const esCoModerador = participante?.rol === 'co_moderador';
  const ingresoConfirmado = Boolean(participante?.ingresoConfirmado);
  const sesionCerrada = estado.sesion.cerrada || estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING;

  if (sesionCerrada) {
    return {
      ahora: 'El debate terminó. Se está mostrando el resultado final.',
      puedes: ['Revisar el mapa de argumentos y tu puntaje'],
      tienesQue: null,
    };
  }

  if (!ingresoEstaCerrado(estado)) {
    return instruccionesDeIngreso(estado, participantId, ingresoConfirmado);
  }

  return {
    ahora: describirQuePasa(estado, presencia),
    puedes: accionesOpcionales(estado, participantId, esCoModerador, ingresoConfirmado),
    tienesQue: accionObligatoria(estado, participantId, esCoModerador, ingresoConfirmado),
  };
}

function instruccionesDeIngreso(estado, participantId, ingresoConfirmado) {
  if (ingresoConfirmado) {
    return {
      ahora: 'Ya estás dentro del debate. Esperando a que el moderador lo inicie.',
      puedes: ['Leer el tema y las posturas mientras esperas'],
      tienesQue: null,
    };
  }

  return {
    ahora: 'Todavía no estás en el debate: falta tu argumento de ingreso.',
    puedes: [],
    tienesQue: {
      texto: 'Elegir tu postura y escribir un argumento que la defienda.',
      consecuencia: 'Si el debate empieza sin tu argumento, entras como oyente: sin turnos y sin puntaje.',
      urgencia: URGENCIA.OBLIGATORIO,
    },
  };
}

function describirQuePasa(estado, presencia) {
  const { turnoEnCurso, ofertaActiva } = estado.turnos;

  if (turnoEnCurso) {
    const nombre = nombreDeParticipante(presencia, turnoEnCurso.participantId);
    return turnoEnCurso.modo === 'verbal'
      ? `${nombre} está interviniendo de viva voz, sin argumento escrito.`
      : `${nombre} está defendiendo su argumento.`;
  }

  if (ofertaActiva) {
    return `Se le ofreció la palabra a ${nombreDeParticipante(presencia, ofertaActiva.candidateId)}.`;
  }

  if (estado.fase.actual?.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA) {
    return 'Todos están escribiendo su argumento inicial al mismo tiempo.';
  }

  return 'Nadie tiene la palabra ahora mismo. Se está por sortear el próximo turno.';
}

function accionObligatoria(estado, participantId, esCoModerador, ingresoConfirmado) {
  if (!ingresoConfirmado) {
    return null;
  }

  const oferta = estado.turnos.ofertaActiva;
  if (oferta?.candidateId === participantId) {
    const penalidad = calcularPenalidadPorRechazoDeTurno(resolverParametrosDePuntaje(estado.programa));
    return {
      texto:
        oferta.modo === 'verbal'
          ? 'Te ofrecieron la palabra para intervenir hablando. Acepta o rechaza.'
          : 'Te ofrecieron la palabra para defender tu argumento. Acepta o rechaza.',
      consecuencia: `Rechazar cuesta ${Math.abs(penalidad)} puntos.`,
      urgencia: URGENCIA.OBLIGATORIO,
    };
  }

  const turno = estado.turnos.turnoEnCurso;
  if (turno?.participantId === participantId) {
    return turno.modo === 'verbal'
      ? {
          texto: 'Tienes la palabra: comparte tu idea en voz alta y marca cuando termines.',
          consecuencia: 'Un co-moderador va a calificar lo que digas.',
          urgencia: URGENCIA.OBLIGATORIO,
        }
      : {
          texto: 'Tienes la palabra: defiende en voz alta el argumento que preparaste.',
          consecuencia: 'Al terminar, publícalo para que quede en el mapa.',
          urgencia: URGENCIA.OBLIGATORIO,
        };
  }

  if (esCoModerador) {
    const pendientes =
      obtenerArgumentosSinValidar(estado).length +
      obtenerBidsAbiertos(estado).length +
      Object.values(estado.intervencionesVerbales).filter((intervencion) => !intervencion.calificacion).length;
    if (pendientes > 0) {
      return {
        texto: `Tienes ${pendientes} caso(s) esperando tu revisión en el panel de co-moderador.`,
        consecuencia: 'Mientras no los resuelvas, el debate avanza sin esa calificación.',
        urgencia: URGENCIA.OBLIGATORIO,
      };
    }
    return null;
  }

  if (!estado.participantes[participantId]?.argumentoListo) {
    return {
      texto: 'Prepara un argumento para entrar a la ruleta de turnos.',
      consecuencia: 'Sin un argumento preparado no se te ofrece la palabra.',
      urgencia: URGENCIA.OBLIGATORIO,
    };
  }

  return null;
}

function accionesOpcionales(estado, participantId, esCoModerador, ingresoConfirmado) {
  if (!ingresoConfirmado) {
    return ['Seguir el debate como oyente'];
  }

  const opciones = [];

  if (esCoModerador) {
    opciones.push('Revisar argumentos y votar las intervenciones pedidas');
    return opciones;
  }

  const turno = estado.turnos.turnoEnCurso;
  const tengoLaPalabra = turno?.participantId === participantId;

  if (estado.participantes[participantId]?.argumentoListo && !tengoLaPalabra) {
    opciones.push('Esperar tu turno: tu argumento ya está listo');
  }

  if (turno && !tengoLaPalabra) {
    opciones.push('Pedir una intervención para desmontar o fortalecer lo que se está diciendo');
  }

  if (misArgumentosSinConexionSaliente(estado, participantId).length > 0) {
    opciones.push('Conectar alguno de tus argumentos con otro del mapa');
  }

  if (obtenerSugerenciasVisiblesParaParticipante(estado, participantId).length > 0) {
    opciones.push('Resolver las conexiones que sugirió la IA sobre tus argumentos');
  }

  return opciones;
}
