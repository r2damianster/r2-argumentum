// Prueba de humo de las pantallas del foro: se renderizan en el servidor (sin navegador) con un
// estado real construido por el reducer, para detectar errores de ejecución (props mal pasadas,
// campos que faltan) antes de abrir una sala de verdad.

import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { VistaDelForo } from '../../player/componentes/foro/VistaDelForo.jsx';
import { IngresoAlForo } from '../../player/componentes/foro/IngresoAlForo.jsx';
import { PanelDelForoParaElModerador } from '../../host/componentes/PanelDelForoParaElModerador.jsx';
import { PanelDeRevisionDelModerador } from '../../host/componentes/PanelDeRevisionDelModerador.jsx';
import { PanelDeIntegridadDelModerador } from '../../host/componentes/PanelDeIntegridadDelModerador.jsx';
import { SelectorDeIntegridad } from '../../host/componentes/SelectorDeIntegridad.jsx';
import { AdvertenciaDeIntegridad, AvisoDeIntegridad } from '../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { PanelDeRevisionDeAportes } from '../../player/componentes/foro/PanelDeRevisionDeAportes.jsx';
import { ControlDeFases } from '../../host/componentes/ControlDeFases.jsx';
import { PanelDeAvisos } from '../../host/componentes/PanelDeAvisos.jsx';
import { SelectorDeActividad } from '../../host/componentes/SelectorDeActividad.jsx';
import { SelectorDeModeracion } from '../../host/componentes/SelectorDeModeracion.jsx';
import { PanelDeDesignacionDeCoModeradores } from '../../host/componentes/PanelDeDesignacionDeCoModeradores.jsx';
import { listarActividadesHabilitadas } from '../registroDeActividades.js';

const PROGRAMA = {
  programId: 'foro-humo',
  titulo: 'Foro de humo',
  actividad: 'foro_escrito',
  perfilDePuntaje: 'estandar',
  asignacionPostura: 'libre',
  preguntaGuia: '¿Pregunta guía?',
  instruccionesParaEstudiantes: 'Escribe con razones.',
  posturas: [
    { id: 'a_favor', etiqueta: 'A favor', color: '#0a0' },
    { id: 'en_contra', etiqueta: 'En contra', color: '#a00' },
  ],
  fases: [{ tipo: 'foro_escrito', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', emoji: '🦊', conectado: true },
  { participantId: 'luis', nombre: 'Luis', emoji: '🐼', conectado: true },
  { participantId: 'carla', nombre: 'Carla', emoji: '🐨', conectado: true },
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

const INGRESOS = [
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor', nombre: 'Ana', emoji: '🦊' }),
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'en_contra', nombre: 'Luis', emoji: '🐼' }),
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla', stanceId: 'a_favor', nombre: 'Carla', emoji: '🐨' }),
];

const FORO_ABIERTO = evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 });

function aporte(argumentId, participantId, extra = {}) {
  return evento(EVENTOS.ARGUMENTO_PUBLICADO, {
    argumentId,
    participantId,
    posicionEnRonda: 1,
    ronda: 1,
    tipoDeclarado: 'nuevo',
    stanceId: participantId === 'luis' ? 'en_contra' : 'a_favor',
    texto: `Texto del aporte ${argumentId} con suficientes palabras para el foro`,
    pendienteDeExposicion: false,
    ...extra,
  });
}

const publicar = () => {};
const motorFalso = {
  extenderTiempo: () => {},
  cerrarFaseActual: () => {},
  designarCoModeradores: () => null,
  quitarDesignacionDeCoModeradores: () => {},
};

function renderizar(elemento) {
  return renderToStaticMarkup(elemento);
}

