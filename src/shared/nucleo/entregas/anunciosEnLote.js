// Anuncios EN LOTE del host al canal de la sala (control de lectura) — modos de sala grande y masivo.
//
// Cada hecho que protagoniza una persona (ingresar, entregar, enviar una revisión, responder a su devolución, recibir
// la devolución) se avisaba antes con un evento suelto. Ably entrega cada publicación a todos, así que con N personas
// eran N × N mensajes y con 80 o más el servicio rechazaba parte de ellos (prueba de carga del 4-oct-2026,
// docs/06-pendientes.md). Ahora la persona manda lo suyo SOLO por su canal privado (que lee únicamente el host) y el
// host, que ya lo tiene, anuncia a la sala lo nuevo cada pocos segundos en un mensaje por tipo: N mensajes por lote en
// vez de N × N en total. Qué se anuncia en lote depende del modo (modosDeAhorro.js). Funciones puras; las usa
// el hook del host (`useAnunciosEnLote`).

import { TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS } from './estadoPublicoDeEntregas.js';

// Cada cuánto como máximo se anuncia un lote. El primer aviso sale enseguida; los siguientes esperan este intervalo.
export const INTERVALO_ENTRE_AVISOS_EN_LOTE_MS = 5 * 1000;

// ¿La entrega llegó dentro de lo permitido? Mismo criterio que antes aplicaba el reducer a cada aviso suelto:
// con la escritura abierta, siempre; ya cerrada, solo lo que se envió mientras estaba abierta o el borrador
// «enviado por tiempo» dentro del margen. Se evalúa con la hora de llegada al servidor (`enviadoEn`), no con la
// del momento en que el host anuncia el lote.
export function laEntregaLlegoATiempo(estado, { enviadoEn, enviadoPorTiempo }) {
  if (estado.fase?.actual?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA) {
    return true;
  }
  const ultimaEscritura = [...(estado.fase?.historial ?? [])].reverse().find((fase) => fase.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA);
  if (!ultimaEscritura?.cerradaEn) {
    return false;
  }
  if (Number(enviadoEn) <= ultimaEscritura.cerradaEn) {
    return true;
  }
  return Boolean(enviadoPorTiempo) && Number(enviadoEn) - ultimaEscritura.cerradaEn <= MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS;
}

// ¿La revisión de un par se envió durante la fase de revisión? (Ahora o ya cerrada, si se envió mientras estaba abierta.)
export function laRevisionLlegoATiempo(estado, { enviadoEn }) {
  if (estado.fase?.actual?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES) {
    return true;
  }
  const ultimaRevision = [...(estado.fase?.historial ?? [])].reverse().find((fase) => fase.tipo === TIPOS_DE_FASE.REVISION_DE_PARES);
  return Boolean(ultimaRevision?.cerradaEn) && Number(enviadoEn) <= ultimaRevision.cerradaEn;
}

function claveDe(tipo, ...partes) {
  return [tipo, ...partes].join(':');
}

