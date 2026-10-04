// Sesión completa del control de lectura, de punta a punta y sin red: el reducer del log público, el
// estado privado del docente y el motor del host trabajando juntos, como en una clase real.
//
// Lo que NO cubre: el transporte (Ably real), que solo se puede comprobar en producción. Lo que sí cubre
// es que lo público nunca contiene texto ni notas, que la nota solo existe en el estado privado y que el
// flujo entrega → calificación → devolución → confirmación → podio cierra bien en cada escenario.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearMotorDeSesion } from '../../host/motorDeSesion.js';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { DECISIONES_DE_CONFIRMACION, EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS, procesarMensajeDeEntrega, procesarMensajeDelDocente } from '../../shared/nucleo/entregas/canalesPrivados.js';
import {
  ESTADOS_DE_CALIFICACION,
  construirColaDelDocente,
  construirDevolucionParaElEstudiante,
  reducirRegistrosPrivados,
} from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { resolverRubricaDelPrograma } from '../../shared/nucleo/rubrica/rubrica.js';
import {
  DECISIONES_SOBRE_UNA_REVISION,
  calcularPuntosDeRevisores,
  construirRevisionesDeUnAutor,
  listarRevisionesAprobadasParaElAutor,
  prepararTextosParaRevisar,
} from '../../shared/nucleo/entregas/revisionesEntrePares.js';
import { asignarRevisionesEntrePares } from '../../shared/nucleo/revisionEntrePares/asignarRevisionesEntrePares.js';
import { armarProgramaDeLaSesionDeLectura, programaPublicable } from './programaDeLectura.js';
import { construirInformeDeLectura } from './informeDeLectura.js';

const MINUTO = 60 * 1000;

