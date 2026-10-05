// Estado PÚBLICO de las entregas individuales (control de lectura) — ver docs/14-control-de-lectura.md.
//
// Por el canal de la sala viaja lo que cualquiera puede ver: quién entregó, cuántas palabras y
// párrafos, si ya se devolvió y qué respondió la persona. El texto, los comentarios y las notas
// nunca pasan por aquí (van por canales privados). Función pura: la usa el reducer del log y no
// conoce ninguna actividad.
//
// Cada hecho puede llegar de dos maneras (ver nucleo/capacidad/modosDeAhorro.js): como aviso SUELTO de quien lo
// protagoniza (modo de sala pequeña) o dentro de un LOTE que anuncia el host (modos de sala grande y masivo). El
// lote exige que lo publique el host, que ya validó cada entrada contra lo que recibió por los canales privados.

import { DECISIONES_DE_CONFIRMACION, EVENTOS, TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';

const IDENTIDAD_DEL_HOST = 'host';
// Una entrega «por tiempo» (el borrador que se envía solo al llegar a cero) tarda unos segundos en
// llegar después de que el host cierra la escritura: se acepta dentro de este margen.
export const MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS = 2 * 60 * 1000;
const MAXIMO_DE_PALABRAS_ACEPTADO = 20000;
const MAXIMO_DE_LUGARES_DEL_PODIO = 10;
// Máximo de entradas que acepta un solo aviso en lote.
const MAXIMO_DE_ENTRADAS_POR_LOTE = 500;
const MAXIMO_DE_INDICE_DE_REVISION = 9;

export function estadoInicialDeEntregas() {
  return { entregas: {}, revisiones: {}, podio: null };
}

export function idDeLaEntrega(participantId) {
  return `entrega-${participantId}`;
}

function elEmisorEs(evento, identidadEsperada) {
  return evento.clientId === undefined || evento.clientId === identidadEsperada;
}

function numeroAcotado(valor, maximo) {
  const numero = Math.floor(Number(valor));
  return Number.isFinite(numero) && numero >= 0 ? Math.min(numero, maximo) : 0;
}

function laEscrituraEstaAbierta(estado, data) {
  if (estado.fase.actual?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA) {
    return true;
  }
  if (!data.enviadoPorTiempo) {
    return false;
  }
  const ultimaEscritura = [...estado.fase.historial].reverse().find((fase) => fase.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA);
  return Boolean(
    ultimaEscritura?.cerradaEn &&
      Number(data.timestamp ?? 0) - ultimaEscritura.cerradaEn <= MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS
  );
}

function crearEntregaPublica(data, timestamp) {
  return {
    entregaId: idDeLaEntrega(data.participantId),
    participantId: data.participantId,
    palabras: numeroAcotado(data.palabras, MAXIMO_DE_PALABRAS_ACEPTADO),
    parrafos: numeroAcotado(data.parrafos, 1000),
    entregadaEn: timestamp ?? null,
    enviadaPorTiempo: Boolean(data.enviadoPorTiempo),
    devueltaEn: null,
    confirmaHasta: null,
    devolucionRevisada: false,
    confirmacion: null,
  };
}

// --- Cambios sobre `lectura` comunes al aviso suelto y al lote: devuelven la MISMA `lectura` si no hay nada que cambiar.

function conEntregaDevuelta(lectura, { participantId, hasta, revisada, timestamp }) {
  const entrega = lectura.entregas[participantId];
  if (!entrega) {
    return lectura;
  }
  return {
    ...lectura,
    entregas: {
      ...lectura.entregas,
      [participantId]: {
        ...entrega,
        // La primera devolución fija el inicio de la ventana; una devolución revisada (tras un desacuerdo) no la reabre.
        devueltaEn: entrega.devueltaEn ?? timestamp ?? null,
        confirmaHasta: entrega.confirmaHasta ?? (Number(hasta) || null),
        devolucionRevisada: entrega.devolucionRevisada || Boolean(revisada),
      },
    },
  };
}

function conEntregaConfirmada(lectura, { participantId, decision, timestamp }) {
  const entrega = lectura.entregas[participantId];
  if (!entrega || !entrega.devueltaEn || entrega.confirmacion || !Object.values(DECISIONES_DE_CONFIRMACION).includes(decision)) {
    return lectura;
  }
  return {
    ...lectura,
    entregas: { ...lectura.entregas, [participantId]: { ...entrega, confirmacion: { decision, confirmadaEn: timestamp ?? null } } },
  };
}

function conRevisionEnviada(lectura, { participantId, indice, timestamp }) {
  const posicion = Math.floor(Number(indice));
  if (
    !lectura.entregas[participantId] ||
    !Number.isInteger(posicion) ||
    posicion < 0 ||
    posicion > MAXIMO_DE_INDICE_DE_REVISION ||
    lectura.revisiones?.[participantId]?.[posicion]
  ) {
    return lectura;
  }
  return {
    ...lectura,
    revisiones: {
      ...lectura.revisiones,
      [participantId]: { ...lectura.revisiones?.[participantId], [posicion]: { enviadaEn: timestamp ?? null } },
    },
  };
}

function estadoConLectura(estado, lecturaOriginal, lecturaNueva) {
  return lecturaNueva === lecturaOriginal ? estado : { ...estado, lectura: lecturaNueva };
}

// Aplica una lista de entradas de un lote, con `aplicar(lectura, entrada)` por cada una. Solo el host puede anunciar lotes.
function aplicarLote(estado, evento, lista, aplicar) {
  const lectura = estado.lectura ?? estadoInicialDeEntregas();
  if (!elEmisorEs(evento, IDENTIDAD_DEL_HOST) || !Array.isArray(lista)) {
    return estado;
  }
  let siguiente = lectura;
  for (const entrada of lista.slice(0, MAXIMO_DE_ENTRADAS_POR_LOTE)) {
    siguiente = aplicar(siguiente, entrada ?? {});
  }
  return siguiente === lectura ? estado : { ...estado, lectura: siguiente };
}

// Devuelve el estado nuevo, o `undefined` si el evento no es de este módulo (el reducer sigue con
// los demás casos). Un evento inválido o repetido devuelve el estado sin cambios.
export function aplicarEventoDeEntregas(estado, evento) {
  const { name, data } = evento;
  const lectura = estado.lectura ?? estadoInicialDeEntregas();

  switch (name) {
    case EVENTOS.LECTURA_ENTREGA_REGISTRADA: {
      const participante = estado.participantes[data.participantId];
      if (
        !participante?.ingresoConfirmado ||
        data.participantId === IDENTIDAD_DEL_HOST ||
        lectura.entregas[data.participantId] ||
        !elEmisorEs(evento, data.participantId) ||
        !laEscrituraEstaAbierta(estado, data)
      ) {
        return estado;
      }
      return {
        ...estado,
        lectura: {
          ...lectura,
          entregas: { ...lectura.entregas, [data.participantId]: crearEntregaPublica(data, data.timestamp) },
        },
      };
    }

    // El host anuncia varias entregas de una vez. Él ya comprobó que cada una llegó a tiempo (ver
    // anunciosEnLote.js), así que aquí solo se exige que el emisor sea el host y que quien entregó haya ingresado.
    case EVENTOS.LECTURA_ENTREGAS_REGISTRADAS:
      return aplicarLote(estado, evento, data.entregas, (acumulada, entrega) => {
        const participantId = entrega.participantId;
        if (!estado.participantes[participantId]?.ingresoConfirmado || participantId === IDENTIDAD_DEL_HOST || acumulada.entregas[participantId]) {
          return acumulada;
        }
        return {
          ...acumulada,
          entregas: {
            ...acumulada.entregas,
            [participantId]: crearEntregaPublica({ ...entrega, participantId }, Number(entrega.entregadaEn) || data.timestamp),
          },
        };
      });

    case EVENTOS.LECTURA_DEVUELTA: {
      if (!elEmisorEs(evento, IDENTIDAD_DEL_HOST)) {
        return estado;
      }
      return estadoConLectura(estado, lectura, conEntregaDevuelta(lectura, { participantId: data.participantId, hasta: data.hasta, revisada: data.revisada, timestamp: data.timestamp }));
    }

    case EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS:
      return aplicarLote(estado, evento, data.devoluciones, (acumulada, devolucion) =>
        conEntregaDevuelta(acumulada, { ...devolucion, timestamp: Number(devolucion.devueltaEn) || data.timestamp })
      );

    case EVENTOS.LECTURA_CONFIRMADA: {
      const esAutomatica = data.decision === DECISIONES_DE_CONFIRMACION.AUTOMATICA;
      // Una respuesta propia solo vale si la publicó la misma persona; la automática, solo el host.
      const emisorValido = esAutomatica ? elEmisorEs(evento, IDENTIDAD_DEL_HOST) : elEmisorEs(evento, data.participantId);
      if (!emisorValido) {
        return estado;
      }
      return estadoConLectura(estado, lectura, conEntregaConfirmada(lectura, { participantId: data.participantId, decision: data.decision, timestamp: data.timestamp }));
    }

    case EVENTOS.LECTURA_CONFIRMACIONES_REGISTRADAS:
      return aplicarLote(estado, evento, data.confirmaciones, (acumulada, confirmacion) =>
        conEntregaConfirmada(acumulada, { ...confirmacion, timestamp: Number(confirmacion.confirmadaEn) || data.timestamp })
      );

    // Quien revisa a un par avisa que ya envió una de sus revisiones (el contenido va por el canal privado).
    // Solo vale durante la fase de revisión, de alguien que entregó, y la primera de cada una es la que cuenta.
    case EVENTOS.LECTURA_REVISION_ENVIADA: {
      if (estado.fase.actual?.tipo !== TIPOS_DE_FASE.REVISION_DE_PARES || !elEmisorEs(evento, data.participantId)) {
        return estado;
      }
      return estadoConLectura(estado, lectura, conRevisionEnviada(lectura, { participantId: data.participantId, indice: data.indice, timestamp: data.timestamp }));
    }

    case EVENTOS.LECTURA_REVISIONES_REGISTRADAS:
      return aplicarLote(estado, evento, data.revisiones, (acumulada, revision) =>
        conRevisionEnviada(acumulada, { ...revision, timestamp: Number(revision.enviadaEn) || data.timestamp })
      );

    case EVENTOS.LECTURA_PODIO_PUBLICADO: {
      if (!elEmisorEs(evento, IDENTIDAD_DEL_HOST) || !Array.isArray(data.lugares)) {
        return estado;
      }
      const lugares = data.lugares.slice(0, MAXIMO_DE_LUGARES_DEL_PODIO).map((lugar, indice) => ({
        lugar: indice + 1,
        participantIds: Array.isArray(lugar?.participantIds) ? lugar.participantIds.map(String) : [],
      }));
      return { ...estado, lectura: { ...lectura, podio: lugares } };
    }

    default:
      return undefined;
  }
}

// Contadores para el docente y la proyección. Cuenta solo a quienes ingresaron y no son el host.
export function contarAvanceDeLasEntregas(estado) {
  const participantes = Object.values(estado.participantes ?? {}).filter((participante) => participante.ingresoConfirmado);
  const entregas = Object.values(estado.lectura?.entregas ?? {});
  const entregaron = entregas.length;
  const devueltas = entregas.filter((entrega) => entrega.devueltaEn).length;
  const confirmadas = entregas.filter((entrega) => entrega.confirmacion).length;
  return {
    participantes: participantes.length,
    entregaron,
    escribiendo: Math.max(0, participantes.length - entregaron),
    devueltas,
    confirmadas,
    enDesacuerdo: entregas.filter((entrega) => entrega.confirmacion?.decision === DECISIONES_DE_CONFIRMACION.EN_DESACUERDO).length,
    enviadasPorTiempo: entregas.filter((entrega) => entrega.enviadaPorTiempo).length,
    revisionesEnviadas: Object.values(estado.lectura?.revisiones ?? {}).reduce(
      (suma, delRevisor) => suma + Object.keys(delRevisor).length,
      0
    ),
  };
}
