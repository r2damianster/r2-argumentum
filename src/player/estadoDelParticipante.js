// Selectores locales del participante — ver src/shared/estado/seleccionesDerivadas.js
// para los selectores genéricos compartidos con el host.

export function miOfertaDeTurno(estado, participantId) {
  const oferta = estado.turnos.ofertaActiva;
  return oferta && oferta.candidateId === participantId ? oferta : null;
}

export function tengoElTurnoEnCurso(estado, participantId) {
  return estado.turnos.turnoEnCurso?.participantId === participantId;
}

export function obtenerArgumentosDelTurnoEnCurso(estado) {
  const turnoEnCurso = estado.turnos.turnoEnCurso;
  if (!turnoEnCurso) {
    return [];
  }
  return Object.values(estado.argumentos).filter(
    (argumento) => argumento.participantId === turnoEnCurso.participantId
  );
}

export function misBidsEnviados(estado, participantId) {
  return Object.values(estado.bids).filter((bid) => bid.participantId === participantId);
}