describe('pantallas del foro: el participante', () => {
  const props = (estado, participantId = 'ana') => ({
    estado,
    presencia: PRESENCIA,
    programa: PROGRAMA,
    participantId,
    publicar,
  });

  it('antes de que haya posts invita a publicar el primero', () => {
    const html = renderizar(h(VistaDelForo, props(construirEstado([...INGRESOS, FORO_ABIERTO]))));
    expect(html).toContain('Aún no hay posts');
    expect(html).toContain('Publicar post');
  });

  it('con posts y respuestas muestra los hilos, las métricas y el aviso de sin debatir', () => {
    const estado = construirEstado([
      ...INGRESOS,
      FORO_ABIERTO,
      aporte('p1', 'ana', { timestamp: Date.now() - 5 * 60 * 1000 }),
      aporte('p2', 'luis', { timestamp: Date.now() - 4 * 60 * 1000 }),
      aporte('r1', 'carla', { argumentoObjetivoId: 'p2', tipoDeclarado: 'contraargumento', timestamp: Date.now() - 3 * 60 * 1000 }),
      evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p2', participantId: 'ana', tipo: 'me_convencio' }),
    ]);
    const html = renderizar(h(VistaDelForo, props(estado, 'luis')));
    expect(html).toContain('Texto del aporte p1');
    expect(html).toContain('Texto del aporte r1');
    expect(html).toContain('posts por persona');
    expect(html).toContain('Me convenció');
    // Luis recibió una respuesta de Carla y todavía no la contestó.
    expect(html).toContain('Te respondieron (1)');
  });

  it('un co-moderador ve el foro sin compositor y con la opción de ocultar', () => {
    const estado = construirEstado([
      ...INGRESOS,
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla'] }),
      FORO_ABIERTO,
      aporte('p1', 'ana'),
    ]);
    const html = renderizar(h(VistaDelForo, props(estado, 'carla')));
    expect(html).not.toContain('Publicar post');
    expect(html).toContain('Ocultar');
  });

  it('los aportes ocultos no los ve un participante', () => {
    const estado = construirEstado([
      ...INGRESOS,
      FORO_ABIERTO,
      aporte('p1', 'ana'),
      evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p1', porId: 'host' }),
    ]);
    expect(renderizar(h(VistaDelForo, props(estado, 'luis')))).not.toContain('Texto del aporte p1');
  });

  it('con el tiempo cerrado la escritura está bloqueada', () => {
    const estado = construirEstado([
      ...INGRESOS,
      FORO_ABIERTO,
      evento(EVENTOS.FASE_CERRADA, { phaseType: 'foro_escrito' }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'cierre_y_ranking' }),
    ]);
    const html = renderizar(h(VistaDelForo, props(estado)));
    expect(html).toContain('La escritura está cerrada');
  });

  it('el ingreso al foro pide solo la postura, sin argumento', () => {
    const estado = construirEstado([]);
    const html = renderizar(h(IngresoAlForo, { ...props(estado), nombre: 'Ana', emoji: '🦊' }));
    expect(html).toContain('Para entrar al foro');
    expect(html).toContain('A favor');
    expect(html).not.toContain('Tu argumento');
  });
});

describe('pantallas del foro: el moderador', () => {
  const estado = construirEstado([
    ...INGRESOS,
    FORO_ABIERTO,
    aporte('p1', 'ana', { timestamp: Date.now() - 10 * 60 * 1000 }),
    aporte('p2', 'luis'),
    evento(EVENTOS.REACCION_REGISTRADA, { argumentId: 'p1', participantId: 'luis', tipo: 'me_convencio' }),
  ]);

  it('el panel del foro muestra métricas, convencimiento cruzado y los hilos con acciones', () => {
    const html = renderizar(
      h(PanelDelForoParaElModerador, { estado, presencia: PRESENCIA, programa: PROGRAMA, publicar })
    );
    expect(html).toContain('Foro en vivo');
    expect(html).toContain('Convencimiento cruzado: 1');
    expect(html).toContain('Ocultar');
  });

  it('el control de fases del foro ofrece extender el tiempo y cerrar la escritura', () => {
    const html = renderizar(h(ControlDeFases, { estado, motor: motorFalso, programa: PROGRAMA }));
    expect(html).toContain('Extender 5 minutos');
    expect(html).toContain('Cerrar la escritura ahora');
  });

  it('antes de empezar el botón dice «Iniciar foro»', () => {
    const html = renderizar(h(ControlDeFases, { estado: construirEstado(INGRESOS), motor: motorFalso, programa: PROGRAMA }));
    expect(html).toContain('Iniciar foro');
  });

  it('el panel de avisos usa los avisos del foro', () => {
    const estadoConPostViejo = construirEstado([
      ...INGRESOS,
      FORO_ABIERTO,
      aporte('p1', 'ana', { timestamp: Date.now() - 10 * 60 * 1000 }),
    ]);
    const html = renderizar(h(PanelDeAvisos, { estado: estadoConPostViejo, presencia: PRESENCIA, motor: motorFalso }));
    expect(html).toContain('sin que nadie les responda');
    expect(html).not.toContain('ruleta');
  });
});

