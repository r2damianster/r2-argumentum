// Procesos del motor propios del FORO ESCRITO — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// No hay ruleta ni turnos: cualquiera publica cuando quiere durante el tiempo total. El motor solo
// lleva el tiempo (cierra la escritura al llegar a cero), acredita el puntaje provisional de cada
// aporte con sus topes, y expone la acción de extender el tiempo.

import { EVENTOS, TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { calcularAjustesAlCierreDelForo, puntajeProvisionalDelAporte } from './ajustesAlCierreDelForo.js';
import {
  MINUTOS_DE_UNA_EXTENSION,
  calcularTiempoRestante,
} from '../../shared/nucleo/temporizador/calcularTiempoRestante.js';

export function crearProcesosDelForo(servicios) {
  const { programa, obtenerContexto, parametrosDePuntajeVigentes, yaSeHizo, comenzarAccion, estaCerrada, cerrarFaseActual } =
    servicios;

  // Al llegar a cero se cierra la escritura y sigue la fase de revisión final. El tiempo se deduce
  // de lo que ya viaja en el log (inicio, duración y extensiones), no de un temporizador en
  // memoria: si el host refresca la pestaña, el motor nuevo llega a la misma conclusión.
  function cerrarEscrituraSiSeAgotoElTiempo() {
    const { estado } = obtenerContexto();
    const fase = estado?.fase.actual;
    if (!fase || fase.tipo !== TIPOS_DE_FASE.FORO_ESCRITO || !fase.duracionMin) {
      return;
    }
    const { haVencido } = calcularTiempoRestante({
      iniciadaEn: fase.iniciadaEn,
      duracionMin: fase.duracionMin,
      extensionesMin: fase.extensionesMin ?? 0,
    });
    // Una extensión cambia la clave: si se vuelve a agotar, vuelve a cerrar.
    const clave = `foro-vencido:${fase.iniciadaEn}:${fase.extensionesMin ?? 0}`;
    if (haVencido && !yaSeHizo(clave)) {
      comenzarAccion(clave);
      cerrarFaseActual();
    }
  }

  // Cada post y cada réplica vale según el lugar que ocupa entre los de su tipo, con los topes del
  // Programa (3 posts nuevos y 5 réplicas puntuadas por defecto). Lo que pasa de los topes se
  // publica y se ve, pero vale 0 (no se acredita nada).
  function calcularPuntajeProvisional(argumento, estado) {
    const { puntaje, esReplica, ordinalDelTipo } = puntajeProvisionalDelAporte(
      { ...estado, programa: estado.programa ?? programa },
      argumento,
      parametrosDePuntajeVigentes()
    );
    if (puntaje <= 0) {
      return null;
    }
    return { delta: puntaje, motivo: esReplica ? `Réplica n.º ${ordinalDelTipo}` : `Post n.º ${ordinalDelTipo}` };
  }

  // La revisión humana ajusta una sola vez, al cerrar (ver ajustesAlCierreDelForo.js).
  function calcularAjustesAlCierre(estado) {
    return calcularAjustesAlCierreDelForo({
      estado: { ...estado, programa: estado.programa ?? programa },
      parametros: parametrosDePuntajeVigentes(),
    });
  }

  function extenderTiempo(minutos = MINUTOS_DE_UNA_EXTENSION) {
    const { estado, publicar } = obtenerContexto();
    if (!estado || estaCerrada() || estado.fase.actual?.tipo !== TIPOS_DE_FASE.FORO_ESCRITO) {
      return;
    }
    publicar(EVENTOS.FASE_EXTENDIDA, { minutos });
  }

  return {
    alSincronizarDespuesDelPuntaje: cerrarEscrituraSiSeAgotoElTiempo,
    calcularPuntajeProvisional,
    calcularAjustesAlCierre,
    acciones: { extenderTiempo },
  };
}
