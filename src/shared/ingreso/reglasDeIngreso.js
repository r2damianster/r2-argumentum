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

// Reparte los empates por el lugar que ocupa cada persona en la sala, no al azar. Con azar
// puro, ocho estudiantes que abren la pantalla a la vez ven la sala igual de vacía y sortean
// cada uno por su cuenta: en prueba en vivo quedaron 5-2-1, y con dos personas ambas en el
// mismo bando, o sea un debate de un solo lado. Ordenando los ids de quienes están conectados
// y repartiendo por turnos, cada cliente llega al mismo reparto sin que nadie coordine nada.
//
// Un id que todavía no figura en la sala (presencia recién llegando) cae al final del orden.
function lugarEnLaSala(participantId, participantesEnLaSala) {
  const ordenados = [...new Set(participantesEnLaSala)].sort();
  const lugar = ordenados.indexOf(participantId);
  return lugar >= 0 ? lugar : ordenados.length;
}

// Con asignacionPostura "aleatoria" el Programa quiere que el estudiante defienda una postura
// que no eligió (ejercicio clásico de debate). Como el ingreso ocurre antes de que el host
// inicie la sesión, la asignación se resuelve en el cliente: se elige la postura menos
// representada entre quienes ya confirmaron, para que los bandos queden parejos sin que nadie
// coordine nada. Ante empate manda el lugar de cada quien en la sala.
export function elegirPosturaMenosRepresentada(
  estado,
  posturas,
  { participantId = '', participantesEnLaSala = [] } = {}
) {
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

  const sinConfirmarEnLaSala = [...new Set(participantesEnLaSala)]
    .filter((id) => !estado.participantes[id]?.ingresoConfirmado)
    .sort();

  for (const idActual of sinConfirmarEnLaSala) {
    const minimo = Math.min(...conteoPorPostura.values());
    const candidatas = posturas.filter((postura) => conteoPorPostura.get(postura.id) === minimo);
    const lugar = sinConfirmarEnLaSala.indexOf(idActual);
    const posturaElegida = candidatas[lugar % candidatas.length].id;

    if (idActual === participantId) {
      return posturaElegida;
    }
    conteoPorPostura.set(posturaElegida, (conteoPorPostura.get(posturaElegida) ?? 0) + 1);
  }

  const minimo = Math.min(...conteoPorPostura.values());
  const candidatas = posturas.filter((postura) => conteoPorPostura.get(postura.id) === minimo);
  return candidatas[lugarEnLaSala(participantId, participantesEnLaSala) % candidatas.length].id;
}

// Solo para la asignación ALEATORIA (modo Rolplay), donde el reparto tiene que ser equitativo.
// Como cada cliente elige su postura con lo que ya sabe, dos personas que confirman casi a la vez
// pueden calcular con un conteo viejo y dejar los bandos desparejos (1/3/4 con 8 personas en una
// prueba en vivo). Por eso, justo antes de confirmar se comprueba el cupo: ninguna postura puede
// pasar de ceil(personas en la sala / posturas). Si ya lo llenó, se sugiere la menos representada.
// En «libre» y «por argumento» no se usa: una sola persona defendiendo un punto no es problema.
export function verificarCupoDePostura(estado, posturas, stanceId, { participantId = '', participantesEnLaSala = [] } = {}) {
  const idsDeLaSala = new Set(participantesEnLaSala);
  for (const [id, participante] of Object.entries(estado.participantes)) {
    if (participante.ingresoConfirmado) {
      idsDeLaSala.add(id);
    }
  }
  idsDeLaSala.add(participantId);

  const conteoPorPostura = new Map(posturas.map((postura) => [postura.id, 0]));
  for (const [id, participante] of Object.entries(estado.participantes)) {
    if (id === participantId || !participante.ingresoConfirmado || !conteoPorPostura.has(participante.stanceId)) {
      continue;
    }
    conteoPorPostura.set(participante.stanceId, conteoPorPostura.get(participante.stanceId) + 1);
  }

  const cupo = Math.ceil(idsDeLaSala.size / posturas.length);
  if (!conteoPorPostura.has(stanceId) || conteoPorPostura.get(stanceId) < cupo) {
    return { permitida: true, posturaSugerida: stanceId, cupo };
  }
  const minimo = Math.min(...conteoPorPostura.values());
  const posturaSugerida = posturas.find((postura) => conteoPorPostura.get(postura.id) === minimo).id;
  return { permitida: false, posturaSugerida, cupo };
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

// Analiza la distribución de posturas entre los participantes con ingreso confirmado para
// detectar si todos se ubican en una misma postura (desbalance monopostura 100%).
export function analizarBalanceDePosturas(estado, presencia, posturas = []) {
  const confirmados = participantesConIngresoConfirmado(estado, presencia);
  const totalConfirmados = confirmados.length;
  const conteoMap = new Map((posturas ?? []).map((p) => [p.id, 0]));

  for (const c of confirmados) {
    const stanceId = estado.participantes[c.participantId]?.stanceId;
    if (stanceId) {
      conteoMap.set(stanceId, (conteoMap.get(stanceId) ?? 0) + 1);
    }
  }

  const posturasConConteo = [...conteoMap.entries()].filter(([, count]) => count > 0);
  const hayDesbalanceExtremo = totalConfirmados >= 2 && posturasConConteo.length === 1;

  let posturaDominanteId = null;
  let posturaDominanteEtiqueta = '';
  if (posturasConConteo.length === 1) {
    posturaDominanteId = posturasConConteo[0][0];
    posturaDominanteEtiqueta =
      (posturas ?? []).find((p) => p.id === posturaDominanteId)?.etiqueta ?? posturaDominanteId;
  }

  return {
    hayDesbalanceExtremo,
    totalConfirmados,
    posturaDominanteId,
    posturaDominanteEtiqueta,
    conteoPorPostura: Object.fromEntries(conteoMap),
  };
}
