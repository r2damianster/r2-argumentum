import { useEffect, useRef, useState } from 'react';
import { EVENTOS } from '../shared/eventos/nombresDeEventos.js';
import {
  calcularAnunciosPorHacer,
  clavesDeLosAnuncios,
  contarAnunciosPorHacer,
  esperaParaElProximoAviso,
} from '../shared/nucleo/entregas/anunciosEnLote.js';

// Anuncia a la sala, en lote y cada pocos segundos, lo que el host ya recibió por los canales privados del control de
// lectura (ingresos, entregas, revisiones, devoluciones y confirmaciones), según el modo de ahorro. Reemplaza a los avisos
// sueltos de cada persona (ver anunciosEnLote.js). Vive en la consola del host, no en un panel: tiene que seguir
// funcionando aunque el docente mire otra pantalla. Si el host se refresca no se pierde nada: lo pendiente se recalcula
// comparando lo recibido con lo ya anunciado en el log.
//
// `perfil`: el perfil de ahorro vigente (perfilDeAhorro). Con el de sala pequeña no hace nada.
export function useAnunciosEnLote({ activo, estado, estadoPrivado, publicar, perfil }) {
  const yaAnunciados = useRef(new Set());
  const ultimoAvisoEn = useRef(0);
  const [reloj, setReloj] = useState(0);

  // Lo último que se sabe, para que el temporizador no dependa de funciones que cambian en cada render.
  const ultimo = useRef({ estado, estadoPrivado, publicar, perfil });
  ultimo.current = { estado, estadoPrivado, publicar, perfil };

  const hayAlgoQueAnunciar = activo && perfil.avisoDeEntregas === 'lote';
  const cantidadPendiente = hayAlgoQueAnunciar
    ? contarAnunciosPorHacer(calcularAnunciosPorHacer({ estado, estadoPrivado, perfil, yaAnunciados: yaAnunciados.current }))
    : 0;

  useEffect(() => {
    if (cantidadPendiente === 0) {
      return undefined;
    }
    const temporizador = setTimeout(async () => {
      // Se recalcula al disparar: pudieron llegar más cosas durante la espera.
      const actual = ultimo.current;
      const anuncios = calcularAnunciosPorHacer({
        estado: actual.estado,
        estadoPrivado: actual.estadoPrivado,
        perfil: actual.perfil,
        yaAnunciados: yaAnunciados.current,
      });
      if (contarAnunciosPorHacer(anuncios) === 0) {
        return;
      }
      ultimoAvisoEn.current = Date.now();
      const claves = clavesDeLosAnuncios(anuncios);
      claves.forEach((clave) => yaAnunciados.current.add(clave));
      setReloj((vez) => vez + 1); // vuelve a mirar: pudieron llegar más cosas mientras se anunciaba este lote
      // En orden: quien entra tiene que existir antes de que se anuncie su entrega, y esta antes de su devolución.
      const envios = [
        [anuncios.ingresos, EVENTOS.INGRESOS_REGISTRADOS, 'ingresos'],
        [anuncios.entregas, EVENTOS.LECTURA_ENTREGAS_REGISTRADAS, 'entregas'],
        [anuncios.revisiones, EVENTOS.LECTURA_REVISIONES_REGISTRADAS, 'revisiones'],
        [anuncios.devoluciones, EVENTOS.LECTURA_DEVUELTAS_REGISTRADAS, 'devoluciones'],
        [anuncios.confirmaciones, EVENTOS.LECTURA_CONFIRMACIONES_REGISTRADAS, 'confirmaciones'],
      ];
      for (const [lista, nombreDelEvento, campo] of envios) {
        if (lista.length === 0) {
          continue;
        }
        try {
          await actual.publicar(nombreDelEvento, { [campo]: lista });
        } catch (fallo) {
          // Si no se pudo anunciar, vuelven a ser pendientes y se reintenta en el próximo ciclo.
          console.warn('[r2-argumentum] no se pudo anunciar un lote', nombreDelEvento, fallo);
          clavesDeLosAnuncios({ ingresos: [], entregas: [], revisiones: [], devoluciones: [], confirmaciones: [], [campo]: lista }).forEach(
            (clave) => yaAnunciados.current.delete(clave)
          );
          setReloj((vez) => vez + 1);
        }
      }
    }, esperaParaElProximoAviso({ ultimoAvisoEn: ultimoAvisoEn.current }));
    return () => clearTimeout(temporizador);
    // Solo se rearma cuando cambia cuántas hay pendientes (o tras un fallo): así los renders frecuentes no lo posponen.
  }, [cantidadPendiente, reloj]);
}
