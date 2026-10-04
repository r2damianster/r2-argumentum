// Conciencia del grupo: qué tanto se está debatiendo de verdad — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Todo se deriva del estado que ya reconstruye el reducer (argumentos y conexiones), sin eventos
// nuevos y sin conocer ninguna actividad: sirve para el foro escrito y para lo que venga.
//
//   post     = aporte que no responde a ningún otro
//   réplica  = aporte que apunta a otro (tiene una conexión saliente hacia un argumento ajeno)
//   «sin debatir» = post al que todavía nadie más le ha respondido (responderse a uno mismo no cuenta)

export const MINUTOS_PARA_CONSIDERAR_SIN_DEBATIR = 2;

function aportesVisibles(estado) {
  return Object.values(estado.argumentos ?? {}).filter((argumento) => !argumento.oculto);
}

function esDebatiente(participante) {
  return Boolean(participante.ingresoConfirmado) && participante.rol !== 'co_moderador';
}

// Para cada aporte, a qué otro aporte responde (o nada si es un post). El objetivo viaja dentro del
// propio aporte (`argumentoObjetivoId`) y además llega como conexión: se leen las dos fuentes para
// no depender del orden en que lleguen los eventos (el aporte puede verse un instante antes que
// su conexión).
export function indexarObjetivosDeRespuesta(estado, argumentosPorId) {
  const objetivoPorAporte = {};
  const registrarSiEsAjeno = (idDelOrigen, idDelDestino) => {
    const origen = argumentosPorId[idDelOrigen];
    const destino = argumentosPorId[idDelDestino];
    if (origen && destino && origen.participantId !== destino.participantId) {
      objetivoPorAporte[idDelOrigen] = idDelDestino;
    }
  };
  for (const argumento of Object.values(argumentosPorId)) {
    if (argumento.argumentoObjetivoId) {
      registrarSiEsAjeno(argumento.argumentId, argumento.argumentoObjetivoId);
    }
  }
  for (const conexion of Object.values(estado.conexiones ?? {})) {
    registrarSiEsAjeno(conexion.sourceArgumentId, conexion.targetArgumentId);
  }
  return objetivoPorAporte;
}

export function indexarPorId(argumentos) {
  return Object.fromEntries(argumentos.map((argumento) => [argumento.argumentId, argumento]));
}

export function clasificarAportes(estado) {
  const argumentos = aportesVisibles(estado);
  const argumentosPorId = indexarPorId(argumentos);
  const objetivoPorAporte = indexarObjetivosDeRespuesta(estado, argumentosPorId);

  const replicas = argumentos.filter((argumento) => objetivoPorAporte[argumento.argumentId]);
  const posts = argumentos.filter((argumento) => !objetivoPorAporte[argumento.argumentId]);

  const respuestasPorPost = {};
  for (const replica of replicas) {
    const idDelObjetivo = objetivoPorAporte[replica.argumentId];
    respuestasPorPost[idDelObjetivo] = (respuestasPorPost[idDelObjetivo] ?? 0) + 1;
  }

  return { posts, replicas, objetivoPorAporte, respuestasPorPost };
}

// Lugar que ocupa un aporte entre los del mismo tipo (posts o réplicas) de su autor, contando desde 1
// y por orden de publicación. Cuenta también los aportes ocultados: el orden no se corre porque
// alguien oculte uno, así el puntaje provisional de cada aporte no cambia después de acreditarse.
export function calcularOrdinalDelTipo(estado, aporte) {
  const todos = Object.values(estado.argumentos ?? {});
  const argumentosPorId = indexarPorId(todos);
  const objetivoPorAporte = indexarObjetivosDeRespuesta(estado, argumentosPorId);
  const esReplica = Boolean(objetivoPorAporte[aporte.argumentId]);

  const delMismoTipo = todos
    .filter((otro) => otro.participantId === aporte.participantId)
    .filter((otro) => Boolean(objetivoPorAporte[otro.argumentId]) === esReplica)
    .sort((aporteA, aporteB) => (aporteA.timestamp ?? 0) - (aporteB.timestamp ?? 0) || aporteA.argumentId.localeCompare(aporteB.argumentId));

  return { esReplica, ordinalDelTipo: delMismoTipo.findIndex((otro) => otro.argumentId === aporte.argumentId) + 1 };
}

export function calcularMetricasDeParticipacion(estado) {
  const { posts, replicas, respuestasPorPost } = clasificarAportes(estado);
  const debatientes = Object.values(estado.participantes ?? {}).filter(esDebatiente);

  const idsDeQuienesEscribieron = new Set([...posts, ...replicas].map((aporte) => aporte.participantId));
  const postsSinDebatir = posts.filter((post) => !respuestasPorPost[post.argumentId]);

  return {
    totalDePosts: posts.length,
    totalDeReplicas: replicas.length,
    totalDeDebatientes: debatientes.length,
    postsPorDebatiente: debatientes.length > 0 ? posts.length / debatientes.length : 0,
    replicasPorPost: posts.length > 0 ? replicas.length / posts.length : 0,
    postsSinDebatir: postsSinDebatir.length,
    porcentajeDePostsSinDebatir: posts.length > 0 ? Math.round((postsSinDebatir.length / posts.length) * 100) : 0,
    debatientesSinIntervenir: debatientes.filter((participante) => !idsDeQuienesEscribieron.has(participante.participantId))
      .length,
  };
}

// Posts que esperan respuesta, el más antiguo primero. Si se indica `postura`, los de otra postura
// van antes: se sugiere responder a quien piensa distinto, pero es un empujón, no una asignación.
export function listarPostsSinDebatir(
  estado,
  { ahora = Date.now(), minutosMinimos = 0, posturaDeQuienPregunta = null, participantIdDeQuienPregunta = null } = {}
) {
  const { posts, respuestasPorPost } = clasificarAportes(estado);
  return posts
    .filter((post) => !respuestasPorPost[post.argumentId])
    .filter((post) => post.participantId !== participantIdDeQuienPregunta)
    .map((post) => ({
      ...post,
      minutosEsperando: Math.max(0, Math.floor((ahora - (post.timestamp ?? ahora)) / 60000)),
      esDeOtraPostura: Boolean(posturaDeQuienPregunta) && post.stanceId !== posturaDeQuienPregunta,
    }))
    .filter((post) => post.minutosEsperando >= minutosMinimos)
    .sort((postA, postB) => {
      if (postA.esDeOtraPostura !== postB.esDeOtraPostura) {
        return postA.esDeOtraPostura ? -1 : 1;
      }
      return (postA.timestamp ?? 0) - (postB.timestamp ?? 0);
    });
}

// Respuestas que recibí y a las que todavía no contesté: el derecho a réplica.
export function listarRespuestasPendientesParaParticipante(estado, participantId) {
  const { replicas, objetivoPorAporte } = clasificarAportes(estado);
  const argumentos = aportesVisibles(estado);
  const argumentosPorId = indexarPorId(argumentos);

  const respuestasRecibidas = replicas.filter(
    (replica) => argumentosPorId[objetivoPorAporte[replica.argumentId]]?.participantId === participantId
  );
  return respuestasRecibidas.filter((respuesta) => {
    const contestada = replicas.some(
      (replica) =>
        replica.participantId === participantId &&
        objetivoPorAporte[replica.argumentId] === respuesta.argumentId &&
        (replica.timestamp ?? 0) >= (respuesta.timestamp ?? 0)
    );
    return !contestada;
  });
}
