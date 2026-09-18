// Reglas del ingreso con argumento obligatorio (ver docs/09).
//
// El participante existe para el debate recién cuando confirma su ingreso con un argumento
// aprobado. Quien entra a la sala pero no lo completa queda como OYENTE: ve todo el debate,
// no recibe turnos y no puntúa, y puede convertirse en participante si completa su argumento
// antes de que el moderador cierre el ingreso.

export function ingresoEstaCerrado(estado) {
  return estado.fase.actual !== null || estado.fase.historial.length > 0;
}

export function esOyente(estado, participantId) {
  return !estado.participantes[participantId]?.ingresoConfirmado;
}

export function participantesConIngresoConfirmado(estado, presencia) {
  return presencia
    .filter((presente) => presente.conectado !== false)
    .filter((presente) => estado.participantes[presente.participantId]?.ingresoConfirmado);
}

export function oyentes(estado, presencia) {
  return presencia
    .filter((presente) => presente.conectado !== false)
    .filter((presente) => !estado.participantes[presente.participantId]?.ingresoConfirmado);
}

// Con asignacionPostura "aleatoria" el Programa quiere que el estudiante defienda una postura
// que no eligió (ejercicio clásico de debate). Como ahora el ingreso ocurre antes de que el
// host inicie la sesión, la asignación se resuelve en el cliente: se elige la postura menos
// representada entre quienes ya confirmaron, para que los bandos queden parejos sin que nadie
// coordine nada. Ante empate, se desempata al azar para no dar siempre la primera de la lista.
export function elegirPosturaMenosRepresentada(estado, posturas, azar = Math.random) {
  if (posturas.length === 0) {
    return null;
  }

  const conteoPorPostura = new Map(posturas.map((postura) => [postura.id, 0]));
  for (const participante of Object.values(estado.participantes)) {
    if (!participante.ingresoConfirmado || !participante.stanceId) {
      continue;
    }
    if (conteoPorPostura.has(participante.stanceId)) {
      conteoPorPostura.set(participante.stanceId, conteoPorPostura.get(participante.stanceId) + 1);
    }
  }

  const minimo = Math.min(...conteoPorPostura.values());
  const candidatas = posturas.filter((postura) => conteoPorPostura.get(postura.id) === minimo);
  return candidatas[Math.floor(azar() * candidatas.length)].id;
}

// El debate no puede cerrarse hasta que cada participante haya intervenido al menos una vez,
// sea por argumento escrito o por turno hablado (decisión del usuario, ver docs/04). Los
// oyentes no cuentan: nunca entraron al debate.
export function participantesSinIntervenir(estado, presencia) {
  return participantesConIngresoConfirmado(estado, presencia)
    .filter((presente) => estado.participantes[presente.participantId]?.rol !== 'co_moderador')
    .filter((presente) => (estado.participantes[presente.participantId]?.intervenciones ?? 0) === 0)
    .map((presente) => presente.participantId);
}

export function seAlcanzoElMinimoDeParticipacion(estado, presencia) {
  return participantesSinIntervenir(estado, presencia).length === 0;
}
