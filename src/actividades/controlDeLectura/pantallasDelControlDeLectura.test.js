// Prueba de humo de las pantallas del control de lectura: se renderizan en el servidor (sin navegador)
// con un estado real construido por el reducer, para detectar errores de ejecución (props mal pasadas,
// campos que faltan) antes de abrir una sala de verdad.

import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../shared/nucleo/entregas/canalesPrivados.js';
import { reducirRegistrosPrivados } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { IngresoAlControlDeLectura } from '../../player/componentes/lectura/IngresoAlControlDeLectura.jsx';
import { VistaDelControlDeLectura } from '../../player/componentes/lectura/VistaDelControlDeLectura.jsx';
import { PanelDelControlDeLecturaParaElDocente } from '../../host/componentes/lectura/PanelDelControlDeLecturaParaElDocente.jsx';
import { PantallaDeConfiguracionDeLectura } from '../../host/componentes/lectura/PantallaDeConfiguracionDeLectura.jsx';
import { ResumenDeConfiguracionDeLectura } from '../../host/componentes/lectura/ResumenDeConfiguracionDeLectura.jsx';
import { CalificadorDeEntrega } from '../../host/componentes/lectura/CalificadorDeEntrega.jsx';
import { RevisionesDeParesDeUnaEntrega } from '../../host/componentes/lectura/RevisionesDeParesDeUnaEntrega.jsx';
import { VistaDeProyeccion } from '../../host/componentes/VistaDeProyeccion.jsx';
import { construirColaDelDocente } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { construirIntegridadPorEntrega } from '../../shared/nucleo/entregas/integridadDeLasEntregas.js';
import { resolverRubricaDelPrograma } from '../../shared/nucleo/rubrica/rubrica.js';
import { ControlDeFases } from '../../host/componentes/ControlDeFases.jsx';
import { SelectorDeActividad } from '../../host/componentes/SelectorDeActividad.jsx';
import { listarActividadesHabilitadas } from '../registroDeActividades.js';
import { armarProgramaDeLaSesionDeLectura, programaPublicable } from './programaDeLectura.js';

const PROGRAMA_COMPLETO = {
  programId: 'lectura-humo',
  titulo: 'Control de lectura de humo',
  temaCentral: 'La utilidad de investigar',
  actividad: 'control_de_lectura',
  consigna: 'Explica para qué sirve la investigación.',
  estructura: 'peel',
  distribucion: 'compacta',
  numeroDeParrafos: 2,
  clavesDeLaLectura: 'CLAVE SECRETA DE LA LECTURA',
  instruccionesParaEstudiantes: 'Escribe con tus palabras.',
  posturas: [],
  fases: [{ tipo: 'control_de_lectura', duracionMin: 20 }, { tipo: 'cierre_y_ranking' }],
};
const PROGRAMA = programaPublicable(armarProgramaDeLaSesionDeLectura({ programaBase: PROGRAMA_COMPLETO, idioma: 'es' }));

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', emoji: '🦊', conectado: true },
  { participantId: 'luis', nombre: 'Luis', emoji: '🐼', conectado: true },
];

function evento(name, data = {}, clientId) {
  return { name, data: { timestamp: Date.now(), ...data }, ...(clientId ? { clientId } : {}) };
}

function construirEstado(eventos) {
  return [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }, 'host'), ...eventos].reduce(
    (estado, siguiente) => reducirEventos(estado, siguiente),
    estadoInicial()
  );
}

const INGRESOS = [
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', nombre: 'Ana', emoji: '🦊' }, 'ana'),
  evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', nombre: 'Luis', emoji: '🐼' }, 'luis'),
];
const ESCRITURA_ABIERTA = evento(EVENTOS.FASE_INICIADA, { phaseType: 'control_de_lectura', duracionMin: 20 }, 'host');
const ENTREGA_DE_ANA = evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 80, parrafos: 2 }, 'ana');
const ENTREGA_DE_LUIS = evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'luis', palabras: 55, parrafos: 1 }, 'luis');

const publicar = () => {};
const publicarEntregaPrivada = () => Promise.resolve();
const motorFalso = { extenderTiempo: () => {}, cerrarFaseActual: () => {}, iniciarSesion: () => {}, cerrarSesion: () => {} };

function renderizar(elemento) {
  return renderToStaticMarkup(elemento);
}

describe('el programa que se publica', () => {
  it('no lleva las claves de la lectura: las leen todos los participantes', () => {
    expect(JSON.stringify(PROGRAMA)).not.toContain('CLAVE SECRETA');
  });
});

