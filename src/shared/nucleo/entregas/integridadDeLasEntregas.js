// Integridad de las entregas del control de lectura — ver docs/14-control-de-lectura.md.
//
// Junta las dos fuentes de advertencias para el docente: las señales de redacción que publicó cada
// estudiante por el canal privado (pegado, velocidad, cambio de pestaña) y el parecido entre textos. Todo
// es una advertencia con sus datos a la vista, no una prueba ni una sanción: el docente puede descartarla,
// dejar una observación o aplicar un descuento manual con motivo. Funciones puras.

import { CONTEXTOS_DE_REDACCION } from '../integridad/canalPrivado.js';
import {
  BANDAS_DE_SIMILITUD,
  ORIGENES_DE_SIMILITUD,
  analizarSimilitudDeLasEntregas,
  resolverUmbralesDeSimilitud,
} from '../integridad/similitudDeTextos.js';

export const ACCIONES_SOBRE_UNA_MARCA = {
  DESCARTADA: 'descartada',
  OBSERVADA: 'observada',
  DESCUENTO: 'descuento',
};

export const DESCUENTO_MAXIMO = 10;

const ORDEN_DE_LAS_BANDAS = [
  BANDAS_DE_SIMILITUD.SIN_INDICIO,
  BANDAS_DE_SIMILITUD.ATENCION,
  BANDAS_DE_SIMILITUD.ALTO,
  BANDAS_DE_SIMILITUD.PROBABLE_COPIA,
];

// Una señal de redacción alta pesa como «alto»; una media, como «atención»; una baja (cambiar de pestaña
// en el celular es normal) no alerta por sí sola.
const BANDA_POR_GRAVEDAD = { alta: BANDAS_DE_SIMILITUD.ALTO, media: BANDAS_DE_SIMILITUD.ATENCION, baja: BANDAS_DE_SIMILITUD.SIN_INDICIO };

const ORDEN_DE_LA_GRAVEDAD = { baja: 1, media: 2, alta: 3 };

function bandaMasAlta(bandaA, bandaB) {
  return ORDEN_DE_LAS_BANDAS.indexOf(bandaA) >= ORDEN_DE_LAS_BANDAS.indexOf(bandaB) ? bandaA : bandaB;
}

function listarReferencias(programa) {
  const referencias = [];
  if (String(programa?.textoDeReferencia ?? '').trim()) {
    referencias.push({ id: 'texto-de-la-lectura', origen: ORIGENES_DE_SIMILITUD.TEXTO_DE_REFERENCIA, texto: programa.textoDeReferencia });
  }
  (programa?.ejemplosPorTema ?? []).forEach((ejemplo, indice) => {
    if (String(ejemplo?.bueno ?? '').trim()) {
      referencias.push({ id: `ejemplo-${indice + 1}`, origen: ORIGENES_DE_SIMILITUD.EJEMPLO, texto: ejemplo.bueno });
    }
  });
  return referencias;
}

// `cola`: la cola del docente (con `texto` y `codigoAnonimo`). `registrosDeIntegridad`: lo que leyó el host
// del canal privado de integridad. `programa`: el Programa COMPLETO (trae el texto de referencia).
// Devuelve, por participantId: { similitud, senales, gravedadMaxima, banda }.
export function construirIntegridadPorEntrega({ cola, registrosDeIntegridad = [], programa }) {
  const conTexto = cola.filter((item) => item.texto);
  const etiquetaPorParticipante = Object.fromEntries(cola.map((item) => [item.participantId, item.etiqueta]));
  const similitudes = analizarSimilitudDeLasEntregas({
    entregas: conTexto.map((item) => ({ id: item.participantId, texto: item.texto })),
    referencias: listarReferencias(programa),
    umbrales: resolverUmbralesDeSimilitud(programa),
  });

  const resultado = {};
  for (const item of cola) {
    const similitudBruta = similitudes[item.participantId] ?? null;
    // Con otra entrega solo se muestra su código anónimo, nunca quién es.
    const nombrarConQuien = (conId, origen) => (origen === ORIGENES_DE_SIMILITUD.OTRA_ENTREGA ? (etiquetaPorParticipante[conId] ?? 'otra entrega') : conId);
    // `conId` (el participantId de la otra entrega) no sale de aquí: solo `conQuien`.
    const similitud = similitudBruta
      ? {
          porcentaje: similitudBruta.porcentaje,
          banda: similitudBruta.banda,
          origen: similitudBruta.origen,
          conQuien: similitudBruta.conId ? nombrarConQuien(similitudBruta.conId, similitudBruta.origen) : null,
          fragmentos: similitudBruta.fragmentos,
          coincidencias: similitudBruta.coincidencias.map((coincidencia) => ({
            origen: coincidencia.origen,
            porcentaje: coincidencia.porcentaje,
            conQuien: nombrarConQuien(coincidencia.conId, coincidencia.origen),
          })),
        }
      : null;

    const senales = registrosDeIntegridad
      .filter((registro) => registro.participantId === item.participantId && registro.contexto === CONTEXTOS_DE_REDACCION.ENTREGA_DE_LECTURA)
      .flatMap((registro) => registro.senales);
    const gravedadMaxima = senales.reduce(
      (maxima, senal) => ((ORDEN_DE_LA_GRAVEDAD[senal.gravedad] ?? 0) > (ORDEN_DE_LA_GRAVEDAD[maxima] ?? 0) ? senal.gravedad : maxima),
      null
    );

    resultado[item.participantId] = {
      similitud,
      senales,
      gravedadMaxima,
      banda: bandaMasAlta(similitud?.banda ?? BANDAS_DE_SIMILITUD.SIN_INDICIO, BANDA_POR_GRAVEDAD[gravedadMaxima] ?? BANDAS_DE_SIMILITUD.SIN_INDICIO),
    };
  }
  return resultado;
}

export function hayAlgoQueRevisar(integridadDeLaEntrega) {
  return Boolean(integridadDeLaEntrega) && integridadDeLaEntrega.banda !== BANDAS_DE_SIMILITUD.SIN_INDICIO;
}

// Lo que se guarda al decidir sobre una marca: se acotan la acción, el texto y el descuento.
export function normalizarDecisionDeIntegridad(datos) {
  const accion = Object.values(ACCIONES_SOBRE_UNA_MARCA).includes(datos?.accion) ? datos.accion : ACCIONES_SOBRE_UNA_MARCA.DESCARTADA;
  const descuento = accion === ACCIONES_SOBRE_UNA_MARCA.DESCUENTO ? Math.min(DESCUENTO_MAXIMO, Math.max(0, Number(datos?.descuento) || 0)) : 0;
  return {
    accion,
    observacion: String(datos?.observacion ?? '').trim().slice(0, 600),
    descuento: Math.round(descuento * 100) / 100,
  };
}
