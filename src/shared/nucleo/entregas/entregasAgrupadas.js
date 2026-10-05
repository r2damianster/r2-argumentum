// Entregas anunciadas EN LOTE por el host (control de lectura).
//
// Antes cada estudiante publicaba un aviso «entregué» a la sala. Ably entrega cada publicación a todos, así que con
// N personas entregando a la vez eran N × N mensajes: con 80 o más el servicio rechazaba parte de ellos y se
// perdían entregas (prueba de carga del 4-oct-2026, docs/06-pendientes.md). Ahora el estudiante manda su texto
// SOLO por su canal privado (que lee únicamente el host) y el host, que ya tiene el texto, anuncia a la sala las
// entregas nuevas cada pocos segundos en un solo mensaje: N mensajes por lote en vez de N × N en total.
// Funciones puras; las usa el hook del host (`useEntregasAgrupadas`).

import { TIPOS_DE_FASE } from '../../eventos/nombresDeEventos.js';
import { MARGEN_PARA_ENTREGAS_POR_TIEMPO_MS } from './estadoPublicoDeEntregas.js';

// Cada cuánto como máximo se anuncia un lote. El primer aviso sale enseguida; los siguientes esperan este intervalo.
export const INTERVALO_ENTRE_AVISOS_DE_ENTREGAS_MS = 5 * 1000;

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

// Entregas con texto recibido por el host que todavía no se anunciaron a la sala y que llegaron a tiempo.
// `yaAnunciadas`: Set de participantId que el host ya mandó en un lote (aunque el eco aún no vuelva por el canal).
export function calcularEntregasPorAnunciar({ estado, estadoPrivado, yaAnunciadas = new Set() }) {
  const publicas = estado.lectura?.entregas ?? {};
  return Object.entries(estadoPrivado?.textos ?? {})
    .filter(
      ([participantId, entrega]) =>
        !publicas[participantId] &&
        !yaAnunciadas.has(participantId) &&
        estado.participantes?.[participantId]?.ingresoConfirmado &&
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

// Cuánto esperar para anunciar el próximo lote (0 = ya).
export function esperaParaElProximoAviso({ ultimoAvisoEn, ahora = Date.now(), intervalo = INTERVALO_ENTRE_AVISOS_DE_ENTREGAS_MS }) {
  return Math.max(0, (ultimoAvisoEn ?? 0) + intervalo - ahora);
}
