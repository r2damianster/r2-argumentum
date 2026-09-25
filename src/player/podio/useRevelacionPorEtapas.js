import { useCallback, useEffect, useState } from 'react';

function prefiereMenosMovimiento() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

// Avanza sola por las etapas del guion (ver etapasDelPodio.js), esperando la duración de cada una.
// Con «reducir movimiento» del sistema no hay suspenso: se muestra todo de una vez.
export function useRevelacionPorEtapas(etapas) {
  const ultimaEtapa = etapas.length - 1;
  const [indice, setIndice] = useState(() => (prefiereMenosMovimiento() ? ultimaEtapa : 0));

  useEffect(() => {
    if (indice >= ultimaEtapa) {
      return undefined;
    }
    const temporizador = setTimeout(() => setIndice((actual) => Math.min(actual + 1, ultimaEtapa)), etapas[indice].duracionMs);
    return () => clearTimeout(temporizador);
  }, [indice, ultimaEtapa, etapas]);

  const saltar = useCallback(() => setIndice(ultimaEtapa), [ultimaEtapa]);
  const repetir = useCallback(() => setIndice(0), []);

  return { indice, terminado: indice >= ultimaEtapa, saltar, repetir };
}