describe('pantallas de configuración', () => {
  it('el selector de actividad lista las actividades habilitadas', () => {
    const html = renderizar(
      h(SelectorDeActividad, { actividades: listarActividadesHabilitadas(), onElegirActividad: () => {} })
    );
    expect(html).toContain('Debate hablado');
    expect(html).toContain('Foro escrito');
  });

  it('el selector de moderación muestra los tres modos y el campo del número fijo', () => {
    const html = renderizar(
      h(SelectorDeModeracion, { moderacion: { modo: 'fijo', numeroFijo: 2 }, onCambiarModeracion: () => {} })
    );
    expect(html).toContain('Reglamentario');
    expect(html).toContain('Número fijo');
    expect(html).toContain('Sin co-moderadores');
    expect(html).toContain('Cantidad de co-moderadores');
  });

  it('el panel de designación explica por qué no hay co-moderadores con pocas personas', () => {
    const estado = construirEstado(INGRESOS);
    const html = renderizar(
      h(PanelDeDesignacionDeCoModeradores, {
        estado,
        presencia: PRESENCIA,
        programa: { ...PROGRAMA, moderacion: { modo: 'reglamentario' } },
        motor: motorFalso,
      })
    );
    expect(html).toContain('se necesitan al menos 6');
  });

  it('el panel de designación en modo sin co-moderadores lo dice y no ofrece botones', () => {
    const html = renderizar(
      h(PanelDeDesignacionDeCoModeradores, {
        estado: construirEstado(INGRESOS),
        presencia: PRESENCIA,
        programa: { ...PROGRAMA, moderacion: { modo: 'ninguno' } },
        motor: motorFalso,
      })
    );
    expect(html).toContain('Elegiste no tener co-moderadores');
    expect(html).not.toContain('Sortear ahora');
  });
});

