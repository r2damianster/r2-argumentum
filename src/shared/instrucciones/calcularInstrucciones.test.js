import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from '../estado/reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { calcularInstruccionesDelParticipante, URGENCIA } from './calcularInstrucciones.js';

const PROGRAMA = {
  titulo: 'Debate de prueba',
  posturas: [
    { id: 'izquierda', etiqueta: 'Más estado' },
    { id: 'derecha', etiqueta: 'Más mercado' },
  ],
  perfilDePuntaje: 'estandar',
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function construirEstado(eventos) {
  return [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }), ...eventos].reduce(
    (estado, siguiente) => reducirEventos(estado, siguiente),
    estadoInicial()
  );
}

// Atajo: sesión ya iniciada con Ana y Luis dentro del debate.
function estadoEnDebate(eventosExtra = []) {
  return construirEstado([
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ...eventosExtra,
  ]);
}

describe('antes de que empiece el debate', () => {
  it('a quien no confirmó su ingreso le exige el argumento y le avisa el costo', () => {
    const estado = construirEstado([]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue.urgencia).toBe(URGENCIA.OBLIGATORIO);
    expect(instrucciones.tienesQue.texto).toContain('postura');
    expect(instrucciones.tienesQue.consecuencia).toContain('oyente');
  });

  it('a quien ya confirmó le dice que espere, sin nada obligatorio', () => {
    const estado = construirEstado([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue).toBeNull();
    expect(instrucciones.ahora).toContain('Esperando');
  });
});

describe('durante el debate', () => {
  it('sin argumento preparado, lo obligatorio es prepararlo', () => {
    const instrucciones = calcularInstruccionesDelParticipante(estadoEnDebate(), 'ana', PRESENCIA);

    expect(instrucciones.tienesQue.texto).toContain('Prepara un argumento');
    expect(instrucciones.tienesQue.consecuencia).toContain('no se te ofrece la palabra');
  });

  it('con el argumento listo ya no hay nada obligatorio, solo esperar', () => {
    const estado = estadoEnDebate([evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' })]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue).toBeNull();
    expect(instrucciones.puedes).toContain('Esperar tu turno: tu argumento ya está listo');
  });

  it('al ofrecerle la palabra le dice cuánto cuesta rechazarla', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 20000 }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    // Perfil estándar: la penalidad por rechazar son 20 puntos.
    expect(instrucciones.tienesQue.consecuencia).toContain('20');
  });

  it('narra quién está hablando para los demás', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'luis', expiraEn: Date.now() + 1 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'luis' }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.ahora).toBe('Luis está defendiendo su argumento.');
    expect(instrucciones.puedes).toContain(
      'Pedir una intervención para desmontar o fortalecer lo que se está diciendo'
    );
  });

  it('distingue una intervención hablada de una defensa de argumento', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'luis', expiraEn: 1, modo: 'verbal' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'luis' }),
    ]);

    expect(calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA).ahora).toContain('viva voz');
  });

  it('a quien tiene la palabra le dice que la defienda, no que escriba', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: 1 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue.texto).toContain('defiende en voz alta');
  });
});

describe('co-moderador', () => {
  it('le marca como obligatorio lo que tiene pendiente de revisar', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['luis'], totalParticipantes: 2 }),
      evento(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, { intervencionId: 'v1', participantId: 'ana', turnId: 't1' }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'luis', PRESENCIA);

    expect(instrucciones.tienesQue.texto).toContain('1 caso');
  });

  it('sin pendientes no le inventa tareas', () => {
    const estado = estadoEnDebate([
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['luis'], totalParticipantes: 2 }),
    ]);

    expect(calcularInstruccionesDelParticipante(estado, 'luis', PRESENCIA).tienesQue).toBeNull();
  });
});

describe('oyente', () => {
  it('no recibe tareas obligatorias, solo mirar', () => {
    const estado = construirEstado([
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue).toBeNull();
    expect(instrucciones.puedes).toEqual(['Seguir el debate como oyente']);
  });
});

describe('sesión cerrada', () => {
  it('deja de pedir cosas', () => {
    const estado = estadoEnDebate([evento(EVENTOS.SESION_CERRADA, {})]);

    const instrucciones = calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA);

    expect(instrucciones.tienesQue).toBeNull();
    expect(instrucciones.ahora).toContain('terminó');
  });
});
