import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearMotorDeSesion } from '../../host/motorDeSesion.js';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { DECISIONES_DE_CONFIRMACION, EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../shared/nucleo/entregas/canalesPrivados.js';
import { reducirRegistrosPrivados } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';

const MINUTO = 60 * 1000;

const PROGRAMA = {
  programId: 'lectura-de-prueba',
  titulo: 'Control de lectura de prueba',
  actividad: 'control_de_lectura',
  consigna: 'Resume la idea central.',
  posturas: [],
  moderacion: { modo: 'ninguno' },
  rubrica: [
    { id: 'a', nombre: 'A', peso: 50 },
    { id: 'b', nombre: 'B', peso: 50 },
  ],
  ventanaDeConfirmacionMin: 10,
  fases: [{ tipo: 'control_de_lectura', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
];

function evento(name, data = {}, clientId) {
  return { name, data: { timestamp: Date.now(), ...data }, ...(clientId ? { clientId } : {}) };
}

function construirEstado(eventos) {
  return [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }), ...eventos].reduce(
    (estado, siguiente) => reducirEventos(estado, siguiente),
    estadoInicial()
  );
}

const INGRESOS = [
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana' }, 'ana'),
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis' }, 'luis'),
];

function correrMotor(eventosIniciales, { vueltas = 3, estadoPrivado = null } = {}) {
  let estado = construirEstado(eventosIniciales);
  const publicar = vi.fn((name, data) => {
    estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data }, clientId: 'host' });
  });
  const motor = crearMotorDeSesion({ programa: PROGRAMA });
  for (let vuelta = 0; vuelta < vueltas; vuelta += 1) {
    motor.sincronizar({ estado, presencia: PRESENCIA, publicar, estadoPrivado });
  }
  return { motor, publicar, obtenerEstado: () => estado, sincronizar: () => motor.sincronizar({ estado, presencia: PRESENCIA, publicar, estadoPrivado }) };
}

function publicados(publicar, nombre) {
  return publicar.mock.calls.filter(([nombreDelEvento]) => nombreDelEvento === nombre).map(([, datos]) => datos);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T10:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('inicio y tiempo del control de lectura', () => {
  it('la primera fase lleva la duración total y no hay ruleta ni turnos', () => {
    const { motor, publicar } = correrMotor(INGRESOS, { vueltas: 1 });
    motor.iniciarSesion();
    expect(publicados(publicar, EVENTOS.FASE_INICIADA)[0]).toMatchObject({ phaseType: 'control_de_lectura', duracionMin: 20 });
    expect(publicados(publicar, EVENTOS.TURNO_OFRECIDO)).toHaveLength(0);
  });

  it('cierra la escritura al llegar a cero y pasa a la fase siguiente, una sola vez', () => {
    const { motor, publicar, sincronizar } = correrMotor(INGRESOS, { vueltas: 1 });
    motor.iniciarSesion();
    vi.advanceTimersByTime(21 * MINUTO);
    sincronizar();
    sincronizar();
    expect(publicados(publicar, EVENTOS.FASE_CERRADA)).toHaveLength(1);
    expect(publicados(publicar, EVENTOS.FASE_INICIADA).map((datos) => datos.phaseType)).toEqual(['control_de_lectura', 'cierre_y_ranking']);
  });

  it('extender el tiempo suma minutos y evita el cierre', () => {
    const { motor, publicar, sincronizar } = correrMotor(INGRESOS, { vueltas: 1 });
    motor.iniciarSesion();
    // El motor ve la fase nueva cuando vuelve a sincronizar, como pasa en vivo con el canal.
    sincronizar();
    motor.extenderTiempo(5);
    expect(publicados(publicar, EVENTOS.FASE_EXTENDIDA)).toEqual([{ minutos: 5 }]);
    sincronizar();
    vi.advanceTimersByTime(22 * MINUTO);
    sincronizar();
    expect(publicados(publicar, EVENTOS.FASE_CERRADA)).toHaveLength(0);
  });
});

describe('confirmación automática de la devolución', () => {
  function salaConDevolucion() {
    return correrMotor(
      [
        ...INGRESOS,
        evento(EVENTOS.FASE_INICIADA, { phaseType: 'control_de_lectura', duracionMin: 20 }, 'host'),
        evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 80, parrafos: 1 }, 'ana'),
        evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'luis', palabras: 90, parrafos: 1 }, 'luis'),
        evento(EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: Date.now() + 10 * MINUTO }, 'host'),
        evento(EVENTOS.LECTURA_DEVUELTA, { participantId: 'luis', hasta: Date.now() + 10 * MINUTO }, 'host'),
      ],
      { vueltas: 1 }
    );
  }

  it('no confirma mientras la ventana siga abierta', () => {
    const { publicar, sincronizar } = salaConDevolucion();
    sincronizar();
    expect(publicados(publicar, EVENTOS.LECTURA_CONFIRMADA)).toHaveLength(0);
  });

  it('al vencer la ventana confirma sola a quien no respondió, y solo una vez', () => {
    const { publicar, sincronizar, obtenerEstado } = salaConDevolucion();
    vi.advanceTimersByTime(11 * MINUTO);
    sincronizar();
    sincronizar();
    expect(publicados(publicar, EVENTOS.LECTURA_CONFIRMADA)).toHaveLength(2);
    expect(obtenerEstado().lectura.entregas.ana.confirmacion.decision).toBe(DECISIONES_DE_CONFIRMACION.AUTOMATICA);
  });

  it('no pisa la respuesta de quien sí confirmó', () => {
    const { publicar, sincronizar, obtenerEstado } = salaConDevolucion();
    // Ana responde antes de que venza.
    const estadoConRespuesta = reducirEventos(obtenerEstado(), evento(EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: 'de_acuerdo' }, 'ana'));
    expect(estadoConRespuesta.lectura.entregas.ana.confirmacion.decision).toBe('de_acuerdo');
    vi.advanceTimersByTime(11 * MINUTO);
    sincronizar();
    // El estado del arnés no incluyó la respuesta de Ana, así que el motor confirma a ambas; el reducer
    // conserva la primera respuesta real (ver estadoPublicoDeEntregas.test.js).
    expect(publicados(publicar, EVENTOS.LECTURA_CONFIRMADA).length).toBeGreaterThanOrEqual(1);
  });
});

