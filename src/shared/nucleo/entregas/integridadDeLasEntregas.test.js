import { describe, expect, it } from 'vitest';
import { EVENTOS_PRIVADOS } from './canalesPrivados.js';
import { construirColaDelDocente, reducirRegistrosPrivados } from './estadoPrivadoDelDocente.js';
import {
  ACCIONES_SOBRE_UNA_MARCA,
  DESCUENTO_MAXIMO,
  construirIntegridadPorEntrega,
  hayAlgoQueRevisar,
  normalizarDecisionDeIntegridad,
} from './integridadDeLasEntregas.js';

const RUBRICA = [
  { id: 'a', nombre: 'A', peso: 50 },
  { id: 'b', nombre: 'B', peso: 50 },
];
const TEXTO =
  'La investigación formativa permite que el estudiante aprenda a formular preguntas y a buscar evidencia para responderlas con método.';

function texto(participantId, contenido) {
  return { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId, texto: contenido, enviadoEn: 1 };
}

function armarCola(registros) {
  const participantes = [...new Set(registros.filter((registro) => registro.nombre === EVENTOS_PRIVADOS.ENTREGA_TEXTO).map((registro) => registro.participantId))];
  return construirColaDelDocente({
    estadoPrivado: reducirRegistrosPrivados(registros),
    estado: {
      lectura: {
        entregas: Object.fromEntries(
          participantes.map((participantId, indice) => [
            participantId,
            { participantId, palabras: 20, parrafos: 1, entregadaEn: indice, devueltaEn: null, confirmacion: null },
          ])
        ),
      },
    },
    rubrica: RUBRICA,
  });
}

const senal = (participantId, gravedad, tipo = 'pegado', contexto = 'entrega_de_lectura') => ({
  participantId,
  contexto,
  senales: [{ tipo, gravedad, detalle: 'Se pegó un bloque de texto' }],
});

describe('construirIntegridadPorEntrega', () => {
  it('una copia entre entregas se marca y nombra a la otra solo por su código anónimo', () => {
    const cola = armarCola([texto('ana', TEXTO), texto('beto', TEXTO), texto('carla', 'Otro texto distinto escrito con mis propias palabras sobre el tema central.')]);
    const integridad = construirIntegridadPorEntrega({ cola, programa: {} });
    const etiquetaDeAna = cola.find((item) => item.participantId === 'ana').etiqueta;

    expect(integridad.beto.similitud).toMatchObject({ porcentaje: 100, banda: 'probable_copia', origen: 'otra_entrega' });
    expect(integridad.beto.similitud.conQuien).toBe(etiquetaDeAna);
    expect(JSON.stringify(integridad.beto)).not.toContain('"ana"');
    expect(hayAlgoQueRevisar(integridad.beto)).toBe(true);
    expect(hayAlgoQueRevisar(integridad.carla)).toBe(false);
  });

  it('suma las señales de redacción de esa entrega y descarta las de otro contexto', () => {
    const cola = armarCola([texto('ana', 'Un texto sin parecido con nada de lo demás en esta sala de clase.')]);
    const integridad = construirIntegridadPorEntrega({
      cola,
      programa: {},
      registrosDeIntegridad: [senal('ana', 'alta'), senal('ana', 'baja', 'cambio_de_pestana'), senal('ana', 'alta', 'pegado', 'foro')],
    });
    expect(integridad.ana.senales).toHaveLength(2);
    expect(integridad.ana.gravedadMaxima).toBe('alta');
    expect(integridad.ana.banda).toBe('alto');
  });

  it('una señal baja sola no alerta', () => {
    const cola = armarCola([texto('ana', 'Un texto sin parecido con nada de lo demás en esta sala de clase.')]);
    const integridad = construirIntegridadPorEntrega({ cola, programa: {}, registrosDeIntegridad: [senal('ana', 'baja', 'cambio_de_pestana')] });
    expect(integridad.ana.banda).toBe('sin_indicio');
  });

  it('compara con el texto de referencia del host y con los ejemplos del Programa', () => {
    const cola = armarCola([texto('ana', TEXTO)]);
    const conReferencia = construirIntegridadPorEntrega({ cola, programa: { textoDeReferencia: `${TEXTO} Y más texto de la lectura original.` } });
    expect(conReferencia.ana.similitud).toMatchObject({ origen: 'texto_de_referencia', porcentaje: 100 });

    const conEjemplo = construirIntegridadPorEntrega({ cola, programa: { ejemplosPorTema: [{ bueno: TEXTO }] } });
    expect(conEjemplo.ana.similitud.origen).toBe('ejemplo');
  });

  it('respeta los umbrales del Programa', () => {
    const cola = armarCola([texto('ana', TEXTO), texto('beto', `${TEXTO} Y yo agrego bastantes palabras propias para diluir bastante lo copiado de ella aquí.`)]);
    const estricto = construirIntegridadPorEntrega({ cola, programa: { umbralesDeSimilitud: { atencion: 5, alto: 10, probableCopia: 20 } } });
    const flojo = construirIntegridadPorEntrega({ cola, programa: { umbralesDeSimilitud: { atencion: 80, alto: 90, probableCopia: 95 } } });
    expect(estricto.beto.similitud.banda).toBe('probable_copia');
    expect(flojo.beto.similitud.banda).toBe('sin_indicio');
  });
});

