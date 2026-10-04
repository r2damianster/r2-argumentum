// Nombres de eventos del canal de Ably — ver docs/09-modelo-de-eventos.md.
// Cambiar aquí, no repetir los strings sueltos en el resto del código.

export const EVENTOS = {
  PROGRAMA_PUBLICADO: 'programa.publicado',

  FASE_INICIADA: 'phase.started',
  FASE_CERRADA: 'phase.closed',



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
  // El moderador da por terminado el turno en curso (quien hablaba cerró la pestaña, se
  // desconectó o simplemente no publicó su argumento). Sin esto el turno en curso bloquea la
  // ruleta para siempre: el motor no ofrece otra palabra mientras haya un turno abierto.
  TURNO_TERMINADO_POR_HOST: 'turn.ended_by_host',
  TURNO_RULETA_PAUSADA: 'turn.roulette_paused',
  TURNO_RULETA_REANUDADA: 'turn.roulette_resumed',

  // "Tengo un argumento escrito y aprobado, esperando mi turno para defenderlo". El turno se
  // ofrece SOLO a quien publicó esto: no es una invitación a escribir (ver docs/04).
  ARGUMENTO_LISTO: 'argument.ready',

  // Quien tiene la palabra anuncia el texto del argumento que va a defender, para que el resto
  // (proyección incluida) lo vea destacado mientras empieza a hablar. El argumento como tal
  // se sigue publicando al terminar (`argument.submitted`).
  ARGUMENTO_EN_EXPOSICION: 'argument.presenting',

  // El argumento aprobado ya está publicado (y puntuando) desde que Groq lo aprobó; el turno
  // es para exponerlo en voz alta. Quien lo expuso avisa que terminó, y mientras habla los
  // co-moderadores lo califican. El moderador puede evaluar (opcional) y revisa todo al cierre;
  // los ajustes de puntaje se aplican al cerrar la sesión (ver docs/04, docs/05 y docs/09).
  EXPOSICION_TERMINADA: 'exposicion.terminada',
  EXPOSICION_CALIFICADA: 'exposicion.calificada',
  EXPOSICION_EVALUADA_POR_MODERADOR: 'exposicion.evaluada_moderador',

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

  // Actividades escritas, como el foro (ver docs/13-foro-escrito-y-nucleo-reutilizable.md).
  // El moderador suma minutos a la fase en curso.
  FASE_EXTENDIDA: 'fase.extendida',
  // Una reacción con sentido a un aporte («me convenció», «me hizo dudar»…): una por persona y por
  // aporte; publicar otra reemplaza la anterior y `tipo: null` la quita.
  REACCION_REGISTRADA: 'reaccion.registrada',
  // Moderador y co-moderadores pueden ocultar un aporte; solo el moderador lo restaura. Sigue en el
  // log, no se ve y no puntúa.
  APORTE_OCULTADO: 'aporte.ocultado',
  APORTE_RESTAURADO: 'aporte.restaurado',
  // Un co-moderador decide si un aporte cuenta (1), cuenta parcial (0,5) o no cuenta (0); el moderador
  // decide con la última palabra (o descarta las de los co-moderadores). Se aplica al cerrar.
  REVISION_REGISTRADA: 'revision.registrada',
  REVISION_DECIDIDA_POR_MODERADOR: 'revision.decidida_moderador',

  // Control de lectura (ver docs/14-control-de-lectura.md). Por el canal de la sala viajan SOLO
  // estados y contadores: el texto, los comentarios y las notas van por canales privados.
  // La entrega de una persona: cuántas palabras y párrafos tiene, sin el texto.
  LECTURA_ENTREGA_REGISTRADA: 'lectura.entrega_registrada',
  // El docente devolvió la calificación (los comentarios van por el canal privado del estudiante).
  LECTURA_DEVUELTA: 'lectura.devuelta',
  // El estudiante respondió «de acuerdo» o «no estoy de acuerdo»; la confirma sola el host al vencer la ventana.
  LECTURA_CONFIRMADA: 'lectura.confirmada',
  // Una revisión entre pares enviada (cuál de las que le tocaban, sin contenido).
  LECTURA_REVISION_ENVIADA: 'lectura.revision_enviada',
  // Quiénes ocupan los primeros lugares del podio. Sin notas.
  LECTURA_PODIO_PUBLICADO: 'lectura.podio_publicado',

  SESION_CERRADA: 'session.closed',
};

// Cómo se califica la exposición oral de un argumento ya publicado. "sin_exposicion" es la
// respuesta a «¿está hablando?»: si no habló, cuenta como la peor calificación.
export const CALIDADES_DE_EXPOSICION = {
  BUENA: 'buena',
  ACEPTABLE: 'aceptable',
  INSUFICIENTE: 'insuficiente',
  SIN_EXPOSICION: 'sin_exposicion',
};

// Qué hizo el moderador con las calificaciones de los co-moderadores de una exposición.
export const DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION = {
  EVALUADA: 'evaluada',
  DESCARTADA: 'descartada',
  SIN_EVALUAR: 'sin_evaluar',
};

export const TIPOS_DE_BID = {
  DESMONTAR: 'desmontar',
  FORTALECER: 'fortalecer',
};

export const TIPOS_DE_FASE = {
  ESCRITURA_ARGUMENTOS: 'escritura_argumentos',
  // Fase única del foro escrito: posts y réplicas libres durante un tiempo total.
  FORO_ESCRITO: 'foro_escrito',
  // Fases del control de lectura: escribir (con tiempo total) y revisar entre pares (con tiempo propio).
  CONTROL_DE_LECTURA: 'control_de_lectura',
  REVISION_DE_PARES: 'revision_de_pares',
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

// Reacciones con sentido a un aporte. No hay «me gusta» genérico: premiaría popularidad y la
// plataforma premia estructura argumental. «Me convenció» de alguien de la postura contraria es
// el «convencimiento cruzado» (se cuenta y se muestra al moderador, sin puntos en la v1).
export const TIPOS_DE_REACCION = {
  ME_CONVENCIO: 'me_convencio',
  ME_HIZO_DUDAR: 'me_hizo_dudar',
  APORTA_EVIDENCIA: 'aporta_evidencia',
};

// Qué respondió el estudiante a la devolución de su entrega.
export const DECISIONES_DE_CONFIRMACION = {
  DE_ACUERDO: 'de_acuerdo',
  EN_DESACUERDO: 'en_desacuerdo',
  // La puso el host al vencer la ventana sin que la persona respondiera.
  AUTOMATICA: 'automatica',
};