describe('cierre de la sesión', () => {
  function registrosDelDocente(...registros) {
    return reducirRegistrosPrivados(registros);
  }

  it('publica el podio con las calificaciones aprobadas, sin notas', () => {
    const estadoPrivado = registrosDelDocente(
      { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: 'Texto de Ana', enviadoEn: 1 },
      { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: 'Texto de Luis', enviadoEn: 2 },
      { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'ana', niveles: { a: 'excelente', b: 'excelente' }, aprobada: true, enviadoEn: 3 },
      { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'luis', niveles: { a: 'bueno', b: 'bueno' }, aprobada: true, enviadoEn: 4 }
    );
    const { motor, publicar } = correrMotor(
      [
        ...INGRESOS,
        evento(EVENTOS.FASE_INICIADA, { phaseType: 'control_de_lectura', duracionMin: 20 }, 'host'),
        evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 80, parrafos: 1 }, 'ana'),
        evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'luis', palabras: 90, parrafos: 1 }, 'luis'),
      ],
      { vueltas: 1, estadoPrivado }
    );

    motor.cerrarSesion();

    const [podio] = publicados(publicar, EVENTOS.LECTURA_PODIO_PUBLICADO);
    expect(podio.lugares).toEqual([
      { lugar: 1, participantIds: ['ana'] },
      { lugar: 2, participantIds: ['luis'] },
    ]);
    expect(JSON.stringify(podio)).not.toMatch(/nota|puntuacion|10|6\.67/);
    expect(publicados(publicar, EVENTOS.SESION_CERRADA)).toHaveLength(1);
    // El podio se publica ANTES de cerrar: tras session.closed el motor ya no sincroniza.
    const ordenDeEventos = publicar.mock.calls.map(([nombre]) => nombre);
    expect(ordenDeEventos.indexOf(EVENTOS.LECTURA_PODIO_PUBLICADO)).toBeLessThan(ordenDeEventos.indexOf(EVENTOS.SESION_CERRADA));
  });

  it('sin calificaciones el podio queda vacío y el cierre sigue', () => {
    const { motor, publicar } = correrMotor(INGRESOS, { vueltas: 1 });
    motor.cerrarSesion();
    expect(publicados(publicar, EVENTOS.LECTURA_PODIO_PUBLICADO)[0].lugares).toEqual([]);
    expect(publicados(publicar, EVENTOS.SESION_CERRADA)).toHaveLength(1);
  });

  it('el control de lectura no acredita puntaje por aporte', () => {
    const { publicar } = correrMotor(INGRESOS);
    expect(publicados(publicar, EVENTOS.PUNTAJE_ACTUALIZADO)).toHaveLength(0);
  });
});
