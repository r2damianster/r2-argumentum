import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { combinarParticipantesConPresencia } from './seleccionesDerivadas.js';

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('turnos rechazados por participante', () => {
  it('cuenta el total aunque la racha se haya cortado al aceptar un turno', () => {
    const estado = [
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't2', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't2', participantId: 'ana' }),
    ].reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());

    const [ana] = combinarParticipantesConPresencia(estado, [{ participantId: 'ana', nombre: 'Ana' }]);

    expect(ana.rechazosAcumulados).toBe(0);
    expect(ana.turnosRechazadosEnTotal).toBe(1);
  });
});