describe('pantallas del control de lectura: el estudiante', () => {
  const props = (estado, extra = {}) => ({
    estado,
    presencia: PRESENCIA,
    programa: PROGRAMA,
    participantId: 'ana',
    mensajesPrivados: {},
    publicar,
    publicarIntegridad: () => {},
    publicarEntregaPrivada,
    ...extra,
  });

  it('el ingreso muestra la consigna, el aviso de integridad y no pide postura', () => {
    const html = renderizar(h(IngresoAlControlDeLectura, { programa: PROGRAMA, participantId: 'ana', nombre: 'Ana', emoji: '🦊', publicar }));
    expect(html).toContain('Explica para qué sirve la investigación.');
    expect(html).toContain('señales de integridad');
    expect(html).not.toContain('postura');
    expect(html).toContain('Entrar');
  });

  it('antes de empezar espera al docente', () => {
    const html = renderizar(h(VistaDelControlDeLectura, props(construirEstado(INGRESOS))));
    expect(html).toContain('todavía no abre la escritura');
  });

  it('escribiendo: muestra consigna, estructura, contadores y el botón de enviar', () => {
    const html = renderizar(h(VistaDelControlDeLectura, props(construirEstado([...INGRESOS, ESCRITURA_ABIERTA]))));
    expect(html).toContain('Explica para qué sirve la investigación.');
    expect(html).toContain('Punto');
    expect(html).toContain('Evidencia');
    expect(html).toContain('0 palabra(s)');
    expect(html).toContain('de 2 párrafo(s) pedidos');
    expect(html).toContain('Enviar mi texto');
    expect(html).toContain('role="timer"');
  });

  it('tras entregar no deja editar y espera la devolución', () => {
    const html = renderizar(h(VistaDelControlDeLectura, props(construirEstado([...INGRESOS, ESCRITURA_ABIERTA, ENTREGA_DE_ANA]))));
    expect(html).toContain('Entregaste tu texto');
    expect(html).toContain('80 palabras');
    expect(html).not.toContain('Enviar mi texto');
    expect(html).toContain('Tu docente está revisando tu texto');
  });

  it('con la devolución muestra los comentarios por criterio, sin nota, y las dos respuestas', () => {
    const estado = construirEstado([
      ...INGRESOS,
      ESCRITURA_ABIERTA,
      ENTREGA_DE_ANA,
      evento(EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: Date.now() + 10 * 60 * 1000 }, 'host'),
    ]);
    const devolucion = {
      criterios: [{ criterioId: 'estructura', nombre: 'Estructura', comentario: 'Falta el enlace final.' }],
      comentarioGeneral: 'Buen trabajo en general.',
      revisionesDePares: [
        { criterios: [{ criterioId: 'estructura', nombre: 'Estructura', comentario: 'Me gustó cómo ordenaste las ideas.' }], comentarioGeneral: '' },
      ],
      hasta: null,
      revisada: false,
      llegadaEn: 1,
    };
    const html = renderizar(h(VistaDelControlDeLectura, props(estado, { mensajesPrivados: { devolucion } })));
    expect(html).toContain('Me gustó cómo ordenaste las ideas.');
    expect(html).toContain('Comentarios de un compañero');
    expect(html).toContain('Falta el enlace final.');
    expect(html).toContain('Buen trabajo en general.');
    expect(html).toContain('De acuerdo');
    expect(html).toContain('No estoy de acuerdo');
    expect(html).not.toMatch(/nota/i);
  });

  describe('con revisión entre pares', () => {
    const PROGRAMA_CON_PARES = programaPublicable(
      armarProgramaDeLaSesionDeLectura({
        programaBase: PROGRAMA_COMPLETO,
        idioma: 'es',
        revisionDePares: { activa: true, revisionesPorPersona: 2, duracionMin: 8 },
      })
    );
    const EN_REVISION = [
      ...INGRESOS,
      ESCRITURA_ABIERTA,
      ENTREGA_DE_ANA,
      ENTREGA_DE_LUIS,
      evento(EVENTOS.FASE_CERRADA, { phaseType: 'control_de_lectura' }, 'host'),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'revision_de_pares', duracionMin: 8 }, 'host'),
    ];
    const estadoEnRevision = () =>
      [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA_CON_PARES }, 'host'), ...EN_REVISION].reduce(
        (estado, siguiente) => reducirEventos(estado, siguiente),
        estadoInicial()
      );

    it('el programa publicado con pares lleva las fases de escritura, revisión y cierre', () => {
      expect(PROGRAMA_CON_PARES.fases.map((fase) => fase.tipo)).toEqual(['control_de_lectura', 'revision_de_pares', 'cierre_y_ranking']);
    });

    it('antes de recibir los textos espera el reparto', () => {
      const html = renderizar(h(VistaDelControlDeLectura, props(estadoEnRevision(), { programa: PROGRAMA_CON_PARES })));
      expect(html).toContain('Revisión entre pares');
      expect(html).toContain('Esperando que tu docente reparta los textos');
    });

    it('con los textos asignados muestra cada uno sin autor, con la rúbrica y el envío', () => {
      const revisionAsignada = { revisiones: [{ indice: 0, texto: 'Texto de un compañero sobre la lectura' }], llegadaEn: 1 };
      const html = renderizar(
        h(VistaDelControlDeLectura, props(estadoEnRevision(), { programa: PROGRAMA_CON_PARES, mensajesPrivados: { revisionAsignada } }))
      );
      expect(html).toContain('Texto de un compañero sobre la lectura');
      expect(html).toContain('Pertinencia a la consigna');
      expect(html).toContain('Excelente');
      expect(html).toContain('Enviar esta revisión');
      expect(html).toContain('anónimo');
      expect(html).not.toContain('Luis');
    });

    it('quien no entregó no revisa', () => {
      const html = renderizar(h(VistaDelControlDeLectura, props(estadoEnRevision(), { programa: PROGRAMA_CON_PARES, participantId: 'carla' })));
      expect(html).not.toContain('Enviar esta revisión');
    });

    it('con la actividad cerrada el revisor ve cómo le fue, sin notas', () => {
      const cerrado = reducirEventos(estadoEnRevision(), evento(EVENTOS.SESION_CERRADA));
      const resultadoDeRevision = {
        hechas: 1,
        asignadas: 2,
        puntos: 0.5,
        revisiones: [
          { indice: 0, estado: 'enviada', comparaciones: [{ nombre: 'Pertinencia', frase: 'difirió en 1 nivel' }], sinReferencia: false },
          { indice: 1, estado: 'no_enviada', comparaciones: [], sinReferencia: false },
        ],
      };
      const html = renderizar(
        h(VistaDelControlDeLectura, props(cerrado, { programa: PROGRAMA_CON_PARES, mensajesPrivados: { resultadoDeRevision } }))
      );
      expect(html).toContain('Cómo te fue como revisor');
      expect(html).toContain('difirió en 1 nivel');
      expect(html).toContain('No enviaste esta revisión');
    });

    it('el docente ve el estado de la revisión y no puede devolver todavía', () => {
      const estado = estadoEnRevision();
      const estadoPrivado = reducirRegistrosPrivados([
        { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: 'Texto de Ana', enviadoEn: 1 },
        { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: 'Texto de Luis', enviadoEn: 2 },
        { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'ana', niveles: { pertinencia: 'bueno', estructura: 'bueno', desarrollo: 'bueno', claridad: 'bueno', lengua: 'bueno' }, aprobada: true, enviadoEn: 3 },
      ]);
      const html = renderizar(
        h(PanelDelControlDeLecturaParaElDocente, {
          estado,
          presencia: PRESENCIA,
          programa: PROGRAMA_CON_PARES,
          motor: motorFalso,
          estadoPrivado,
          publicar,
          publicarComoDocente: () => Promise.resolve(),
          enviarAlEstudiante: () => Promise.resolve(),
        })
      );
      expect(html).toContain('Revisión entre pares');
      expect(html).toContain('Podrás devolver cuando termine la revisión entre pares');
      expect(html).toContain('Extender');
    });
  });

  it('con la actividad cerrada muestra el podio sin notas y marca el lugar propio', () => {
    const estado = construirEstado([
      ...INGRESOS,
      ESCRITURA_ABIERTA,
      ENTREGA_DE_ANA,
      evento(EVENTOS.LECTURA_PODIO_PUBLICADO, { lugares: [{ lugar: 1, participantIds: ['ana'] }, { lugar: 2, participantIds: ['luis'] }] }, 'host'),
      evento(EVENTOS.SESION_CERRADA),
    ]);
    const html = renderizar(h(VistaDelControlDeLectura, props(estado)));
    expect(html).toContain('Podio');
    expect(html).toContain('nombre-en-el-podio--propio');
    expect(html).toContain('Luis');
    expect(html).not.toMatch(/\d+[.,]\d+ ?\/ ?10/);
  });
});

