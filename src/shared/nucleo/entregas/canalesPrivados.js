// Canales privados del control de lectura — ver docs/14-control-de-lectura.md.
//
// Todo lo que viaja por el canal de la sala lo puede leer cualquier participante con las herramientas
// del navegador. Por eso el texto de las entregas, las calificaciones y los comentarios van por canales
// aparte, con permisos distintos (las capacidades están en api/ably-token.js):
//
//   debate:entrega:{sala}                 los participantes solo PUBLICAN; lee el host
//   debate:docente:{sala}                 solo el host (su estado privado: calificaciones, aprobaciones…)
//   debate:devolucion:{clientId}:{sala}   publica el host; lee solo ese participante
//
// Lo que sigue es el nombre de los canales y lo que el host exige de cada mensaje antes de aceptarlo.

export const EVENTOS_PRIVADOS = {
  // Participante → host (canal de entregas)
  ENTREGA_TEXTO: 'entrega.texto',
  ENTREGA_CONFIRMACION: 'entrega.confirmacion',
  // La revisión que una persona hace del texto de un par (niveles y comentarios, sin saber de quién es)
  ENTREGA_REVISION_PAR: 'entrega.revision_par',
  // Host → host (canal del docente)
  CALIFICACION_GUARDADA: 'docente.calificacion',
  DEVOLUCION_ENVIADA: 'docente.devolucion',
  RECONSIDERACION_RESUELTA: 'docente.reconsideracion',
  // La sugerencia de Groq para una entrega (anónima; solo la ve el docente)
  SUGERENCIA_DE_IA: 'docente.sugerencia_ia',
  // Qué decidió el docente sobre una marca de integridad: descartarla, dejar una observación o un descuento
  DECISION_DE_INTEGRIDAD: 'docente.integridad',
  // Quién revisa a quién (una sola vez por sesión) y qué decidió el docente de cada revisión de un par
  ASIGNACION_DE_PARES: 'docente.asignacion_pares',
  MODERACION_DE_REVISION: 'docente.moderacion_revision',
  // Host → participante (canal de devolución)
  DEVOLUCION_RECIBIDA: 'devolucion.recibida',
  // Los textos que le tocan revisar a una persona (sin el autor) y, al cerrar, cómo le fue
  REVISION_ASIGNADA: 'revision.asignada',
  RESULTADO_DE_REVISION: 'revision.resultado',
};

export function nombreDelCanalDeEntregas(sessionId) {
  return `debate:entrega:${sessionId}`;
}

export function nombreDelCanalDelDocente(sessionId) {
  return `debate:docente:${sessionId}`;
}

export function nombreDelCanalDeDevolucion(clientId, sessionId) {
  return `debate:devolucion:${clientId}:${sessionId}`;
}

export const MAXIMO_DE_CARACTERES_DE_UNA_ENTREGA = 20000;
export const MAXIMO_DE_CARACTERES_DEL_MOTIVO_DE_DESACUERDO = 600;
export const MAXIMO_DE_CARACTERES_DEL_COMENTARIO_DE_UNA_REVISION = 600;
export const MAXIMO_DE_REVISIONES_POR_PERSONA = 10;

function acotar(valor, maximo) {
  return String(valor ?? '').slice(0, maximo);
}

// Lo que el host acepta de un mensaje del canal de entregas. Devuelve el registro limpio o null si no
// es de fiar: el `clientId` lo pone Ably a partir del token firmado, así que nadie entrega ni confirma
// a nombre de otra persona.
export function procesarMensajeDeEntrega(mensaje) {
  const carga = mensaje?.data;
  if (!carga || typeof carga !== 'object' || !mensaje.clientId || mensaje.clientId !== carga.participantId) {
    return null;
  }

  if (mensaje.name === EVENTOS_PRIVADOS.ENTREGA_TEXTO) {
    const texto = acotar(carga.texto, MAXIMO_DE_CARACTERES_DE_UNA_ENTREGA);
    if (!texto.trim()) {
      return null;
    }
    return {
      nombre: mensaje.name,
      idDelMensaje: mensaje.id ?? `${mensaje.clientId}-${mensaje.timestamp}`,
      participantId: carga.participantId,
      texto,
      enviadoPorTiempo: Boolean(carga.enviadoPorTiempo),
      enviadoEn: Number(mensaje.timestamp ?? carga.enviadoEn ?? 0),
    };
  }

  if (mensaje.name === EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION) {
    return {
      nombre: mensaje.name,
      idDelMensaje: mensaje.id ?? `${mensaje.clientId}-${mensaje.timestamp}`,
      participantId: carga.participantId,
      decision: carga.decision === 'en_desacuerdo' ? 'en_desacuerdo' : 'de_acuerdo',
      motivo: acotar(carga.motivo, MAXIMO_DE_CARACTERES_DEL_MOTIVO_DE_DESACUERDO).trim(),
      enviadoEn: Number(mensaje.timestamp ?? carga.enviadoEn ?? 0),
    };
  }

  if (mensaje.name === EVENTOS_PRIVADOS.ENTREGA_REVISION_PAR) {
    const indice = Math.floor(Number(carga.indice));
    if (!Number.isInteger(indice) || indice < 0 || indice >= MAXIMO_DE_REVISIONES_POR_PERSONA) {
      return null;
    }
    return {
      nombre: mensaje.name,
      idDelMensaje: mensaje.id ?? `${mensaje.clientId}-${mensaje.timestamp}-${indice}`,
      participantId: carga.participantId,
      indice,
      niveles: carga.niveles && typeof carga.niveles === 'object' ? carga.niveles : {},
      comentariosPorCriterio:
        carga.comentariosPorCriterio && typeof carga.comentariosPorCriterio === 'object' ? carga.comentariosPorCriterio : {},
      comentarioGeneral: acotar(carga.comentarioGeneral, MAXIMO_DE_CARACTERES_DEL_COMENTARIO_DE_UNA_REVISION).trim(),
      enviadoEn: Number(mensaje.timestamp ?? carga.enviadoEn ?? 0),
    };
  }

  return null;
}

// Lo que el host acepta del canal del docente: solo lo que publicó él mismo.
export function procesarMensajeDelDocente(mensaje) {
  if (mensaje?.clientId !== 'host' || !mensaje.data || typeof mensaje.data !== 'object') {
    return null;
  }
  const nombresValidos = [
    EVENTOS_PRIVADOS.CALIFICACION_GUARDADA,
    EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA,
    EVENTOS_PRIVADOS.RECONSIDERACION_RESUELTA,
    EVENTOS_PRIVADOS.SUGERENCIA_DE_IA,
    EVENTOS_PRIVADOS.MODERACION_DE_REVISION,
    EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD,
  ];
  // La asignación de pares es de toda la sala: no pertenece a una persona.
  const esGlobal = mensaje.name === EVENTOS_PRIVADOS.ASIGNACION_DE_PARES;
  if (!(esGlobal || (nombresValidos.includes(mensaje.name) && mensaje.data.participantId))) {
    return null;
  }
  return {
    ...mensaje.data,
    nombre: mensaje.name,
    idDelMensaje: mensaje.id ?? `docente-${mensaje.timestamp}-${mensaje.name}-${mensaje.data.participantId}`,
    enviadoEn: Number(mensaje.timestamp ?? mensaje.data.enviadoEn ?? 0),
  };
}