describe('pantallas del foro: la revisión y la sugerencia de la IA', () => {
  const SUGERENCIA = {
    completitud: 'incompleto',
    falacias: [{ tipo: 'generalizacion_apresurada', fragmento: 'Todos', explicacion: 'Generaliza', confianza: 0.8 }],
    comentario: 'Falta un dato.',
    confianza: 0.7,
  };

  const estadoConRevision = construirEstado([
    ...INGRESOS,
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla'] }),
    FORO_ABIERTO,
    aporte('p1', 'ana', { sugerenciaDeIA: SUGERENCIA, timestamp: Date.now() - 60000 }),
    aporte('p2', 'luis', { timestamp: Date.now() - 30000 }),
  ]);

  it('la sugerencia la ve quien escribió el aporte', () => {
    const html = renderizar(
      h(VistaDelForo, { estado: estadoConRevision, presencia: PRESENCIA, programa: PROGRAMA, participantId: 'ana', publicar })
    );
    expect(html).toContain('Sugerencia de la IA');
    expect(html).toContain('Posible falacia: Generalización apresurada');
  });

  it('la sugerencia NO la ven los compañeros', () => {
    const html = renderizar(
      h(VistaDelForo, { estado: estadoConRevision, presencia: PRESENCIA, programa: PROGRAMA, participantId: 'luis', publicar })
    );
    expect(html).toContain('Texto del aporte p1');
    expect(html).not.toContain('Sugerencia de la IA');
  });

  it('el co-moderador ve la sugerencia y su cola de revisión', () => {
    const html = renderizar(
      h(VistaDelForo, { estado: estadoConRevision, presencia: PRESENCIA, programa: PROGRAMA, participantId: 'carla', publicar })
    );
    expect(html).toContain('Revisión de aportes');
    expect(html).toContain('Sugerencia de la IA');
    expect(html).toContain('Cuenta completo');
    expect(html).toContain('No cuenta');
  });

  it('con un co-moderador y dos aportes, le tocan los dos (es el único revisor)', () => {
    const html = renderizar(
      h(PanelDeRevisionDeAportes, { estado: estadoConRevision, presencia: PRESENCIA, participantId: 'carla', publicar })
    );
    expect(html).toContain('Texto del aporte p1');
    expect(html).toContain('Texto del aporte p2');
  });

  it('el moderador ve primero lo marcado por la IA, con su sugerencia y las opciones de decisión', () => {
    const html = renderizar(h(PanelDeRevisionDelModerador, { estado: estadoConRevision, presencia: PRESENCIA, publicar }));
    expect(html).toContain('Texto del aporte p1');
    expect(html).not.toContain('Texto del aporte p2');
    expect(html).toContain('Falta un dato.');
    expect(html).toContain('Opcional');
  });

  it('el moderador sin co-moderadores lo sabe: su decisión es la única revisión', () => {
    const estadoSinCoModeradores = construirEstado([...INGRESOS, FORO_ABIERTO, aporte('p1', 'ana', { sugerenciaDeIA: SUGERENCIA })]);
    const html = renderizar(h(PanelDeRevisionDelModerador, { estado: estadoSinCoModeradores, presencia: PRESENCIA, publicar }));
    expect(html).toContain('Sin co-moderadores, tu decisión es la única revisión');
  });

  it('muestra cuántos co-moderadores votaron cada nivel, sin decir quién', () => {
    const estado = construirEstado([
      ...INGRESOS,
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego', stanceId: 'en_contra' }),
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
      FORO_ABIERTO,
      aporte('p1', 'ana', { sugerenciaDeIA: SUGERENCIA }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 1 }),
      evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0 }),
    ]);
    const html = renderizar(h(PanelDeRevisionDelModerador, { estado, presencia: PRESENCIA, publicar }));
    expect(html).toContain('1 cuenta');
    expect(html).toContain('1 no cuenta');
    expect(html).toContain('no coinciden');
    expect(html).not.toContain('Carla');
  });
});

