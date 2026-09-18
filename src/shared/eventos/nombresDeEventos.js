// Nombres de eventos del canal de Ably — ver docs/09-modelo-de-eventos.md.
// Cambiar aquí, no repetir los strings sueltos en el resto del código.

export const EVENTOS = {
  PROGRAMA_PUBLICADO: 'programa.publicado',

  FASE_INICIADA: 'phase.started',
  FASE_CERRADA: 'phase.closed',

  // Máquina de rondas dentro de la fase apertura_simultanea — ver docs/09.
  APERTURA_RONDA_INICIADA: 'apertura.ronda_iniciada',
  APERTURA_RONDA_EXTENDIDA: 'apertura.ronda_extendida',
  APERTURA_RONDA_CERRADA: 'apertura.ronda_cerrada',

  POSTURA_ASIGNADA: 'stance.assigned',

  // Ingreso con argumento obligatorio (ver docs/09): el participante existe para el debate
  // recién cuando confirma su ingreso con un argumento aprobado.
  INGRESO_CONFIRMADO: 'ingreso.confirmado',

  // Propuesta de postura fuera de la lista — solo si el Programa tiene permitirPosturasNuevas.
  POSTURA_PROPUESTA: 'stance.proposed',
  POSTURA_DECISION_MODERADOR: 'stance.decision_moderador',

  COMODERADORES_SELECCIONADOS: 'comod.selected',

  TURNO_OFRECIDO: 'turn.offered',
  TURNO_ACEPTADO: 'turn.accepted',
  TURNO_RECHAZADO: 'turn.rejected',
  TURNO_EXPIRADO: 'turn.timeout',
  TURNO_FORZADO: 'turn.forced',

  // "Tengo un argumento escrito y aprobado, esperando mi turno para defenderlo". El turno se
  // ofrece SOLO a quien publicó esto: no es una invitación a escribir (ver docs/04).
  ARGUMENTO_LISTO: 'argument.ready',

  // Intervención hablada sin argumento escrito, para quienes no alcanzaron a preparar uno y
  // todavía no tomaron la palabra. La califica un co-moderador después.
  INTERVENCION_VERBAL_REGISTRADA: 'intervencion_verbal.registrada',
  INTERVENCION_VERBAL_CALIFICADA: 'intervencion_verbal.calificada',

  ARGUMENTO_INTENTO: 'argument.submit_attempt',
  ARGUMENTO_RESULTADO_VALIDACION: 'argument.validation_result',
  ARGUMENTO_PUBLICADO: 'argument.submitted',
  ARGUMENTO_VALIDADO: 'argument.validated',

  CONEXION_CREADA: 'link.created',
  CONEXION_SUGERIDA: 'link.suggested',
  SUGERENCIA_RESUELTA: 'link.suggestion_resolved',

  BID_ENVIADO: 'bid.submitted',
  BID_VOTO_COMODERADOR: 'bid.vote_comoderador',
  BID_EVALUACION_EXPIRADA: 'bid.evaluacion_expirada',
  TOPICO_BIDS_CERRADOS: 'topic.bids_cerrados',
  BID_DECISION_MODERADOR: 'bid.decision_moderador',

  PUNTAJE_ACTUALIZADO: 'score.updated',

  SESION_CERRADA: 'session.closed',
};

export const TIPOS_DE_BID = {
  DESMONTAR: 'desmontar',
  FORTALECER: 'fortalecer',
};

export const TIPOS_DE_FASE = {
  // Todos escriben su argumento inicial en paralelo (sin ruleta) — ver docs/09.
  APERTURA_SIMULTANEA: 'apertura_simultanea',
  ESCRITURA_ARGUMENTOS: 'escritura_argumentos',
  CONEXION_SUGERIDA: 'conexion_sugerida',
  CONEXION_LIBRE: 'conexion_libre',
  CIERRE_Y_RANKING: 'cierre_y_ranking',
};

export const TIPOS_DE_RELACION = {
  NUEVO: 'nuevo',
  CONTRAARGUMENTO: 'contraargumento',
  REFUERZO: 'refuerzo',
  DILEMA: 'dilema',
  PREGUNTA: 'pregunta',
  CONCESION: 'concesion',
  CONEXION: 'conexion',
};
