import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../shared/nucleo/entregas/canalesPrivados.js';
import { reducirRegistrosPrivados } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { construirColaDelDocente } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { construirIntegridadPorEntrega } from '../../shared/nucleo/entregas/integridadDeLasEntregas.js';
import {
  construirAnexoDeIntegridadDeLectura,
  construirCsvDeLectura,
  construirInformeDeLectura,
} from './informeDeLectura.js';

const PROGRAMA = {
  programId: 'lectura-informe',
  titulo: 'Control de lectura',
  actividad: 'control_de_lectura',
  consigna: 'Resume la idea central.',
  rubrica: [
    { id: 'a', nombre: 'Pertinencia', peso: 50 },
    { id: 'b', nombre: 'Estructura', peso: 50 },
  ],
};
const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', emoji: '🦊' },
  { participantId: 'luis', nombre: 'Luis', emoji: '🐼' },
  { participantId: 'carla', nombre: 'Carla, la "grande"', emoji: '🦉' },
];

function evento(name, data, clientId) {
  return { name, data: { timestamp: 1000, ...data }, clientId };
}

function armarSala() {
  return [
    evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }, 'host'),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana' }, 'ana'),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis' }, 'luis'),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'carla' }, 'carla'),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'control_de_lectura', duracionMin: 20 }, 'host'),
    evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 80, parrafos: 2 }, 'ana'),
    evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'luis', palabras: 60, parrafos: 1, enviadoPorTiempo: true }, 'luis'),
    evento(EVENTOS.LECTURA_DEVUELTA, { participantId: 'ana', hasta: 5000 }, 'host'),
    evento(EVENTOS.LECTURA_CONFIRMADA, { participantId: 'ana', decision: 'en_desacuerdo' }, 'ana'),
  ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), estadoInicial());
}

const ESTADO_PRIVADO = reducirRegistrosPrivados([
  { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: 'Texto de Ana', enviadoEn: 1 },
  { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: 'Texto de Luis', enviadoPorTiempo: true, enviadoEn: 2 },
  { nombre: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, participantId: 'ana', decision: 'en_desacuerdo', motivo: 'No coincide, creo', enviadoEn: 3 },
  {
    nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA,
    participantId: 'ana',
    niveles: { a: 'excelente', b: 'bueno' },
    comentariosPorCriterio: { a: 'Muy bien.' },
    comentarioGeneral: 'Buen trabajo',
    aprobada: true,
    enviadoEn: 4,
  },
  { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'luis', niveles: { a: 'bueno' }, aprobada: false, enviadoEn: 5 },
]);

describe('construirInformeDeLectura', () => {
  const informe = construirInformeDeLectura({ estado: armarSala(), estadoPrivado: ESTADO_PRIVADO, programa: PROGRAMA, presencia: PRESENCIA });
  const persona = (id) => informe.personas.find((candidata) => candidata.participantId === id);

  it('trae una fila por persona que ingresó, incluso la que no entregó', () => {
    expect(informe.personas.map((fila) => fila.nombre)).toEqual(['Ana', 'Carla, la "grande"', 'Luis']);
    expect(persona('carla').estadoDeLaEntrega).toBe('sin_entrega');
    expect(persona('luis').estadoDeLaEntrega).toBe('enviada_por_tiempo');
  });

  it('solo una calificación aprobada tiene nota; un borrador no', () => {
    expect(persona('ana').nota).toBe(8.33);
    expect(persona('luis').nota).toBeNull();
    expect(informe.resumen).toMatchObject({ participantes: 3, entregaron: 2, calificadas: 1, promedio: 8.33 });
  });

  it('incluye el texto, el motivo del desacuerdo y la respuesta del estudiante', () => {
    expect(persona('ana')).toMatchObject({
      texto: 'Texto de Ana',
      confirmacion: 'en_desacuerdo',
      motivoDeDesacuerdo: 'No coincide, creo',
      devuelta: true,
    });
  });

  it('se marca como confidencial', () => {
    expect(informe.confidencial).toBe(true);
  });
});