describe('pantallas de integridad', () => {
  const RESUMEN = {
    senales: [
      { tipo: 'pegado', gravedad: 'alta', detalle: 'Pegó 412 caracteres en 1 ocasión(es): 96 % del texto enviado.' },
      { tipo: 'cambio_de_pestana', gravedad: 'baja', detalle: 'Salió de la pestaña 3 vez/veces.' },
    ],
    gravedadMaxima: 'alta',
    requiereAdvertencia: true,
  };

  it('la advertencia al autor dice que el moderador verá la marca y deja elegir', () => {
    const html = renderizar(h(AdvertenciaDeIntegridad, { resumen: RESUMEN, onEnviarIgual: () => {}, onReescribir: () => {} }));
    expect(html).toContain('El moderador verá esta marca');
    expect(html).toContain('tus compañeros no');
    expect(html).toContain('Pegó 412 caracteres');
    expect(html).toContain('Enviar igual');
    expect(html).toContain('Reescribir');
    expect(html).toContain('no una sanción automática');
  });

  it('el aviso general solo aparece cuando la integridad está activa', () => {
    expect(renderizar(h(AvisoDeIntegridad, { nivel: 'ninguna' }))).toBe('');
    expect(renderizar(h(AvisoDeIntegridad, { nivel: 'advertencias' }))).toContain('Solo las ve el moderador');
    expect(renderizar(h(AvisoDeIntegridad, { nivel: 'restrictiva' }))).toContain('no se puede pegar');
  });

  it('el selector de integridad ofrece los tres niveles con «sin evaluación» marcado por defecto', () => {
    const html = renderizar(h(SelectorDeIntegridad, { integridad: { nivel: 'ninguna' }, onCambiarIntegridad: () => {} }));
    expect(html).toContain('Sin evaluación');
    expect(html).toContain('Con advertencias');
    expect(html).toContain('Restrictiva');
    expect(html).not.toContain('protocolo de ética');
  });

  it('al activar la integridad el selector recuerda avisar a la clase y el protocolo de ética', () => {
    const html = renderizar(h(SelectorDeIntegridad, { integridad: { nivel: 'advertencias' }, onCambiarIntegridad: () => {} }));
    expect(html).toContain('protocolo de ética');
  });

  it('el panel del moderador muestra la evidencia por persona y, en el foro, deja que el aporte no cuente', () => {
    const estado = construirEstado([...INGRESOS, FORO_ABIERTO, aporte('p1', 'ana')]);
    const registros = [
      {
        idDelMensaje: 'm1',
        participantId: 'ana',
        argumentId: 'p1',
        contexto: 'foro',
        senales: RESUMEN.senales,
        gravedadMaxima: 'alta',
        estadisticas: {},
        advertenciaMostrada: true,
        enviadoEn: 1,
      },
    ];
    const html = renderizar(h(PanelDeIntegridadDelModerador, { estado, presencia: PRESENCIA, registros, esForo: true, publicar }));
    expect(html).toContain('solo tú ves esto');
    expect(html).toContain('Pegó 412 caracteres');
    expect(html).toContain('se le advirtió y envió igual');
    expect(html).toContain('Que este aporte no cuente');
    expect(html).toContain('Son señales, no pruebas');
  });

  it('en el debate hablado el panel solo informa: no ofrece anular aportes', () => {
    const estado = construirEstado([...INGRESOS, FORO_ABIERTO, aporte('p1', 'ana')]);
    const registros = [
      { idDelMensaje: 'm1', participantId: 'ana', argumentId: 'p1', contexto: 'preparacion', senales: RESUMEN.senales, gravedadMaxima: 'alta', estadisticas: {}, advertenciaMostrada: false, enviadoEn: 1 },
    ];
    const html = renderizar(h(PanelDeIntegridadDelModerador, { estado, presencia: PRESENCIA, registros, esForo: false, publicar }));
    expect(html).not.toContain('Que este aporte no cuente');
  });

  it('sin señales el panel dice que todavía no hay nada registrado', () => {
    const html = renderizar(
      h(PanelDeIntegridadDelModerador, { estado: construirEstado(INGRESOS), presencia: PRESENCIA, registros: [], esForo: true, publicar })
    );
    expect(html).toContain('Todavía no hay señales registradas');
  });
});

describe('proyección del foro', () => {
  it('muestra la pregunta guía, el tiempo, las métricas y los hilos, sin sugerencias de la IA ni ocultos', async () => {
    const { VistaDeProyeccion } = await import('../../host/componentes/VistaDeProyeccion.jsx');
    const estado = construirEstado([
      ...INGRESOS,
      FORO_ABIERTO,
      aporte('p1', 'ana', { sugerenciaDeIA: { completitud: 'incompleto', falacias: [] } }),
      aporte('p2', 'luis'),
      evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'p2', porId: 'host' }),
    ]);
    const html = renderizar(h(VistaDeProyeccion, { estado, programa: PROGRAMA, presencia: PRESENCIA, conexion: null }));
    expect(html).toContain('¿Pregunta guía?');
    expect(html).toContain('posts por persona');
    expect(html).toContain('Texto del aporte p1');
    expect(html).not.toContain('Texto del aporte p2');
    expect(html).not.toContain('Sugerencia de la IA');
    expect(html).not.toContain('Ocultar');
  });
});
