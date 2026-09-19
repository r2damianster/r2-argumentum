// Avisos que el moderador ve para intervenir a tiempo, sin tener que mirar cinco paneles.
//
// Aclaración importante (docs/02): esto NO es un keep-alive de Ably. La conexión se mantiene
// sola con los heartbeats del SDK y reconecta sin ayuda; lo que expira es el historial del
// canal, y mandar mensajes periódicos no lo evitaría, solo gastaría cuota. Estos avisos existen
// por una razón pedagógica: que nadie quede fuera del debate sin que el docente se entere.

import { TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';
import { ingresoEstaCerrado } from '../ingreso/reglasDeIngreso.js';
import {
  obtenerArgumentosSinValidar,
  obtenerBidsAbiertos,
  obtenerIntervencionesSinCalificar,
} from '../estado/seleccionesDerivadas.js';

export const GRAVEDAD = {
  ALTA: 'alta',
  MEDIA: 'media',
};

// Cuánto puede pasar sin que alguien intervenga antes de avisarle al moderador.
const MINUTOS_SIN_INTERVENIR_PARA_AVISAR = 6;

export function calcularAvisosParaElModerador(estado, presencia, ahora = Date.now()) {
  if (estado.sesion.cerrada) {
    return [];
  }
  // En el cierre ya no hay ruleta que alimentar ni turnos que pedir: avisar de participantes sin
  // argumento preparado o de casos por revisar solo confunde mientras se muestra el ranking
  // (reporte de prueba en vivo: seguían visibles hasta pulsar "Cerrar debate").
  if (estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING) {
    return [];
  }

  const avisos = [];
  const conectados = presencia.filter((presente) => presente.conectado !== false);
  const nombreDe = (participantId) =>
    conectados.find((presente) => presente.participantId === participantId)?.nombre ?? participantId;

  if (!ingresoEstaCerrado(estado)) {
    const sinConfirmar = conectados.filter(
      (presente) => !estado.participantes[presente.participantId]?.ingresoConfirmado
    );
    if (sinConfirmar.length > 0) {
      avisos.push({
        id: 'ingresos-pendientes',
        gravedad: GRAVEDAD.MEDIA,
        texto: `${sinConfirmar.length} persona(s) están en la sala pero no terminaron su argumento de ingreso.`,
        detalle: `Si inicias ahora, entran como oyentes: ${sinConfirmar.map((p) => p.nombre).join(', ')}.`,
      });
    }
    return avisos;
  }

  // Quien tiene la palabra se quedó sin conexión (cerró la pestaña por error, se le apagó el
  // celular). El motor no ofrece otro turno mientras haya uno abierto, así que sin este aviso el
  // debate parece colgado sin explicación.
  const turnoEnCurso = estado.turnos.turnoEnCurso;
  const hablanteSinConexion = turnoEnCurso
    ? presencia.find((presente) => presente.participantId === turnoEnCurso.participantId)
    : null;
  if (hablanteSinConexion && hablanteSinConexion.conectado === false) {
    avisos.push({
      id: 'turno-sin-conexion',
      gravedad: GRAVEDAD.ALTA,
      texto: `${hablanteSinConexion.nombre ?? turnoEnCurso.participantId} tiene la palabra pero está sin conexión.`,
      detalle:
        'La ruleta no avanza mientras haya un turno abierto. Espera a que vuelva a entrar o usa «Terminar el turno» en la tarjeta de ranking y cierre.',
    });
  }

  const argumentadores = conectados.filter(
    (presente) =>
      estado.participantes[presente.participantId]?.ingresoConfirmado &&
      estado.participantes[presente.participantId]?.rol !== 'co_moderador'
  );

  const sinArgumentoListo = argumentadores.filter(
    (presente) => !estado.participantes[presente.participantId]?.argumentoListo
  );
  // En Conexión libre no hay ruleta ni turnos (solo se conectan argumentos ya publicados), así
  // que "la ruleta no puede ofrecerles la palabra" no aplica. Reporte de prueba en vivo.
  const faseConRuleta = estado.fase.actual?.tipo !== TIPOS_DE_FASE.CONEXION_LIBRE;
  if (sinArgumentoListo.length > 0 && faseConRuleta) {
    avisos.push({
      id: 'sin-argumento-preparado',
      gravedad: GRAVEDAD.MEDIA,
      texto: `${sinArgumentoListo.length} participante(s) no tienen ningún argumento preparado.`,
      detalle: `Mientras no preparen uno, la ruleta no puede ofrecerles la palabra: ${sinArgumentoListo
        .map((p) => p.nombre)
        .join(', ')}.`,
    });
  }

  const minutosDesdeElInicio = minutosTranscurridos(estado.fase.actual?.iniciadaEn, ahora);
  const sinIntervenir = argumentadores.filter(
    (presente) => (estado.participantes[presente.participantId]?.intervenciones ?? 0) === 0
  );
  if (sinIntervenir.length > 0 && minutosDesdeElInicio >= MINUTOS_SIN_INTERVENIR_PARA_AVISAR) {
    avisos.push({
      id: 'sin-intervenir',
      gravedad: GRAVEDAD.ALTA,
      texto: `${sinIntervenir.length} participante(s) todavía no han tomado la palabra.`,
      detalle: `El debate no debería cerrarse sin que intervengan: ${sinIntervenir
        .map((p) => p.nombre)
        .join(', ')}.`,
    });
  }

  const pendientesDeCoModeracion =
    obtenerArgumentosSinValidar(estado).length +
    obtenerBidsAbiertos(estado).length +
    obtenerIntervencionesSinCalificar(estado).length;
  const hayCoModeradores = (estado.coModeradores?.participantIds.length ?? 0) > 0;

  if (pendientesDeCoModeracion > 0 && hayCoModeradores) {
    avisos.push({
      id: 'comoderacion-pendiente',
      gravedad: GRAVEDAD.MEDIA,
      texto: `${pendientesDeCoModeracion} caso(s) esperando revisión de los co-moderadores.`,
      detalle: `Recuérdales revisar: ${estado.coModeradores.participantIds.map(nombreDe).join(', ')}.`,
    });
  }

  if (pendientesDeCoModeracion > 0 && !hayCoModeradores) {
    avisos.push({
      id: 'sin-comoderadores',
      gravedad: GRAVEDAD.MEDIA,
      texto: 'No hay co-moderadores en esta sesión y hay casos por revisar.',
      detalle: 'El puntaje base se acredita igual; solo faltan los bonos y las reclasificaciones.',
    });
  }

  return avisos;
}

function minutosTranscurridos(desde, ahora) {
  if (!desde) {
    return 0;
  }
  return (ahora - desde) / 60000;
}
