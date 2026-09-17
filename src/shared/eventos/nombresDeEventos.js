// Nombres de eventos del canal de Ably — ver docs/09-modelo-de-eventos.md.
// Cambiar aquí, no repetir los strings sueltos en el resto del código.

export const EVENTOS = {
  PROGRAMA_PUBLICADO: 'programa.publicado',

  FASE_INICIADA: 'phase.started',
  FASE_CERRADA: 'phase.closed',

  POSTURA_ASIGNADA: 'stance.assigned',

  COMODERADORES_SELECCIONADOS: 'comod.selected',

  TURNO_OFRECIDO: 'turn.offered',
  TURNO_ACEPTADO: 'turn.accepted',
  TURNO_RECHAZADO: 'turn.rejected',
  TURNO_EXPIRADO: 'turn.timeout',
  TURNO_FORZADO: 'turn.forced',

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
