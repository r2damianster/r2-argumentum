import { describe, expect, it } from 'vitest';
import { EVENTOS_PRIVADOS } from './canalesPrivados.js';
import {
  ESTADOS_DE_CALIFICACION,
  asignarCodigosAnonimos,
  datosDeCalificacionDesdeSugerencia,
  seleccionarParaAprobarEnLote,
  construirColaDelDocente,
  construirDevolucionParaElEstudiante,
  reducirEstadoPrivado,
  reducirRegistrosPrivados,
  resumirLaCola,
} from './estadoPrivadoDelDocente.js';

const RUBRICA = [
  { id: 'a', nombre: 'Pertinencia', peso: 50 },
  { id: 'b', nombre: 'Estructura', peso: 50 },
];

function texto(participantId, contenido, enviadoEn = 1) {
  return { nombre: EVENTOS_PRIVADOS.ENTREGA_TEXTO, participantId, texto: contenido, enviadoPorTiempo: false, enviadoEn };
}

function calificacion(participantId, datos) {
  return { nombre: EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, participantId, enviadoEn: 10, ...datos };
}

function estadoPublicoConEntregas(...entregas) {
  return {
    lectura: {
      entregas: Object.fromEntries(
        entregas.map(([participantId, entregadaEn, extra]) => [
          participantId,
          { participantId, palabras: 10, parrafos: 1, entregadaEn, enviadaPorTiempo: false, devueltaEn: null, confirmacion: null, ...extra },
        ])
      ),
    },
  };
}

describe('reducirEstadoPrivado', () => {
  it('el primer texto de cada persona es el que vale', () => {
    const estado = reducirRegistrosPrivados([texto('ana', 'Primero'), texto('ana', 'Segundo')]);
    expect(estado.textos.ana.texto).toBe('Primero');
    expect(estado.textos.ana).toMatchObject({ palabras: 1, parrafos: 1 });
  });

  it('la confirmación y la reconsideración se resuelven una sola vez', () => {
    let estado = reducirEstadoPrivado(
      reducirEstadoPrivado({ ...reducirRegistrosPrivados([]) }, { nombre: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, participantId: 'ana', decision: 'en_desacuerdo', motivo: 'Uno' }),
      { nombre: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, participantId: 'ana', decision: 'de_acuerdo', motivo: '' }
    );
    expect(estado.confirmaciones.ana.decision).toBe('en_desacuerdo');

    estado = reducirEstadoPrivado(estado, { nombre: EVENTOS_PRIVADOS.RECONSIDERACION_RESUELTA, participantId: 'ana', resultado: 'cambia' });
    estado = reducirEstadoPrivado(estado, { nombre: EVENTOS_PRIVADOS.RECONSIDERACION_RESUELTA, participantId: 'ana', resultado: 'mantiene' });
    expect(estado.reconsideraciones.ana.resultado).toBe('cambia');
  });

  it('la última calificación reemplaza a la anterior', () => {
    const estado = reducirRegistrosPrivados([
      calificacion('ana', { niveles: { a: 'bueno' }, aprobada: false }),
      calificacion('ana', { niveles: { a: 'excelente', b: 'bueno' }, aprobada: true }),
    ]);
    expect(estado.calificaciones.ana.niveles).toEqual({ a: 'excelente', b: 'bueno' });
    expect(estado.calificaciones.ana.aprobada).toBe(true);
  });

  it('la devolución conserva su primer momento y su límite aunque se revise', () => {
    const estado = reducirRegistrosPrivados([
      { nombre: EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA, participantId: 'ana', hasta: 500, enviadoEn: 100 },
      { nombre: EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA, participantId: 'ana', hasta: 999, enviadoEn: 300, revisada: true },
    ]);
    expect(estado.devoluciones.ana).toEqual({ devueltaEn: 100, hasta: 500, revisada: true });
  });
});