describe('pantallas del control de lectura: el docente', () => {
  const RUBRICA_PROGRAMA = PROGRAMA;
  const ESTADO_PRIVADO = reducirRegistrosPrivados([
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: 'Texto de Ana sobre la investigación', enviadoEn: 1 },
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: 'Texto de Luis', enviadoEn: 2 },
  ]);

  const props = (estado, estadoPrivado = ESTADO_PRIVADO, extra = {}) => ({
    estado,
    presencia: PRESENCIA,
    programa: RUBRICA_PROGRAMA,
    motor: motorFalso,
    estadoPrivado,
    publicar,
    publicarComoDocente: () => Promise.resolve(),
    enviarAlEstudiante: () => Promise.resolve(),
    ...extra,
  });

  it('muestra el avance y la cola con códigos anónimos, sin nombres ni textos', () => {
    const estado = construirEstado([...INGRESOS, ESCRITURA_ABIERTA, ENTREGA_DE_ANA]);
    const html = renderizar(h(PanelDelControlDeLecturaParaElDocente, props(estado)));
    expect(html).toContain('Control de lectura');
    expect(html).toContain('Entregas para calificar (1)');
    expect(html).toMatch(/Entrega [0-9A-Z]{4}/);
    expect(html).not.toContain('Texto de Ana');
    // Solo aparece quien falta; quien entregó no se nombra.
    expect(html).toContain('Quiénes todavía no entregan (1)');
    expect(html).toContain('Luis');
    expect(html).not.toContain('Ana</li>');
    expect(html).toContain('Cerrar y calcular');
  });

  it('con la actividad cerrada ofrece el podio y las descargas', () => {
    const estado = construirEstado([
      ...INGRESOS,
      ESCRITURA_ABIERTA,
      ENTREGA_DE_ANA,
      ENTREGA_DE_LUIS,
      evento(EVENTOS.LECTURA_PODIO_PUBLICADO, { lugares: [{ lugar: 1, participantIds: ['ana'] }] }, 'host'),
      evento(EVENTOS.SESION_CERRADA),
    ]);
    const html = renderizar(h(PanelDelControlDeLecturaParaElDocente, props(estado, ESTADO_PRIVADO, { onElegirOtraActividad: () => {} })));
    expect(html).toContain('Podio');
    expect(html).toContain('Informe (JSON)');
    expect(html).toContain('Notas (CSV)');
    expect(html).toContain('Elegir otra actividad');
  });

  it('la configuración previa ofrece estructuras, distribución, ventana e integridad', () => {
    const html = renderizar(
      h(PantallaDeConfiguracionDeLectura, { programaBase: PROGRAMA_COMPLETO, onConfirmarConfiguracion: () => {}, onCambiarPrograma: () => {} })
    );
    expect(html).toContain('Explica para qué sirve la investigación.');
    expect(html).toContain('PEEL');
    expect(html).toContain('Desarrollada');
    expect(html).toContain('Ventana');
    expect(html).toContain('Integridad');
    expect(html).toContain('Rúbrica');
  });

  it('la sala de espera lista a quienes ya entraron y la configuración activa', () => {
    const html = renderizar(
      h(ResumenDeConfiguracionDeLectura, { estado: construirEstado(INGRESOS), presencia: PRESENCIA, programa: PROGRAMA, onModificarConfiguracion: () => {} })
    );
    expect(html).toContain('2 ya entraron');
    expect(html).toContain('20 minutos');
    expect(html).toContain('Con advertencias');
  });

  it('el control de fases dice «Iniciar control de lectura» y, al cerrar la escritura, «Calificación y devolución»', () => {
    const antes = renderizar(h(ControlDeFases, { estado: construirEstado(INGRESOS), motor: motorFalso, programa: PROGRAMA }));
    expect(antes).toContain('Iniciar control de lectura');

    const despues = renderizar(
      h(ControlDeFases, {
        estado: construirEstado([
          ...INGRESOS,
          ESCRITURA_ABIERTA,
          evento(EVENTOS.FASE_CERRADA, { phaseType: 'control_de_lectura' }, 'host'),
          evento(EVENTOS.FASE_INICIADA, { phaseType: 'cierre_y_ranking' }, 'host'),
        ]),
        motor: motorFalso,
        programa: PROGRAMA,
      })
    );
    expect(despues).toContain('Calificación y devolución');
  });

  it('el selector de actividad ofrece el control de lectura', () => {
    const html = renderizar(h(SelectorDeActividad, { actividades: listarActividadesHabilitadas(), onElegirActividad: () => {} }));
    expect(html).toContain('Control de lectura');
  });
});

