// El informe imprimible (PDF) del foro: se renderiza en el servidor con un estado real para comprobar
// qué secciones trae y que las señales de integridad NO salen salvo que el moderador las pida.

import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { InformeDelDebate } from '../../host/componentes/InformeDelDebate.jsx';
import { construirResumenDelForo, resumirSugerenciasDeLaIA } from './informeDelForo.js';
import { resolverParametrosDePuntaje } from '../../shared/puntaje/perfilesDePuntaje.js';

const PROGRAMA = {
  programId: 'foro-pdf',
  titulo: 'Foro del PDF',
  temaCentral: 'Tema central',
  actividad: 'foro_escrito',
  perfilDePuntaje: 'estandar',
  integridad: { nivel: 'advertencias' },
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
  { participantId: 'diego', nombre: 'Diego', emoji: '🐯', conectado: true },
];

let marca = 5000;
function evento(name, data = {}) {
  marca += 1;
  return { name, data: { timestamp: marca, ...data } };
}

function sesion(extra = []) {
  const eventos = [
    evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'en_contra' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla', stanceId: 'a_favor' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'diego', stanceId: 'en_contra' }),
    evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['carla', 'diego'] }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'foro_escrito', duracionMin: 20 }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId: 'p1',
      participantId: 'ana',
      posicionEnRonda: 1,
      ronda: 1,
      stanceId: 'a_favor',
      tipoDeclarado: 'nuevo',
      texto: 'Texto del post de Ana',
      sugerenciaDeIA: { completitud: 'incompleto', falacias: [] },
    }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId: 'r1',
      participantId: 'luis',
      posicionEnRonda: 1,
      ronda: 1,
      stanceId: 'en_contra',
      tipoDeclarado: 'contraargumento',
      argumentoObjetivoId: 'p1',
      texto: 'Réplica de Luis',
    }),
    evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'carla', nivel: 0 }),
    evento(EVENTOS.REVISION_REGISTRADA, { argumentId: 'p1', revisorId: 'diego', nivel: 0 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'ana', delta: 100, motivo: 'Post n.º 1', categoria: 'argumento', nuevoTotal: 100 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'ana', delta: -100, motivo: 'Revisión del aporte: no cuenta (mayoría de co-moderadores)', categoria: 'argumento', nuevoTotal: 0 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'luis', delta: 30, motivo: 'Réplica n.º 1', categoria: 'argumento', nuevoTotal: 30 }),
    evento(EVENTOS.PUNTAJE_ACTUALIZADO, { participantId: 'carla', delta: 30, motivo: 'Calidad de sus revisiones', categoria: 'co_moderacion', nuevoTotal: 30 }),
    ...extra,
    evento(EVENTOS.SESION_CERRADA),
  ];
  return { eventos, estado: eventos.reduce(reducirEventos, estadoInicial()) };
}

const REGISTROS = [
  {
    idDelMensaje: 'm1',
    participantId: 'ana',
    argumentId: 'p1',
    contexto: 'foro',
    senales: [{ tipo: 'pegado', gravedad: 'alta', detalle: 'Pegó 412 caracteres' }],
    gravedadMaxima: 'alta',
    estadisticas: {},
    advertenciaMostrada: true,
    enviadoEn: 9,
  },
];

function renderizar({ incluirAnexoDeIntegridad = false } = {}) {
  const { eventos, estado } = sesion();
  return renderToStaticMarkup(
    h(InformeDelDebate, {
      estado,
      programa: PROGRAMA,
      presencia: PRESENCIA,
      eventos,
      registrosDeIntegridad: REGISTROS,
      incluirAnexoDeIntegridad,
    })
  );
}

describe('informe PDF del foro', () => {
  const html = renderizar();

  it('conserva las listas de siempre y agrega el desglose del puntaje', () => {
    expect(html).toContain('1. Lista Individual de Estudiantes');
    expect(html).toContain('2. Lista Colaborativa por Postura');
    expect(html).toContain('3. Desglose del puntaje');
    expect(html).toContain('Aportes publicados');
    expect(html).toContain('Ajustes por revisión o exposición');
    expect(html).toContain('(co-moderador)');
  });

  it('muestra el resultado de los co-moderadores con su acierto y esfuerzo', () => {
    expect(html).toContain('4. Resultado de los co-moderadores');
    expect(html).toContain('Acierto sobre el azar');
    expect(html).toContain('Votar al azar no');
  });

  it('trae la participación, las reacciones, el resumen de la IA y la revisión aporte por aporte', () => {
    expect(html).toContain('5. Participación en el foro');
    expect(html).toContain('6. Reacciones');
    expect(html).toContain('Convencimiento cruzado');
    expect(html).toContain('7. Sugerencias de la IA (en conjunto)');
    expect(html).toContain('8. Revisión de los aportes');
    expect(html).toContain('Texto del post de Ana');
    expect(html).toContain('No cuenta');
  });

  it('no repite la «evolución de los argumentos» del debate hablado', () => {
    expect(html).not.toContain('Evolución de los argumentos');
  });

  it('NO imprime las señales de integridad por defecto', () => {
    expect(html).not.toContain('Anexo de integridad');
    expect(html).not.toContain('Pegó 412 caracteres');
  });

  it('con el anexo pedido, lo agrega con la advertencia de que son señales y no pruebas', () => {
    const conAnexo = renderizar({ incluirAnexoDeIntegridad: true });
    expect(conAnexo).toContain('Anexo de integridad (confidencial)');
    expect(conAnexo).toContain('Pegó 412 caracteres');
    expect(conAnexo).toContain('no pruebas');
  });

  it('el informe cerrado no dice «parcial»', () => {
    expect(html).not.toContain('Informe parcial');
  });
});

describe('construirResumenDelForo', () => {
  it('resume las sugerencias de la IA solo en agregado', () => {
    const resumen = resumirSugerenciasDeLaIA([
      { sugerenciaDeIA: { completitud: 'completo', falacias: [] } },
      { sugerenciaDeIA: { completitud: 'sin_razon', falacias: [{ tipo: 'ad_hominem' }] } },
      {},
    ]);
    expect(resumen).toEqual({
      aportesConSugerencia: 2,
      aportesSinSugerencia: 1,
      completos: 1,
      incompletos: 0,
      sinRazon: 1,
      conPosiblesFalacias: 1,
    });
  });

  it('un aporte oculto aparece en la revisión como oculto y con su ajuste', () => {
    const { estado } = sesion([evento(EVENTOS.APORTE_OCULTADO, { argumentId: 'r1', porId: 'host' })]);
    const resumen = construirResumenDelForo({ estado, parametros: resolverParametrosDePuntaje(PROGRAMA), presencia: PRESENCIA });
    const replica = resumen.revisionDeAportes.find((aporte) => aporte.argumentId === 'r1');
    expect(replica).toMatchObject({ oculto: true, origenDelNivelFinal: 'oculto', ajusteAplicado: -30 });
  });
});
