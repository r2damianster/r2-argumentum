import { useEffect, useRef } from 'react';

// El estudiante no puede perderse el momento en que le toca actuar (aceptar o rechazar el turno,
// avisar que terminó de exponer). Mientras `activo` sea true, el elemento al que se le pasa la
// referencia devuelta:
//   - se centra solo en pantalla (sin animación si la persona pidió reducir el movimiento),
//   - hace vibrar el celular con un patrón corto (si el navegador lo permite),
//   - y el título de la pestaña cambia a `titulo` para llamar la atención aunque esté en segundo plano.
// Todo se deshace al terminar. Ver docs/12 (regla «acciones del turno»).
// `bloque`: dónde queda el elemento al centrarlo: 'center' para tarjetas cortas (acciones del turno),
// 'start' para contenido alto como el podio final (así se ve desde su primera línea).
export function useAtencionDelTurno(activo, titulo, { bloque = 'center' } = {}) {
  const referencia = useRef(null);

  useEffect(() => {
    if (!activo) {
      return undefined;
    }

    const tituloOriginal = document.title;
    document.title = titulo;

    const prefiereMenosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    referencia.current?.scrollIntoView?.({ block: bloque, behavior: prefiereMenosMovimiento ? 'auto' : 'smooth' });

    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Algunos navegadores bloquean vibrate sin un toque previo: no es un error.
    }

    return () => {
      document.title = tituloOriginal;
    };
  }, [activo, titulo]);

  return referencia;
}
