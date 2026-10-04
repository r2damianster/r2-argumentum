import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../estado/reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { calcularInstruccionesDelControlDeLectura } from './calcularInstruccionesDelControlDeLectura.js';

const MINUTO = 60 * 1000;

function sala(...eventos) {
  const base = [
    { name: EVENTOS.INGRESO_CONFIRMADO, data: { participantId: 'ana' }, clientId: 'ana' },
    { name: EVENTOS.FASE_INICIADA, data: { phaseType: 'control_de_lectura', duracionMin: 20, timestamp: 1000 }, clientId: 'host' },
  ];
  return [...base, ...eventos].reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

describe('calcularInstruccionesDelControlDeLectura', () => {
  it('antes de empezar pide esperar', () => {
    const estado = reducirEventos(estadoInicial(), { name: EVENTOS.INGRESO_CONFIRMADO, data: { participantId: 'ana' }, clientId: 'ana' });
    expect(calcularInstruccionesDelControlDeLectura(estado, 'ana', []).ahora).toContain('todavía no abre');
  });

  it('escribiendo: dice cuánto queda y pide enviar antes del cierre', () => {
    const instrucciones = calcularInstruccionesDelControlDeLectura(sala(), 'ana', [], { ahora: 1000 + 5 * MINUTO });
    expect(instrucciones.ahora).toContain('15:00');
    expect(instrucciones.tienesQue.texto).toContain('Envía tu texto');
  });

  it('con el tiempo agotado y sin entrega no hay nada pendiente', () => {
    const instrucciones = calcularInstruccionesDelControlDeLectura(sala(), 'ana', [], { ahora: 1000 + 21 * MINUTO });
    expect(instrucciones.ahora).toBe('El tiempo se agotó.');
    expect(instrucciones.tienesQue).toBeNull();
  });

  it('tras entregar espera la devolución', () => {
    const estado = sala({
      name: EVENTOS.LECTURA_ENTREGA_REGISTRADA,
      data: { participantId: 'ana', palabras: 80, parrafos: 1, timestamp: 5000 },
      clientId: 'ana',
    });
    expect(calcularInstruccionesDelControlDeLectura(estado, 'ana', []).ahora).toContain('Entregaste');
  });

  it('con la devolución pendiente pide responder y avisa que si no, se confirma sola', () => {
    const estado = sala(
      { name: EVENTOS.LECTURA_ENTREGA_REGISTRADA, data: { participantId: 'ana', palabras: 80, parrafos: 1, timestamp: 5000 }, clientId: 'ana' },
      { name: EVENTOS.LECTURA_DEVUELTA, data: { participantId: 'ana', timestamp: 100000, hasta: 100000 + 10 * MINUTO }, clientId: 'host' }
    );
    const instrucciones = calcularInstruccionesDelControlDeLectura(estado, 'ana', [], { ahora: 100000 + 2 * MINUTO });
    expect(instrucciones.tienesQue.texto).toContain('Responde');
    expect(instrucciones.tienesQue.consecuencia).toContain('08:00');
  });

  it('con la actividad cerrada manda al podio', () => {
    const estado = reducirEventos(sala(), { name: EVENTOS.SESION_CERRADA, data: { timestamp: 9 } });
    expect(calcularInstruccionesDelControlDeLectura(estado, 'ana', []).ahora).toContain('podio');
  });
});
