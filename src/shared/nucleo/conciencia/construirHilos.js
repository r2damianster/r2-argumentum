// Arma los hilos de un foro a partir del estado: cada post con sus réplicas anidadas — ver
// docs/13-foro-escrito-y-nucleo-reutilizable.md. Función pura, independiente de la actividad.
//
//   hilo = { aporte, respuestas: [hilo…], totalDeRespuestas, ultimaActividad }
//
// Una réplica a una réplica queda anidada bajo ella (la contrarréplica del derecho a réplica).

import { indexarObjetivosDeRespuesta, indexarPorId } from './calcularMetricasDeParticipacion.js';

function ordenarPorFecha(aportes) {
  return [...aportes].sort((aporteA, aporteB) => (aporteA.timestamp ?? 0) - (aporteB.timestamp ?? 0));
}

export function construirHilos(estado, { incluirOcultos = false } = {}) {
  const aportes = Object.values(estado.argumentos ?? {}).filter((aporte) => incluirOcultos || !aporte.oculto);
  const aportesPorId = indexarPorId(aportes);
  const objetivoPorAporte = indexarObjetivosDeRespuesta(estado, aportesPorId);

  const respuestasPorAporte = {};
  for (const aporte of aportes) {
    const idDelObjetivo = objetivoPorAporte[aporte.argumentId];
    if (idDelObjetivo) {
      respuestasPorAporte[idDelObjetivo] = [...(respuestasPorAporte[idDelObjetivo] ?? []), aporte];
    }
  }

  function armar(aporte, vistos = new Set()) {
    // Una referencia circular no debería existir, pero un log dañado no debe colgar la pantalla.
    if (vistos.has(aporte.argumentId)) {
      return { aporte, respuestas: [], totalDeRespuestas: 0, ultimaActividad: aporte.timestamp ?? 0 };
    }
    const siguientesVistos = new Set(vistos).add(aporte.argumentId);
    const respuestas = ordenarPorFecha(respuestasPorAporte[aporte.argumentId] ?? []).map((respuesta) =>
      armar(respuesta, siguientesVistos)
    );
    return {
      aporte,
      respuestas,
      totalDeRespuestas: respuestas.reduce((suma, respuesta) => suma + 1 + respuesta.totalDeRespuestas, 0),
      ultimaActividad: Math.max(aporte.timestamp ?? 0, ...respuestas.map((respuesta) => respuesta.ultimaActividad)),
    };
  }

  return aportes.filter((aporte) => !objetivoPorAporte[aporte.argumentId]).map((post) => armar(post));
}

export const ORDENES_DE_HILOS = {
  RECIENTES: 'recientes',
  SIN_DEBATIR_PRIMERO: 'sin_debatir_primero',
};

export function ordenarHilos(hilos, orden = ORDENES_DE_HILOS.RECIENTES) {
  const porActividadReciente = (hiloA, hiloB) => hiloB.ultimaActividad - hiloA.ultimaActividad;
  if (orden === ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO) {
    return [...hilos].sort((hiloA, hiloB) => {
      const sinDebatirA = hiloA.totalDeRespuestas === 0;
      const sinDebatirB = hiloB.totalDeRespuestas === 0;
      if (sinDebatirA !== sinDebatirB) {
        return sinDebatirA ? -1 : 1;
      }
      // Entre los que esperan, el más antiguo primero: lleva más tiempo sin respuesta.
      return sinDebatirA
        ? (hiloA.aporte.timestamp ?? 0) - (hiloB.aporte.timestamp ?? 0)
        : porActividadReciente(hiloA, hiloB);
    });
  }
  return [...hilos].sort(porActividadReciente);
}