describe('construirCsvDeLectura', () => {
  const informe = construirInformeDeLectura({ estado: armarSala(), estadoPrivado: ESTADO_PRIVADO, programa: PROGRAMA, presencia: PRESENCIA });
  const csv = construirCsvDeLectura(informe);

  it('empieza con BOM, trae los criterios como columnas y una fila por persona', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    const lineas = csv.trim().split('\r\n');
    expect(lineas[0]).toContain('Pertinencia,Estructura');
    expect(lineas).toHaveLength(4);
  });

  it('escapa comillas y comas en los nombres', () => {
    expect(csv).toContain('"Carla, la ""grande"""');
  });

  it('muestra los niveles como texto y la nota con decimales', () => {
    const filaDeAna = csv.split('\r\n').find((linea) => linea.startsWith('Ana'));
    expect(filaDeAna).toContain('Aprobada,8.33,,Excelente,Bueno');
  });
});

describe('integridad en el informe', () => {
  const COPIA = 'La investigación formativa permite que el estudiante aprenda a formular preguntas y a buscar evidencia para responderlas con método.';
  const estado = armarSalaConCopia();
  const estadoPrivado = reducirRegistrosPrivados([
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'ana', texto: COPIA, enviadoEn: 1 },
    { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId: 'luis', texto: COPIA, enviadoEn: 2 },
    { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'luis', niveles: { a: 'excelente', b: 'excelente' }, aprobada: true, enviadoEn: 3 },
    { nombre: EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD, participantId: 'luis', accion: 'descuento', descuento: 3, observacion: 'Copia del texto de otra persona' },
  ]);

  function armarSalaConCopia() {
    return [
      evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }, 'host'),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana' }, 'ana'),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis' }, 'luis'),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'control_de_lectura', duracionMin: 20 }, 'host'),
      evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'ana', palabras: 20, parrafos: 1 }, 'ana'),
      evento(EVENTOS.LECTURA_ENTREGA_REGISTRADA, { participantId: 'luis', palabras: 20, parrafos: 1 }, 'luis'),
    ].reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());
  }

  it('el informe general trae la nota final y el descuento, sin el detalle de las marcas', () => {
    const informe = construirInformeDeLectura({ estado, estadoPrivado, programa: PROGRAMA, presencia: PRESENCIA });
    const luis = informe.personas.find((persona) => persona.participantId === 'luis');
    expect(luis).toMatchObject({ notaDeLaRubrica: 10, descuentoPorIntegridad: 3, nota: 7 });
    expect(JSON.stringify(informe)).not.toContain('Copia del texto de otra persona');
    expect(construirCsvDeLectura(informe)).toContain('Descuento por integridad');
  });

  it('el anexo de integridad va aparte, es confidencial y trae las marcas con la decisión del docente', () => {
    const rubrica = PROGRAMA.rubrica;
    const cola = construirColaDelDocente({ estadoPrivado, estado, rubrica });
    const integridadPorEntrega = construirIntegridadPorEntrega({ cola, programa: PROGRAMA });
    const anexo = construirAnexoDeIntegridadDeLectura({ estado, cola, integridadPorEntrega, programa: PROGRAMA, presencia: PRESENCIA });

    expect(anexo.confidencial).toBe(true);
    expect(anexo.advertencia).toContain('no pruebas');
    expect(anexo.personas.map((persona) => persona.nombre).sort()).toEqual(['Ana', 'Luis']);
    const luis = anexo.personas.find((persona) => persona.participantId === 'luis');
    expect(luis).toMatchObject({ banda: 'probable_copia', descuentoAplicado: 3 });
    expect(luis.decisionDelDocente.observacion).toBe('Copia del texto de otra persona');
    expect(luis.similitud.conQuien).toMatch(/^Entrega /);
  });
});