describe('construirColaDelDocente', () => {
  it('el código anónimo no delata el orden de llegada y no cambia cuando llegan otras entregas', () => {
    const estadoPrivado = reducirRegistrosPrivados([texto('beto', 'Beto'), texto('ana', 'Ana'), texto('carla', 'Carla')]);
    const solasDosEntregas = construirColaDelDocente({
      estadoPrivado,
      estado: estadoPublicoConEntregas(['beto', 100], ['ana', 200]),
      rubrica: RUBRICA,
    });
    const conTresEntregas = construirColaDelDocente({
      estadoPrivado,
      estado: estadoPublicoConEntregas(['beto', 100], ['ana', 200], ['carla', 300]),
      rubrica: RUBRICA,
    });
    const codigoDe = (cola, participantId) => cola.find((item) => item.participantId === participantId).etiqueta;

    expect(codigoDe(conTresEntregas, 'ana')).toMatch(/^Entrega [0-9A-Z]{4}$/);
    expect(codigoDe(conTresEntregas, 'ana')).toBe(codigoDe(solasDosEntregas, 'ana'));
    expect(codigoDe(conTresEntregas, 'beto')).toBe(codigoDe(solasDosEntregas, 'beto'));
    expect(new Set(conTresEntregas.map((item) => item.etiqueta)).size).toBe(3);
  });

  it('pone primero lo que falta calificar', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      texto('beto', 'B'),
      calificacion('ana', { niveles: { a: 'excelente', b: 'bueno' }, aprobada: true }),
    ]);
    const cola = construirColaDelDocente({ estadoPrivado, estado: estadoPublicoConEntregas(['ana', 1], ['beto', 2]), rubrica: RUBRICA });
    expect(cola.map((item) => item.participantId)).toEqual(['beto', 'ana']);
  });

  it('un texto privado sin entrega pública se ignora; una entrega sin texto aparece como pendiente', () => {
    const estadoPrivado = reducirRegistrosPrivados([texto('intruso', 'Colado')]);
    const cola = construirColaDelDocente({ estadoPrivado, estado: estadoPublicoConEntregas(['ana', 1]), rubrica: RUBRICA });
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ participantId: 'ana', texto: null, textoPendiente: true });
  });

  it('clasifica la calificación y calcula la nota solo con niveles válidos', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      texto('beto', 'B'),
      texto('carla', 'C'),
      calificacion('ana', { niveles: { a: 'excelente', b: 'excelente' }, aprobada: true }),
      calificacion('beto', { niveles: { a: 'bueno', z: 'excelente' }, aprobada: false }),
      // «aprobada» con la rúbrica incompleta no cuenta como aprobada.
      calificacion('carla', { niveles: { a: 'excelente' }, aprobada: true }),
    ]);
    const cola = construirColaDelDocente({
      estadoPrivado,
      estado: estadoPublicoConEntregas(['ana', 1], ['beto', 2], ['carla', 3]),
      rubrica: RUBRICA,
    });
    const porId = Object.fromEntries(cola.map((item) => [item.participantId, item]));
    expect(porId.ana).toMatchObject({ estadoDeCalificacion: ESTADOS_DE_CALIFICACION.APROBADA, nota: 10 });
    expect(porId.beto.estadoDeCalificacion).toBe(ESTADOS_DE_CALIFICACION.BORRADOR);
    expect(porId.beto.calificacion.niveles).toEqual({ a: 'bueno' });
    expect(porId.carla.estadoDeCalificacion).toBe(ESTADOS_DE_CALIFICACION.BORRADOR);
  });

  it('trae el motivo de desacuerdo solo cuando la persona discrepó', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      { nombre: EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, participantId: 'ana', decision: 'en_desacuerdo', motivo: 'No entiendo el comentario' },
    ]);
    const cola = construirColaDelDocente({
      estadoPrivado,
      estado: estadoPublicoConEntregas(['ana', 1, { confirmacion: { decision: 'en_desacuerdo' }, devueltaEn: 5 }]),
      rubrica: RUBRICA,
    });
    expect(cola[0].motivoDeDesacuerdo).toBe('No entiendo el comentario');
  });
});

describe('sugerencia de la IA', () => {
  const sugerencia = {
    niveles: { a: 'bueno', b: 'excelente', inventado: 'bueno' },
    comentariosPorCriterio: { a: 'Tu texto responde.', inventado: 'x' },
    comentarioGeneral: 'Bien.',
    confianza: 0.9,
    completa: false,
  };

  it('queda en la cola, filtrada con la rúbrica, y la primera es la que vale', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      { nombre: EVENTOS_PRIVADOS.SUGERENCIA_DE_IA, participantId: 'ana', sugerencia },
      { nombre: EVENTOS_PRIVADOS.SUGERENCIA_DE_IA, participantId: 'ana', sugerencia: { ...sugerencia, confianza: 0.1 } },
    ]);
    const [item] = construirColaDelDocente({ estadoPrivado, estado: estadoPublicoConEntregas(['ana', 1]), rubrica: RUBRICA });
    expect(item.sugerenciaConsultada).toBe(true);
    expect(item.sugerencia.confianza).toBe(0.9);
    expect(item.sugerencia.niveles).toEqual({ a: 'bueno', b: 'excelente' });
    expect(item.sugerencia.comentariosPorCriterio).toEqual({ a: 'Tu texto responde.' });
    // Se recalcula con la rúbrica vigente: aquí los dos criterios tienen nivel.
    expect(item.sugerencia.completa).toBe(true);
  });

  it('una consulta que no dio sugerencia queda registrada para no repetirla', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      { nombre: EVENTOS_PRIVADOS.SUGERENCIA_DE_IA, participantId: 'ana', sugerencia: null, omitida: 'texto_muy_corto' },
    ]);
    const [item] = construirColaDelDocente({ estadoPrivado, estado: estadoPublicoConEntregas(['ana', 1]), rubrica: RUBRICA });
    expect(item).toMatchObject({ sugerencia: null, sugerenciaOmitida: 'texto_muy_corto', sugerenciaConsultada: true });
  });

  it('sin consulta, la entrega no tiene sugerencia', () => {
    const [item] = construirColaDelDocente({
      estadoPrivado: reducirRegistrosPrivados([texto('ana', 'A')]),
      estado: estadoPublicoConEntregas(['ana', 1]),
      rubrica: RUBRICA,
    });
    expect(item.sugerenciaConsultada).toBe(false);
  });
});

