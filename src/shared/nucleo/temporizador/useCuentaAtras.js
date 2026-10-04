import { useEffect, useState } from 'react';
import { calcularTiempoRestante } from './calcularTiempoRestante.js';

// Cuenta atrás de una fase con tiempo total, que se actualiza cada segundo. Todo se deduce del
// log (inicio, duración y extensiones), así que un F5 recupera la misma cuenta.
export function useCuentaAtras(fase) {
  const [ahora, setAhora] = useState(() => Date.now());

  const tieneTiempo = Boolean(fase?.duracionMin && fase?.iniciadaEn);
  useEffect(() => {
    if (!tieneTiempo) {
      return undefined;
    }
    setAhora(Date.now());
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [tieneTiempo, fase?.iniciadaEn, fase?.extensionesMin]);

  return {
    ahora,
    ...calcularTiempoRestante({
      iniciadaEn: fase?.iniciadaEn,
      duracionMin: fase?.duracionMin,
      extensionesMin: fase?.extensionesMin ?? 0,
      ahora,
    }),
  };
}