// Lo que el host tiene recibido por los canales privados y todavía no anunció a la sala, según lo que el modo anuncia
// en lote. `yaAnunciados`: Set de claves que el host ya mandó en un lote (aunque el eco aún no vuelva por el canal).
// Devuelve listas ya en el orden en que conviene publicarlas: ingresos, entregas, revisiones, confirmaciones, devoluciones.
export function calcularAnunciosPorHacer({ estado, estadoPrivado, perfil, yaAnunciados = new Set() }) {
  const resultado = { ingresos: [], entregas: [], revisiones: [], confirmaciones: [], devoluciones: [] };
  if (!perfil || !estadoPrivado) {
    return resultado;
  }
  const participantes = estado.participantes ?? {};
  const entregasPublicas = estado.lectura?.entregas ?? {};
  const revisionesPublicas = estado.lectura?.revisiones ?? {};

  // Modo masivo: quien entró por el canal privado todavía no existe en la sala.
  const ingresaranEnEsteLote = new Set();
  if (perfil.ingreso === 'privado') {
    for (const [participantId, ingreso] of Object.entries(estadoPrivado.ingresos ?? {})) {
      if (participantes[participantId]?.ingresoConfirmado || yaAnunciados.has(claveDe('ingreso', participantId))) {
        continue;
      }
      ingresaranEnEsteLote.add(participantId);
      resultado.ingresos.push({ participantId, nombre: ingreso.nombre, emoji: ingreso.emoji, enviadoEn: ingreso.enviadoEn });
    }
    resultado.ingresos.sort((a, b) => a.enviadoEn - b.enviadoEn);
  }

  // Entregas (todos los modos de sala grande).
  if (perfil.avisoDeEntregas === 'lote') {
    resultado.entregas = Object.entries(estadoPrivado.textos ?? {})
      .filter(
        ([participantId, entrega]) =>
          !entregasPublicas[participantId] &&
          !yaAnunciados.has(claveDe('entrega', participantId)) &&
          (participantes[participantId]?.ingresoConfirmado || ingresaranEnEsteLote.has(participantId)) &&
          laEntregaLlegoATiempo(estado, entrega)
      )
      .sort(([, entregaA], [, entregaB]) => entregaA.enviadoEn - entregaB.enviadoEn)
      .map(([participantId, entrega]) => ({
        participantId,
        palabras: entrega.palabras,
        parrafos: entrega.parrafos,
        enviadoPorTiempo: Boolean(entrega.enviadoPorTiempo),
        entregadaEn: entrega.enviadoEn,
      }));
  }

  if (perfil.avisosDeLaLectura !== 'lote') {
    return resultado;
  }
  const entregaronEnEsteLote = new Set(resultado.entregas.map((entrega) => entrega.participantId));
  const yaEntrego = (participantId) => Boolean(entregasPublicas[participantId]) || entregaronEnEsteLote.has(participantId);

  // Revisiones de pares enviadas.
  for (const [revisorId, porIndice] of Object.entries(estadoPrivado.revisionesEnviadas ?? {})) {
    for (const [indice, revision] of Object.entries(porIndice ?? {})) {
      if (
        revisionesPublicas[revisorId]?.[indice] ||
        yaAnunciados.has(claveDe('revision', revisorId, indice)) ||
        !yaEntrego(revisorId) ||
        !laRevisionLlegoATiempo(estado, revision)
      ) {
        continue;
      }
      resultado.revisiones.push({ participantId: revisorId, indice: Number(indice), enviadaEn: revision.enviadoEn });
    }
  }

  // Devoluciones del docente: la primera, y la revisada tras un desacuerdo.
  for (const [participantId, devolucion] of Object.entries(estadoPrivado.devoluciones ?? {})) {
    const publica = entregasPublicas[participantId];
    const faltaLaPrimera = !publica?.devueltaEn;
    const faltaLaRevisada = Boolean(devolucion.revisada) && Boolean(publica) && !publica.devolucionRevisada;
    if (!publica || (!faltaLaPrimera && !faltaLaRevisada) || yaAnunciados.has(claveDe('devolucion', participantId, devolucion.revisada ? 'revisada' : 'primera'))) {
      continue;
    }
    resultado.devoluciones.push({
      participantId,
      hasta: devolucion.hasta,
      revisada: Boolean(devolucion.revisada),
      devueltaEn: devolucion.devueltaEn,
    });
  }

  // Respuestas de los estudiantes a su devolución.
  for (const [participantId, confirmacion] of Object.entries(estadoPrivado.confirmaciones ?? {})) {
    const publica = entregasPublicas[participantId];
    if (!publica?.devueltaEn || publica.confirmacion || yaAnunciados.has(claveDe('confirmacion', participantId))) {
      continue;
    }
    resultado.confirmaciones.push({ participantId, decision: confirmacion.decision, confirmadaEn: confirmacion.enviadoEn });
  }

  return resultado;
}

export function contarAnunciosPorHacer(anuncios) {
  return Object.values(anuncios).reduce((suma, lista) => suma + lista.length, 0);
}

// Las claves de lo que contiene un conjunto de anuncios, para recordarlas como ya anunciadas.
export function clavesDeLosAnuncios(anuncios) {
  return [
    ...anuncios.ingresos.map(({ participantId }) => claveDe('ingreso', participantId)),
    ...anuncios.entregas.map(({ participantId }) => claveDe('entrega', participantId)),
    ...anuncios.revisiones.map(({ participantId, indice }) => claveDe('revision', participantId, indice)),
    ...anuncios.devoluciones.map(({ participantId, revisada }) => claveDe('devolucion', participantId, revisada ? 'revisada' : 'primera')),
    ...anuncios.confirmaciones.map(({ participantId }) => claveDe('confirmacion', participantId)),
  ];
}

// Cuánto esperar para anunciar el próximo lote (0 = ya).
export function esperaParaElProximoAviso({ ultimoAvisoEn, ahora = Date.now(), intervalo = INTERVALO_ENTRE_AVISOS_EN_LOTE_MS }) {
  return Math.max(0, (ultimoAvisoEn ?? 0) + intervalo - ahora);
}