const PROGRAMA_BASE = {
  programId: 'lectura-completa',
  titulo: 'Control de lectura',
  temaCentral: 'Tema',
  actividad: 'control_de_lectura',
  consigna: 'Resume la idea central.',
  estructura: 'peel',
  clavesDeLaLectura: 'clave secreta',
  rubrica: [
    { id: 'a', nombre: 'Pertinencia', peso: 50 },
    { id: 'b', nombre: 'Estructura', peso: 50 },
  ],
  fases: [{ tipo: 'control_de_lectura', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};
const PROGRAMA_COMPLETO = armarProgramaDeLaSesionDeLectura({ programaBase: PROGRAMA_BASE, idioma: 'es', ventanaDeConfirmacionMin: 10 });
const PROGRAMA_PUBLICO = programaPublicable(PROGRAMA_COMPLETO);
const RUBRICA = resolverRubricaDelPrograma(PROGRAMA_PUBLICO);

const PROGRAMA_CON_PARES = armarProgramaDeLaSesionDeLectura({
  programaBase: PROGRAMA_BASE,
  idioma: 'es',
  revisionDePares: { activa: true, revisionesPorPersona: 2, duracionMin: 8 },
});

const PRESENCIA = ['ana', 'beto', 'carla'].map((participantId) => ({ participantId, nombre: participantId, conectado: true }));

// Una sala simulada: el log público (con el clientId que pondría Ably) y los dos canales privados.
function crearSala(programaCompleto = PROGRAMA_COMPLETO) {
  let estado = estadoInicial();
  const registrosPrivados = [];
  let reloj = 1;

  function publicar(name, data, clientId = 'host') {
    estado = reducirEventos(estado, { name, data: { timestamp: Date.now(), ...data }, clientId });
  }
  function publicarPrivado(procesar, name, data, clientId) {
    const registro = procesar({ name, data, clientId, id: `m${reloj}`, timestamp: Date.now() + reloj });
    reloj += 1;
    if (registro) {
      registrosPrivados.push(registro);
    }
  }

  const motor = crearMotorDeSesion({ programa: programaCompleto });
  function latido() {
    motor.sincronizar({
      estado,
      presencia: PRESENCIA,
      publicar: (name, data) => publicar(name, data),
      estadoPrivado: reducirRegistrosPrivados(registrosPrivados),
    });
  }

  publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa: programaPublicable(programaCompleto), identificadorDeSesion: 's1' });

  return {
    motor,
    latido,
    // El motor necesita ver el estado antes de actuar y volver a verlo después, como pasa en vivo.
    iniciar: () => {
      latido();
      motor.iniciarSesion();
      latido();
    },
    estado: () => estado,
    estadoPrivado: () => reducirRegistrosPrivados(registrosPrivados),
    ingresar: (participantId) => publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, nombre: participantId, emoji: '🦊' }, participantId),
    // Lo que hace el estudiante: texto por el canal privado y conteos por el público.
    entregar: (participantId, texto, extra = {}) => {
      publicarPrivado(procesarMensajeDeEntrega, EVENTOS_PRIVADOS.ENTREGA_TEXTO, { participantId, texto, ...extra }, participantId);
      publicar(
        EVENTOS.LECTURA_ENTREGA_REGISTRADA,
        { participantId, palabras: texto.split(/\s+/).length, parrafos: 1, ...extra },
        participantId
      );
    },
    // Lo que hace el docente.
    calificar: (participantId, datos) =>
      publicarPrivado(procesarMensajeDelDocente, EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, { participantId, ...datos }, 'host'),
    devolver: (participantId, hasta = Date.now() + 10 * MINUTO) => {
      publicarPrivado(procesarMensajeDelDocente, EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA, { participantId, hasta }, 'host');
      publicar(EVENTOS.LECTURA_DEVUELTA, { participantId, hasta });
    },
    responder: (participantId, decision, motivo = '') => {
      publicarPrivado(procesarMensajeDeEntrega, EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, { participantId, decision, motivo }, participantId);
      publicar(EVENTOS.LECTURA_CONFIRMADA, { participantId, decision }, participantId);
    },
    publicarHost: publicar,
    // Revisión entre pares: el docente reparte, los pares revisan y el docente decide qué llega al autor.
    asignarPares: (asignaciones) =>
      publicarPrivado(procesarMensajeDelDocente, EVENTOS_PRIVADOS.ASIGNACION_DE_PARES, { asignaciones }, 'host'),
    revisar: (revisorId, indice, niveles, comentarios = {}) => {
      publicarPrivado(
        procesarMensajeDeEntrega,
        EVENTOS_PRIVADOS.ENTREGA_REVISION_PAR,
        { participantId: revisorId, indice, niveles, comentariosPorCriterio: comentarios },
        revisorId
      );
      publicar(EVENTOS.LECTURA_REVISION_ENVIADA, { participantId: revisorId, indice }, revisorId);
    },
    moderar: (autorId, revisorId, datos) =>
      publicarPrivado(
        procesarMensajeDelDocente,
        EVENTOS_PRIVADOS.MODERACION_DE_REVISION,
        { participantId: autorId, revisorId, ...datos },
        'host'
      ),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T10:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('sesión completa del control de lectura', () => {
  it('lo público nunca contiene el texto, los comentarios, los niveles ni la nota', () => {
    const sala = crearSala();
    ['ana', 'beto'].forEach(sala.ingresar);
    sala.iniciar();
    sala.entregar('ana', 'TEXTO-PRIVADO-DE-ANA sobre la investigación');
    sala.calificar('ana', {
      niveles: { a: 'excelente', b: 'bueno' },
      comentariosPorCriterio: { a: 'COMENTARIO-PRIVADO' },
      comentarioGeneral: 'GENERAL-PRIVADO',
      aprobada: true,
    });
    sala.devolver('ana');
    sala.responder('ana', DECISIONES_DE_CONFIRMACION.EN_DESACUERDO, 'MOTIVO-PRIVADO');
    sala.latido();
    sala.motor.cerrarSesion();

    const publico = JSON.stringify(sala.estado());
    for (const secreto of ['TEXTO-PRIVADO', 'COMENTARIO-PRIVADO', 'GENERAL-PRIVADO', 'MOTIVO-PRIVADO', 'clave secreta', '8.33']) {
      expect(publico, secreto).not.toContain(secreto);
    }
  });

  it('flujo feliz: entregan, el docente califica y devuelve, confirman y el podio sale sin notas', () => {
    const sala = crearSala();
    ['ana', 'beto', 'carla'].forEach(sala.ingresar);
    sala.iniciar();

    sala.entregar('ana', 'Ana explica la idea central con evidencia clara');
    sala.entregar('beto', 'Beto responde de forma breve');
    sala.calificar('ana', { niveles: { a: 'excelente', b: 'excelente' }, aprobada: true });
    sala.calificar('beto', { niveles: { a: 'bueno', b: 'aceptable' }, aprobada: true });
    sala.devolver('ana');
    sala.devolver('beto');
    sala.responder('ana', DECISIONES_DE_CONFIRMACION.DE_ACUERDO);

    // Beto no responde: la ventana vence y se confirma sola.
    vi.advanceTimersByTime(11 * MINUTO);
    sala.latido();
    // Carla nunca entregó: queda sin entrega.
    expect(sala.estado().lectura.entregas.beto.confirmacion.decision).toBe(DECISIONES_DE_CONFIRMACION.AUTOMATICA);
    expect(sala.estado().lectura.entregas.carla).toBeUndefined();

    sala.latido();
    sala.motor.cerrarSesion();
    expect(sala.estado().sesion.cerrada).toBe(true);
    expect(sala.estado().lectura.podio).toEqual([
      { lugar: 1, participantIds: ['ana'] },
      { lugar: 2, participantIds: ['beto'] },
    ]);

    const informe = construirInformeDeLectura({
      estado: sala.estado(),
      estadoPrivado: sala.estadoPrivado(),
      programa: PROGRAMA_COMPLETO,
      presencia: PRESENCIA,
    });
    const filaDe = (id) => informe.personas.find((persona) => persona.participantId === id);
    expect(filaDe('ana').nota).toBe(10);
    expect(filaDe('beto').nota).toBe(5);
    expect(filaDe('carla').estadoDeLaEntrega).toBe('sin_entrega');
  });

  it('empate exacto: comparten lugar', () => {
    const sala = crearSala();
    ['ana', 'beto'].forEach(sala.ingresar);
    sala.iniciar();
    for (const id of ['ana', 'beto']) {
      sala.entregar(id, `Texto de ${id} con contenido`);
      sala.calificar(id, { niveles: { a: 'bueno', b: 'bueno' }, aprobada: true });
    }
    sala.latido();
    sala.motor.cerrarSesion();
    expect(sala.estado().lectura.podio).toEqual([{ lugar: 1, participantIds: ['ana', 'beto'] }]);
  });

  it('una calificación solo en borrador no entra al podio ni al informe como nota', () => {
    const sala = crearSala();
    ['ana'].forEach(sala.ingresar);
    sala.iniciar();
    sala.entregar('ana', 'Texto de Ana con contenido');
    sala.calificar('ana', { niveles: { a: 'excelente', b: 'excelente' }, aprobada: false });
    sala.latido();
    sala.motor.cerrarSesion();
    expect(sala.estado().lectura.podio).toEqual([]);
  });

  it('desacuerdo: el motivo llega solo al estado privado y el docente reconsidera una vez', () => {
    const sala = crearSala();
    ['ana'].forEach(sala.ingresar);
    sala.iniciar();
    sala.entregar('ana', 'Texto de Ana con contenido');
    sala.calificar('ana', { niveles: { a: 'aceptable', b: 'aceptable' }, comentariosPorCriterio: { a: 'Falta evidencia.' }, aprobada: true });
    sala.devolver('ana');
    sala.responder('ana', DECISIONES_DE_CONFIRMACION.EN_DESACUERDO, 'Sí cité una evidencia.');

    const itemAntes = construirColaDelDocente({ estadoPrivado: sala.estadoPrivado(), estado: sala.estado(), rubrica: RUBRICA })[0];
    expect(itemAntes.motivoDeDesacuerdo).toBe('Sí cité una evidencia.');
    expect(itemAntes.reconsideracion).toBeNull();

    // El docente cambia la calificación y responde: nueva devolución «revisada», sin reabrir la ventana.
    sala.calificar('ana', { niveles: { a: 'bueno', b: 'aceptable' }, comentariosPorCriterio: { a: 'Tienes razón, sí hay evidencia.' }, aprobada: true });
    sala.publicarHost(EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: Date.now() + 99 * MINUTO, revisada: true });
    const itemDespues = construirColaDelDocente({ estadoPrivado: sala.estadoPrivado(), estado: sala.estado(), rubrica: RUBRICA })[0];
    expect(itemDespues.estadoDeCalificacion).toBe(ESTADOS_DE_CALIFICACION.APROBADA);
    expect(itemDespues.devolucionRevisada).toBe(true);
    expect(construirDevolucionParaElEstudiante({ rubrica: RUBRICA, calificacion: itemDespues.calificacion }).criterios[0].comentario).toBe(
      'Tienes razón, sí hay evidencia.'
    );
    // La ventana original manda: no se reabrió.
    expect(sala.estado().lectura.entregas.ana.confirmaHasta).toBeLessThan(Date.now() + 11 * MINUTO);
  });

  it('un estudiante no puede entregar por otro ni colar un texto privado sin entrega pública', () => {
    const sala = crearSala();
    ['ana', 'beto'].forEach(sala.ingresar);
    sala.iniciar();

    // Beto intenta entregar a nombre de Ana por los dos canales.
    sala.publicarHost(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 5, parrafos: 1 }, 'beto');
    expect(sala.estado().lectura.entregas.ana).toBeUndefined();

    // Un texto privado sin su entrega pública no aparece en la cola del docente.
    const registroColado = procesarMensajeDeEntrega({
      name: EVENTOS_PRIVADOS.ENTREGA_TEXTO,
      clientId: 'beto',
      data: { participantId: 'beto', texto: 'Texto sin entrega pública' },
    });
    const cola = construirColaDelDocente({
      estadoPrivado: reducirRegistrosPrivados([registroColado]),
      estado: sala.estado(),
      rubrica: RUBRICA,
    });
    expect(cola).toEqual([]);
  });

  it('entrega por tiempo: al cerrarse la escritura todavía se acepta el borrador enviado', () => {
    const sala = crearSala();
    ['ana'].forEach(sala.ingresar);
    sala.iniciar();
    vi.advanceTimersByTime(21 * MINUTO);
    sala.latido();
    sala.latido();
    expect(sala.estado().fase.actual.tipo).toBe('cierre_y_ranking');

    sala.entregar('ana', 'Borrador enviado al terminar el tiempo', { enviadoPorTiempo: true });
    expect(sala.estado().lectura.entregas.ana.enviadaPorTiempo).toBe(true);

    // Una entrega normal fuera de tiempo no entra.
    sala.ingresar('beto');
    sala.entregar('beto', 'Entrega tardía normal');
    expect(sala.estado().lectura.entregas.beto).toBeUndefined();
  });
});