describe('decisiones sobre una marca', () => {
  it('normaliza la acción, acota el texto y el descuento', () => {
    expect(normalizarDecisionDeIntegridad({ accion: 'inventada' })).toEqual({ accion: ACCIONES_SOBRE_UNA_MARCA.DESCARTADA, observacion: '', descuento: 0 });
    expect(normalizarDecisionDeIntegridad({ accion: 'descuento', descuento: 99, observacion: '  Copia clara  ' })).toEqual({
      accion: 'descuento',
      observacion: 'Copia clara',
      descuento: DESCUENTO_MAXIMO,
    });
    // Solo la acción «descuento» descuenta: descartar o dejar una observación no toca la nota.
    expect(normalizarDecisionDeIntegridad({ accion: 'observada', descuento: 5 }).descuento).toBe(0);
  });

  it('el descuento baja la nota final pero no la de la rúbrica, y nunca deja la nota por debajo de cero', () => {
    const registros = [
      texto('ana', 'Texto de Ana'),
      texto('beto', 'Texto de Beto'),
      { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'ana', niveles: { a: 'excelente', b: 'excelente' }, aprobada: true, enviadoEn: 2 },
      { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'beto', niveles: { a: 'bueno', b: 'bueno' }, aprobada: true, enviadoEn: 2 },
      { nombre: EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD, participantId: 'ana', accion: 'descuento', descuento: 2.5, observacion: 'Copia' },
      { nombre: EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD, participantId: 'beto', accion: 'descuento', descuento: 10 },
    ];
    const cola = armarCola(registros);
    const ana = cola.find((item) => item.participantId === 'ana');
    const beto = cola.find((item) => item.participantId === 'beto');
    expect(ana).toMatchObject({ notaDeLaRubrica: 10, descuentoDeIntegridad: 2.5, nota: 7.5 });
    expect(beto.nota).toBe(0);
  });

  it('una observación o una marca descartada no cambian la nota', () => {
    const cola = armarCola([
      texto('ana', 'Texto de Ana'),
      { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId: 'ana', niveles: { a: 'excelente', b: 'excelente' }, aprobada: true, enviadoEn: 2 },
      { nombre: EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD, participantId: 'ana', accion: 'observada', observacion: 'Hablar con la persona' },
    ]);
    expect(cola[0]).toMatchObject({ nota: 10, descuentoDeIntegridad: 0 });
    expect(cola[0].decisionDeIntegridad.observacion).toBe('Hablar con la persona');
  });
});