describe('aprobar en lote las sugerencias', () => {
  function sugerenciaDe(participantId, { confianza, niveles = { a: 'bueno', b: 'bueno' } }) {
    return {
      nombre: EVENTOS_PRIVADOS.SUGERENCIA_DE_IA,
      participantId,
      sugerencia: { niveles, comentariosPorCriterio: { a: 'Bien.' }, comentarioGeneral: 'Ok', confianza },
    };
  }

  it('solo selecciona lo que no tiene calificación, con sugerencia completa y confianza alta', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      texto('beto', 'B'),
      texto('carla', 'C'),
      texto('dani', 'D'),
      sugerenciaDe('ana', { confianza: 0.9 }),
      sugerenciaDe('beto', { confianza: 0.5 }),
      sugerenciaDe('carla', { confianza: 0.95, niveles: { a: 'bueno' } }),
      sugerenciaDe('dani', { confianza: 0.9 }),
      calificacion('dani', { niveles: { a: 'bueno', b: 'bueno' }, aprobada: false }),
    ]);
    const cola = construirColaDelDocente({
      estadoPrivado,
      estado: estadoPublicoConEntregas(['ana', 1], ['beto', 2], ['carla', 3], ['dani', 4]),
      rubrica: RUBRICA,
    });
    expect(seleccionarParaAprobarEnLote(cola).map((item) => item.participantId)).toEqual(['ana']);
  });

  it('convierte la sugerencia en datos de calificación, sin compartir referencias', () => {
    const sugerencia = { niveles: { a: 'bueno' }, comentariosPorCriterio: { a: 'Bien.' }, comentarioGeneral: 'Ok' };
    const datos = datosDeCalificacionDesdeSugerencia(sugerencia, { aprobada: true });
    expect(datos).toEqual({ niveles: { a: 'bueno' }, comentariosPorCriterio: { a: 'Bien.' }, comentarioGeneral: 'Ok', aprobada: true });
    datos.niveles.a = 'excelente';
    expect(sugerencia.niveles.a).toBe('bueno');
  });
});

describe('asignarCodigosAnonimos', () => {
  it('es determinista y no repite códigos', () => {
    const ids = Array.from({ length: 60 }, (_, indice) => `participante-${indice}`);
    const primeros = asignarCodigosAnonimos(ids);
    const segundos = asignarCodigosAnonimos([...ids].reverse());
    expect(primeros).toEqual(segundos);
    expect(new Set(Object.values(primeros)).size).toBe(60);
  });
});

describe('devolución al estudiante y podio', () => {
  it('la devolución lleva comentarios por criterio y nunca niveles ni nota', () => {
    const devolucion = construirDevolucionParaElEstudiante({
      rubrica: RUBRICA,
      calificacion: {
        niveles: { a: 'insuficiente', b: 'excelente' },
        nota: 5,
        comentariosPorCriterio: { a: 'Falta responder a la consigna.', z: 'ignorado' },
        comentarioGeneral: 'Buen intento.',
      },
    });
    expect(devolucion).toEqual({
      criterios: [{ criterioId: 'a', nombre: 'Pertinencia', comentario: 'Falta responder a la consigna.' }],
      comentarioGeneral: 'Buen intento.',
      revisionesDePares: [],
    });
    expect(JSON.stringify(devolucion)).not.toMatch(/insuficiente|excelente|nota/i);
  });

  it('la devolución incluye los comentarios de pares aprobados, sin niveles, y descarta los vacíos', () => {
    const devolucion = construirDevolucionParaElEstudiante({
      rubrica: RUBRICA,
      calificacion: { comentariosPorCriterio: {} },
      revisionesDePares: [
        { comentariosPorCriterio: { a: 'Me gustó tu ejemplo.', z: 'ignorado' }, comentarioGeneral: 'Sigue así.' },
        { comentariosPorCriterio: {}, comentarioGeneral: '' },
      ],
    });
    expect(devolucion.revisionesDePares).toEqual([
      { criterios: [{ criterioId: 'a', nombre: 'Pertinencia', comentario: 'Me gustó tu ejemplo.' }], comentarioGeneral: 'Sigue así.' },
    ]);
  });

  it('resume la cola para el docente', () => {
    const estadoPrivado = reducirRegistrosPrivados([
      texto('ana', 'A'),
      texto('beto', 'B'),
      calificacion('ana', { niveles: { a: 'excelente', b: 'bueno' }, aprobada: true }),
    ]);
    const cola = construirColaDelDocente({ estadoPrivado, estado: estadoPublicoConEntregas(['ana', 1], ['beto', 2]), rubrica: RUBRICA });
    expect(resumirLaCola(cola)).toMatchObject({ total: 2, sinCalificar: 1, aprobadas: 1, porDevolver: 1, devueltas: 0 });
  });
});
