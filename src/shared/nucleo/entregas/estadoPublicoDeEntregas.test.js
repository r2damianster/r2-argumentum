import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { DECISIONES_DE_CONFIRMACION, EVENTOS, TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { contarAvanceDeLasEntregas, idDeLaEntrega } from './estadoPublicoDeEntregas.js';

function aplicar(estado, name, data, clientId) {
  return reducirEventos(estado, { name, data, ...(clientId ? { clientId } : {}) });
}

function salaConEscrituraAbierta() {
  let estado = estadoInicial();
  estado = aplicar(estado, EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', nombre: 'Ana', emoji: '🦊' }, 'ana');
  estado = aplicar(estado, EVENTOS.INGRESO_CONFIRMADO, { participantId: 'beto', nombre: 'Beto', emoji: '🐼' }, 'beto');
  estado = aplicar(
    estado,
    EVENTOS.FASE_INICIADA,
    { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: 20, timestamp: 1000 },
    'host'
  );
  return estado;
}

describe('entregas en el estado público', () => {
  it('registra una entrega con sus conteos y sin texto', () => {
    const estado = aplicar(
      salaConEscrituraAbierta(),
      EVENTOS.LECTURA_ENTREGA_REGISTRADA,
      { participantId: 'ana', palabras: 120, parrafos: 2, timestamp: 5000, texto: 'no debería guardarse' },
      'ana'
    );
    const entrega = estado.lectura.entregas.ana;
    expect(entrega).toMatchObject({ entregaId: idDeLaEntrega('ana'), palabras: 120, parrafos: 2, enviadaPorTiempo: false });
    expect(JSON.stringify(estado.lectura)).not.toContain('no debería guardarse');
  });

  it('no se puede entregar dos veces: la primera manda', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 500, parrafos: 5 }, 'ana');
    expect(estado.lectura.entregas.ana.palabras).toBe(50);
  });

  it('nadie entrega a nombre de otra persona ni sin haber ingresado', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'beto');
    estado = aplicar(estado, EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'intruso', palabras: 50, parrafos: 1 }, 'intruso');
    expect(estado.lectura.entregas).toEqual({});
  });

  it('con la escritura cerrada solo entra una entrega por tiempo, y dentro del margen', () => {
    let estado = salaConEscrituraAbierta();
    estado = aplicar(estado, EVENTOS.FASE_CERRADA, { phaseType: TIPOS_DE_FASE.CONTROL_DE_LECTURA, timestamp: 100000 }, 'host');

    const tarde = aplicar(estado, EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1, timestamp: 100500 }, 'ana');
    expect(tarde.lectura.entregas).toEqual({});

    const porTiempo = aplicar(
      estado,
      EVENTOS.LECTURA_ENTREGA_REGISTRADA,
      { participantId: 'ana', palabras: 50, parrafos: 1, enviadoPorTiempo: true, timestamp: 100500 },
      'ana'
    );
    expect(porTiempo.lectura.entregas.ana.enviadaPorTiempo).toBe(true);

    const demasiadoTarde = aplicar(
      estado,
      EVENTOS.LECTURA_ENTREGA_REGISTRADA,
      { participantId: 'ana', palabras: 50, parrafos: 1, enviadoPorTiempo: true, timestamp: 100000 + 5 * 60 * 1000 },
      'ana'
    );
    expect(demasiadoTarde.lectura.entregas).toEqual({});
  });

  it('solo el host devuelve, y la confirmación solo vale tras la devolución', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');

    const sinDevolver = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.DE_ACUERDO }, 'ana');
    expect(sinDevolver.lectura.entregas.ana.confirmacion).toBeNull();

    const devueltaPorOtro = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 9000 }, 'beto');
    expect(devueltaPorOtro.lectura.entregas.ana.devueltaEn).toBeNull();

    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 9000, timestamp: 7000 }, 'host');
    expect(estado.lectura.entregas.ana).toMatchObject({ devueltaEn: 7000, confirmaHasta: 9000 });

    estado = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.EN_DESACUERDO }, 'ana');
    expect(estado.lectura.entregas.ana.confirmacion.decision).toBe(DECISIONES_DE_CONFIRMACION.EN_DESACUERDO);

    // La primera respuesta manda.
    estado = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.DE_ACUERDO }, 'ana');
    expect(estado.lectura.entregas.ana.confirmacion.decision).toBe(DECISIONES_DE_CONFIRMACION.EN_DESACUERDO);
  });

  it('la confirmación automática la publica solo el host; la propia, solo la persona', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 9000, timestamp: 7000 }, 'host');

    const automaticaFalsa = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.AUTOMATICA }, 'ana');
    expect(automaticaFalsa.lectura.entregas.ana.confirmacion).toBeNull();

    const propiaDeOtro = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.DE_ACUERDO }, 'beto');
    expect(propiaDeOtro.lectura.entregas.ana.confirmacion).toBeNull();

    const automaticaReal = aplicar(estado, EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: DECISIONES_DE_CONFIRMACION.AUTOMATICA }, 'host');
    expect(automaticaReal.lectura.entregas.ana.confirmacion.decision).toBe(DECISIONES_DE_CONFIRMACION.AUTOMATICA);
  });

  it('una devolución revisada no reabre la ventana de confirmación', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 9000, timestamp: 7000 }, 'host');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 99999, timestamp: 8000, revisada: true }, 'host');
    expect(estado.lectura.entregas.ana).toMatchObject({ devueltaEn: 7000, confirmaHasta: 9000, devolucionRevisada: true });
  });

  it('el podio solo lo publica el host y no lleva notas', () => {
    const lugares = [{ lugar: 1, participantIds: ['ana'], nota: 9.5 }];
    const deUnEstudiante = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_PODIO_PUBLICADO, { lugares }, 'ana');
    expect(deUnEstudiante.lectura.podio).toBeNull();

    const deLaHost = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_PODIO_PUBLICADO, { lugares }, 'host');
    expect(deLaHost.lectura.podio).toEqual([{ lugar: 1, participantIds: ['ana'] }]);
  });

  it('cuenta el avance de la clase', () => {
    let estado = aplicar(salaConEscrituraAbierta(), EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 50, parrafos: 1 }, 'ana');
    estado = aplicar(estado, EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 9000, timestamp: 7000 }, 'host');
    expect(contarAvanceDeLasEntregas(estado)).toMatchObject({
      participantes: 2,
      entregaron: 1,
      escribiendo: 1,
      devueltas: 1,
      confirmadas: 0,
    });
  });
});
