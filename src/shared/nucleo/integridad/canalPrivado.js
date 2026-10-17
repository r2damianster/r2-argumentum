// Mensajes del canal privado de integridad — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Los participantes solo pueden PUBLICAR en `debate:integridad:{sala}`; leerlo es exclusivo del host
// (capacidades del token en api/ably-token.js). Lo que sigue es lo que el host exige de cada mensaje
// antes de aceptarlo: que lo haya publicado quien dice ser (el `clientId` lo pone Ably a partir del
// token firmado) y que tenga la forma esperada, con tamaños acotados.

import { GRAVEDADES } from './recolectorDeSenales.js';

export const NOMBRE_DEL_EVENTO_DE_INTEGRIDAD = 'integridad.senal';
// Va por el mismo canal privado (solo el host lo lee): la sugerencia de la IA sobre el patrón de escritura.
export const NOMBRE_DEL_EVENTO_DEL_PATRON = 'patron.sugerencia';

export const CONTEXTOS_DE_REDACCION = {
  FORO: 'foro',
  INGRESO: 'ingreso',
  PREPARACION: 'preparacion',
  CONTRAARGUMENTO_DE_OYENTE: 'contraargumento_de_oyente',
  ENTREGA_DE_LECTURA: 'entrega_de_lectura',
};

const MAXIMO_DE_SENALES_POR_MENSAJE = 10;
const MAXIMO_DE_CARACTERES_DEL_DETALLE = 300;
const GRAVEDADES_VALIDAS = Object.values(GRAVEDADES);

function acotarTexto(valor, maximo) {
  return String(valor ?? '').slice(0, maximo);
}

// Devuelve el registro limpio o null si el mensaje no es de fiar.
export function procesarMensajeDeIntegridad(mensaje) {
  const carga = mensaje?.data;
  if (!carga || typeof carga !== 'object') {
    return null;
  }
  // Nadie puede acusar a otra persona: la marca vale solo si la publicó quien dice ser.
  if (!mensaje.clientId || mensaje.clientId !== carga.participantId) {
    return null;
  }
  if (!Array.isArray(carga.senales) || carga.senales.length === 0) {
    return null;
  }

  const senales = carga.senales
    .slice(0, MAXIMO_DE_SENALES_POR_MENSAJE)
    .filter((senal) => GRAVEDADES_VALIDAS.includes(senal?.gravedad) && typeof senal?.tipo === 'string')
    .map((senal) => ({
      tipo: acotarTexto(senal.tipo, 40),
      gravedad: senal.gravedad,
      detalle: acotarTexto(senal.detalle, MAXIMO_DE_CARACTERES_DEL_DETALLE),
    }));
  if (senales.length === 0) {
    return null;
  }

  return {
    idDelMensaje: mensaje.id ?? `${mensaje.clientId}-${mensaje.timestamp}-${carga.argumentId ?? ''}`,
    participantId: carga.participantId,
    argumentId: carga.argumentId ? acotarTexto(carga.argumentId, 80) : null,
    contexto: Object.values(CONTEXTOS_DE_REDACCION).includes(carga.contexto) ? carga.contexto : null,
    senales,
    gravedadMaxima: GRAVEDADES_VALIDAS.includes(carga.gravedadMaxima) ? carga.gravedadMaxima : senales[0].gravedad,
    estadisticas: carga.estadisticas && typeof carga.estadisticas === 'object' ? carga.estadisticas : {},
    advertenciaMostrada: Boolean(carga.advertenciaMostrada),
    // Qué parte del texto se pegó (0 a 1): el host la usa para el descuento automático del control de lectura.
    proporcionPenalizada: Math.min(1, Math.max(0, Number(carga.estadisticas?.proporcionPenalizada ?? carga.proporcionPenalizada) || 0)),
    enviadoEn: Number(mensaje.timestamp ?? carga.enviadoEn ?? 0),
  };
}

const MAXIMO_DE_PARTES_DEL_PATRON = 8;

function listaDeNombresDePartes(valor) {
  return Array.isArray(valor)
    ? valor.slice(0, MAXIMO_DE_PARTES_DEL_PATRON).map((nombre) => acotarTexto(nombre, 80)).filter(Boolean)
    : [];
}

// Sugerencia de la IA sobre el patrón de escritura de un argumento. Misma regla de confianza que la integridad:
// vale solo si la publicó quien dice ser. Devuelve el registro limpio o null.
export function procesarMensajeDelPatron(mensaje) {
  const carga = mensaje?.data;
  if (!carga || typeof carga !== 'object' || !mensaje.clientId || mensaje.clientId !== carga.participantId) {
    return null;
  }
  const partesPresentes = listaDeNombresDePartes(carga.partesPresentes);
  const partesFaltantes = listaDeNombresDePartes(carga.partesFaltantes);
  if (!carga.argumentId || partesPresentes.length + partesFaltantes.length === 0) {
    return null;
  }
  return {
    idDelMensaje: mensaje.id ?? `${mensaje.clientId}-${mensaje.timestamp}-${carga.argumentId}`,
    participantId: carga.participantId,
    argumentId: acotarTexto(carga.argumentId, 80),
    modo: acotarTexto(carga.modo, 40),
    estructura: acotarTexto(carga.estructura, 40),
    nombre: acotarTexto(carga.nombre, 80),
    partesPresentes,
    partesFaltantes,
    enviadoEn: Number(mensaje.timestamp ?? carga.enviadoEn ?? 0),
  };
}

// Agrupa los registros por persona, con lo más grave y lo más reciente primero.
export function agruparSenalesPorParticipante(registros) {
  const orden = { alta: 3, media: 2, baja: 1 };
  const porParticipante = new Map();
  for (const registro of registros) {
    if (!porParticipante.has(registro.participantId)) {
      porParticipante.set(registro.participantId, []);
    }
    porParticipante.get(registro.participantId).push(registro);
  }
  return [...porParticipante.entries()]
    .map(([participantId, delParticipante]) => ({
      participantId,
      registros: [...delParticipante].sort((registroA, registroB) => registroB.enviadoEn - registroA.enviadoEn),
      gravedadMaxima: delParticipante.reduce(
        (maxima, registro) => (orden[registro.gravedadMaxima] > orden[maxima] ? registro.gravedadMaxima : maxima),
        'baja'
      ),
    }))
    .sort((grupoA, grupoB) => {
      if (orden[grupoA.gravedadMaxima] !== orden[grupoB.gravedadMaxima]) {
        return orden[grupoB.gravedadMaxima] - orden[grupoA.gravedadMaxima];
      }
      return grupoB.registros.length - grupoA.registros.length;
    });
}
