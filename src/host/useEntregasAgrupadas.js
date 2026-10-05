import { useEffect, useRef, useState } from 'react';
import { EVENTOS } from '../shared/eventos/nombresDeEventos.js';
import { calcularEntregasPorAnunciar, esperaParaElProximoAviso } from '../shared/nucleo/entregas/entregasAgrupadas.js';

// Anuncia a la sala, en lote y cada pocos segundos, las entregas del control de lectura que el host ya recibió por el
// canal privado. Reemplaza al aviso suelto que antes publicaba cada estudiante (ver entregasAgrupadas.js). Vive en la
// consola del host, no en un panel: tiene que seguir funcionando aunque el docente mire otra pantalla.
// Si el host se refresca no se pierde nada: lo pendiente se recalcula comparando los textos recibidos con lo ya
// anunciado en el log.
export function useEntregasAgrupadas({ activo, estado, estadoPrivado, publicar }) {
  const yaAnunciadas = useRef(new Set());
  const ultimoAvisoEn = useRef(0);
  const [reloj, setReloj] = useState(0);

  // Lo último que se sabe, para que el temporizador no dependa de funciones que cambian en cada render.
  const ultimo = useRef({ estado, estadoPrivado, publicar });
  ultimo.current = { estado, estadoPrivado, publicar };

  const cantidadPendiente = activo ? calcularEntregasPorAnunciar({ estado, estadoPrivado, yaAnunciadas: yaAnunciadas.current }).length : 0;

  useEffect(() => {
    if (!activo || cantidadPendiente === 0) {
      return undefined;
    }
    const temporizador = setTimeout(() => {
      // Se recalcula al disparar: pudieron llegar más entregas durante la espera.
      const { estado: estadoActual, estadoPrivado: privadoActual, publicar: publicarActual } = ultimo.current;
      const lote = calcularEntregasPorAnunciar({ estado: estadoActual, estadoPrivado: privadoActual, yaAnunciadas: yaAnunciadas.current });
      if (lote.length === 0) {
        return;
      }
      ultimoAvisoEn.current = Date.now();
      lote.forEach((entrega) => yaAnunciadas.current.add(entrega.participantId));
      setReloj((vez) => vez + 1); // vuelve a mirar: pudieron llegar más entregas mientras se anunciaba este lote
      Promise.resolve(publicarActual(EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, { entregas: lote })).catch((fallo) => {
        // Si no se pudo anunciar, vuelven a ser pendientes y se reintenta en el próximo ciclo.
        console.warn('[r2-argumentum] no se pudo anunciar el lote de entregas', fallo);
        lote.forEach((entrega) => yaAnunciadas.current.delete(entrega.participantId));
        setReloj((vez) => vez + 1);
      });
    }, esperaParaElProximoAviso({ ultimoAvisoEn: ultimoAvisoEn.current }));
    return () => clearTimeout(temporizador);
    // Solo se rearma cuando cambia cuántas hay pendientes (o tras un fallo): así los renders frecuentes no lo posponen.
  }, [activo, cantidadPendiente, reloj]);
}
