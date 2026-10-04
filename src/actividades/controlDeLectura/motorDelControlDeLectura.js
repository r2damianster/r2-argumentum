// Procesos del motor propios del CONTROL DE LECTURA — ver docs/14-control-de-lectura.md.
//
// No hay ruleta, turnos ni puntaje por aporte: cada persona escribe su entrega durante un tiempo total.
// El motor (que corre solo en la consola del host) lleva el tiempo de las fases, confirma solas las
// devoluciones cuya ventana venció y, al cerrar, publica el podio. La nota nunca sale del host: el
// podio se calcula con el estado privado del docente y se publica sin notas.

import { DECISIONES_DE_CONFIRMACION, EVENTOS, TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import {
  MINUTOS_DE_UNA_EXTENSION,
  calcularTiempoRestante,
} from '../../shared/nucleo/temporizador/calcularTiempoRestante.js';
import { resolverRubricaDelPrograma } from '../../shared/nucleo/rubrica/rubrica.js';
import { calcularPodioPorNota } from '../../shared/nucleo/podio/calcularPodioPorNota.js';
import { construirColaDelDocente, estadoPrivadoInicial } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { calcularPuntosDeRevisores, calcularPuntuacionesDelPodio } from '../../shared/nucleo/entregas/revisionesEntrePares.js';

const TIPOS_DE_FASE_CON_TIEMPO = [TIPOS_DE_FASE.CONTROL_DE_LECTURA, TIPOS_DE_FASE.REVISION_DE_PARES];

export function crearProcesosDelControlDeLectura(servicios) {
  const { programa, obtenerContexto, yaSeHizo, comenzarAccion, estaCerrada, cerrarFaseActual } = servicios;

  // Al llegar a cero se cierra la fase. El tiempo se deduce de lo que ya viaja en el log (inicio,
  // duración y extensiones), no de un temporizador en memoria: si el host refresca la pestaña, el motor
  // nuevo llega a la misma conclusión.
  function cerrarLaFaseSiSeAgotoElTiempo() {
    const { estado } = obtenerContexto();
    const fase = estado?.fase.actual;
    if (!fase || !TIPOS_DE_FASE_CON_TIEMPO.includes(fase.tipo) || !fase.duracionMin) {
      return;
    }
    const { haVencido } = calcularTiempoRestante({
      iniciadaEn: fase.iniciadaEn,
      duracionMin: fase.duracionMin,
      extensionesMin: fase.extensionesMin ?? 0,
    });
    // Una extensión cambia la clave: si se vuelve a agotar, vuelve a cerrar.
    const clave = `lectura-vencida:${fase.tipo}:${fase.iniciadaEn}:${fase.extensionesMin ?? 0}`;
    if (haVencido && !yaSeHizo(clave)) {
      comenzarAccion(clave);
      cerrarFaseActual();
    }
  }

  // Quien no responde a la devolución dentro de la ventana queda confirmada con la nota asignada: el
  // docente fijó la ventana y la clase no se puede quedar esperando.
  function confirmarSolasLasDevolucionesVencidas() {
    const { estado, publicar } = obtenerContexto();
    for (const entrega of Object.values(estado?.lectura?.entregas ?? {})) {
      if (!entrega.devueltaEn || entrega.confirmacion || !entrega.confirmaHasta || Date.now() < entrega.confirmaHasta) {
        continue;
      }
      const clave = `lectura-confirmacion-automatica:${entrega.participantId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      comenzarAccion(clave);
      publicar(EVENTOS.LECTURA_CONFIRMADA, {
        participantId: entrega.participantId,
        decision: DECISIONES_DE_CONFIRMACION.AUTOMATICA,
        claveDeIdempotencia: clave,
      });
    }
  }

  function extenderTiempo(minutos = MINUTOS_DE_UNA_EXTENSION) {
    const { estado, publicar } = obtenerContexto();
    if (!estado || estaCerrada() || !TIPOS_DE_FASE_CON_TIEMPO.includes(estado.fase.actual?.tipo)) {
      return;
    }
    publicar(EVENTOS.FASE_EXTENDIDA, { minutos });
  }

  // El podio sale de las calificaciones aprobadas y de los puntos de quienes revisaron entre pares (estado
  // privado del docente) y se publica sin notas ni puntos: solo quién ocupa cada lugar.
  function publicarElPodio() {
    const { estado, estadoPrivado, publicar } = obtenerContexto();
    const clave = 'lectura-podio';
    if (!estado || yaSeHizo(clave)) {
      return;
    }
    const programaVigente = estado.programa ?? programa;
    const estadoPrivadoVigente = estadoPrivado ?? estadoPrivadoInicial();
    const rubrica = resolverRubricaDelPrograma(programaVigente);
    const cola = construirColaDelDocente({ estadoPrivado: estadoPrivadoVigente, estado, rubrica });
    const puntosDeRevisores = calcularPuntosDeRevisores({ estadoPrivado: estadoPrivadoVigente, estado, rubrica, cola });
    const lugares = calcularPodioPorNota(calcularPuntuacionesDelPodio({ cola, puntosDeRevisores }));
    comenzarAccion(clave);
    publicar(EVENTOS.LECTURA_PODIO_PUBLICADO, { lugares, claveDeIdempotencia: clave });
  }

  return {
    alSincronizarDespuesDelPuntaje() {
      cerrarLaFaseSiSeAgotoElTiempo();
      confirmarSolasLasDevolucionesVencidas();
    },
    // Aquí no hay puntaje por aporte: el podio se publica al cerrar, desde las calificaciones.
    calcularPuntajeProvisional: () => null,
    calcularAjustesAlCierre: () => [],
    antesDeCerrarLaSesion: publicarElPodio,
    acciones: { extenderTiempo },
  };
}