describe('sesión completa con revisión entre pares', () => {
  const MEJOR = { a: 'excelente', b: 'excelente' };
  const REGULAR = { a: 'aceptable', b: 'aceptable' };

  function salaEnRevision() {
    const sala = crearSala(PROGRAMA_CON_PARES);
    ['ana', 'beto', 'carla'].forEach(sala.ingresar);
    sala.iniciar();
    ['ana', 'beto', 'carla'].forEach((id) => sala.entregar(id, `Texto de ${id} sobre la idea central`));
    sala.calificar('ana', { niveles: MEJOR, aprobada: true });
    sala.calificar('beto', { niveles: MEJOR, aprobada: true });
    sala.calificar('carla', { niveles: REGULAR, aprobada: true });
    // Se cierra la escritura y arranca la revisión entre pares.
    sala.latido();
    sala.motor.cerrarFaseActual();
    sala.latido();
    return sala;
  }

  it('las fases son escritura, revisión y cierre', () => {
    const sala = salaEnRevision();
    expect(sala.estado().fase.actual).toMatchObject({ tipo: 'revision_de_pares', duracionMin: 8 });
  });

  it('el flujo completo: reparto, revisiones, aprobación del docente, devolución con comentarios de pares y podio con bonus', () => {
    const sala = salaEnRevision();
    const { asignaciones } = asignarRevisionesEntrePares({ autoresIds: ['ana', 'beto', 'carla'], revisionesPorPersona: 2 });
    sala.asignarPares(asignaciones);

    // Cada revisor recibe los textos que le tocan, sin el autor.
    for (const revisor of ['ana', 'beto', 'carla']) {
      const textos = prepararTextosParaRevisar({ estadoPrivado: sala.estadoPrivado(), revisorId: revisor });
      expect(textos).toHaveLength(2);
      // Nadie revisa su propio texto, y lo único que llega son índice y texto: ni el autor ni su id.
      expect(textos.map((texto) => texto.texto)).not.toContain(`Texto de ${revisor} sobre la idea central`);
      expect(Object.keys(textos[0]).sort()).toEqual(['indice', 'texto']);
    }

    // Ana y beto revisan bien (como el docente); carla revisa al revés.
    const autoresDe = (revisor) => asignaciones[revisor];
    for (const revisor of ['ana', 'beto', 'carla']) {
      autoresDe(revisor).forEach((autorId, indice) => {
        const referencia = autorId === 'carla' ? REGULAR : MEJOR;
        const niveles = revisor === 'carla' ? { a: 'insuficiente', b: 'insuficiente' } : referencia;
        sala.revisar(revisor, indice, niveles, { a: `Comentario de ${revisor} sobre ${autorId}` });
      });
    }
    expect(sala.estado().lectura.revisiones.ana).toBeDefined();

    // El docente aprueba la revisión que recibió ana de su primer revisor y descarta la de carla.
    const args = (autorId) => ({ estadoPrivado: sala.estadoPrivado(), estado: sala.estado(), rubrica: RUBRICA, autorId });
    const recibidasPorAna = construirRevisionesDeUnAutor(args('ana'));
    expect(recibidasPorAna).toHaveLength(2);
    expect(recibidasPorAna.every((revision) => revision.decision === DECISIONES_SOBRE_UNA_REVISION.PENDIENTE)).toBe(true);
    const revisorAprobado = recibidasPorAna.find((revision) => revision.revisorId !== 'carla').revisorId;
    sala.moderar('ana', revisorAprobado, { estado: 'aprobada', comentariosPorCriterio: { a: 'Comentario aprobado' }, comentarioGeneral: '' });
    sala.moderar('ana', 'carla', { estado: 'descartada' });
    expect(listarRevisionesAprobadasParaElAutor(args('ana'))).toEqual([
      { comentariosPorCriterio: { a: 'Comentario aprobado' }, comentarioGeneral: '' },
    ]);

    // Termina la revisión; el docente devuelve y se cierra.
    sala.latido();
    sala.motor.cerrarFaseActual();
    sala.latido();
    expect(sala.estado().fase.actual.tipo).toBe('cierre_y_ranking');

    const puntos = calcularPuntosDeRevisores({
      estadoPrivado: sala.estadoPrivado(),
      estado: sala.estado(),
      rubrica: RUBRICA,
      cola: construirColaDelDocente({ estadoPrivado: sala.estadoPrivado(), estado: sala.estado(), rubrica: RUBRICA }),
    });
    expect(puntos.ana.puntos).toBeGreaterThan(puntos.carla.puntos);
    expect(puntos.carla.puntos).toBe(0);

    sala.motor.cerrarSesion();
    // ana: 10 + bonus; beto: 10 + bonus; carla: nota baja y sin bonus → queda detrás.
    const podio = sala.estado().lectura.podio;
    expect(podio.flatMap((lugar) => lugar.participantIds).at(-1)).toBe('carla');
    // Lo público sigue sin notas ni textos.
    expect(JSON.stringify(sala.estado())).not.toMatch(/Texto de ana|Comentario aprobado|Comentario de/);
  });

  it('una revisión enviada fuera de la fase de revisión no cuenta', () => {
    const sala = salaEnRevision();
    sala.asignarPares({ ana: ['beto', 'carla'], beto: ['carla', 'ana'], carla: ['ana', 'beto'] });
    sala.latido();
    sala.motor.cerrarFaseActual();
    sala.latido();
    sala.revisar('ana', 0, MEJOR);
    expect(sala.estado().lectura.revisiones).toEqual({});
  });
});