describe('pantallas del control de lectura: calificador, integridad y proyección', () => {
  const RUBRICA = resolverRubricaDelPrograma(PROGRAMA);
  const COPIA = 'La investigación formativa permite que el estudiante aprenda a formular preguntas y a buscar evidencia para responderlas con método.';
  const estado = construirEstado([...INGRESOS, ESCRITURA_ABIERTA, ENTREGA_DE_ANA, ENTREGA_DE_LUIS]);
  const estadoPrivado = reducirRegistrosPrivados([
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: COPIA, enviadoEn: 1 },
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: COPIA, enviadoEn: 2 },
    {
      nombre: EVENTOS_PRIVADOS.SUGERENCIA_DE_IA,
      participantId: 'luis',
      sugerencia: {
        niveles: Object.fromEntries(RUBRICA.map((criterio) => [criterio.id, 'bueno'])),
        comentariosPorCriterio: {},
        partesDetectadas: [{ nombre: 'Punto', presente: true }, { nombre: 'Enlace', presente: false }],
        comentarioGeneral: 'Texto claro.',
        confianza: 0.9,
      },
    },
  ]);
  const cola = construirColaDelDocente({ estadoPrivado, estado, rubrica: RUBRICA });
  const item = cola.find((candidato) => candidato.participantId === 'luis');
  const integridad = construirIntegridadPorEntrega({ cola, programa: PROGRAMA })[item.participantId];

  const propsDelCalificador = (extra = {}) => ({
    item,
    rubrica: RUBRICA,
    nombreDelAutor: 'Luis',
    guardando: false,
    integridad,
    alGuardar: () => {},
    alDevolver: () => {},
    alResolverDesacuerdo: () => {},
    alDecidirIntegridad: () => {},
    ...extra,
  });

  it('el calificador no revela al autor hasta aprobar y muestra la sugerencia de la IA como orientativa', () => {
    const html = renderizar(h(CalificadorDeEntrega, propsDelCalificador()));
    expect(html).toContain('El autor se revela cuando apruebes');
    expect(html).not.toContain('Autor:');
    expect(html).toContain('Sugerencia de la IA');
    expect(html).toContain('orientativa, anónima y solo para ti');
    expect(html).toContain('confianza 90 %');
    expect(html).toContain('✘ Enlace');
    expect(html).toContain('Aprobar tal cual');
    expect(html).toContain('Usar la sugerencia como punto de partida');
  });

  it('muestra la marca de integridad con el parecido, es una advertencia y deja decidir', () => {
    const html = renderizar(h(CalificadorDeEntrega, propsDelCalificador()));
    expect(html).toContain('Integridad: Probable copia');
    expect(html).toContain('es una advertencia, no una prueba');
    expect(html).toMatch(/100 %/);
    expect(html).toContain('(Entrega ');
    expect(html).toContain('Aplicar un descuento a la nota');
    expect(html).toContain('Descartar la marca');
    // Con otra entrega solo se nombra por su código anónimo.
    expect(html).not.toContain('Ana');
  });

  it('sin marcas ni sugerencia el calificador no muestra esos bloques', () => {
    const html = renderizar(
      h(CalificadorDeEntrega, propsDelCalificador({ integridad: { banda: 'sin_indicio', similitud: null, senales: [] }, item: { ...item, sugerencia: null, sugerenciaOmitida: null } }))
    );
    expect(html).not.toContain('Integridad:');
    expect(html).not.toContain('Sugerencia de la IA');
  });

  it('las revisiones de compañeros se editan antes de aprobarse y muestran su estado', () => {
    const html = renderizar(
      h(RevisionesDeParesDeUnaEntrega, {
        revisiones: [
          {
            revisorId: 'ana',
            indice: 0,
            niveles: Object.fromEntries(RUBRICA.map((criterio) => [criterio.id, 'excelente'])),
            comentariosPorCriterio: { estructura: 'Me gustó el orden.' },
            comentarioGeneral: '',
            decision: 'pendiente',
            paraElAutor: null,
          },
        ],
        rubrica: RUBRICA,
        guardando: false,
        alModerar: () => {},
      })
    );
    expect(html).toContain('Revisiones de compañeros (1)');
    expect(html).toContain('Pendiente de tu decisión');
    expect(html).toContain('Me gustó el orden.');
    expect(html).toContain('Descartar');
    expect(html).not.toContain('Ana');
  });

  it('la proyección muestra consigna, tiempo y contadores, sin nombres ni textos ni notas', () => {
    const html = renderizar(
      h(VistaDeProyeccion, { estado, programa: PROGRAMA, presencia: PRESENCIA, conexion: { estado: 'en_linea', huecoEnElHistorial: false } })
    );
    expect(html).toContain('Explica para qué sirve la investigación.');
    expect(html).toContain('Entregaron');
    expect(html).toContain('Faltan');
    expect(html).toContain('role="timer"');
    expect(html).not.toContain('Ana');
    expect(html).not.toContain(COPIA);
    expect(html).not.toMatch(/nota/i);
  });
});
