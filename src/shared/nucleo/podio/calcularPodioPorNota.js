// Podio por nota — ver docs/14-control-de-lectura.md.
//
// Solo se muestran los primeros lugares (5 por defecto) y NUNCA la nota. Una nota exactamente igual
// comparte lugar: dos personas con 9,5 son las dos «1.º» y la siguiente nota distinta es el «2.º»
// (lugares consecutivos, no se salta ninguno).

export const LUGARES_DEL_PODIO = 5;

// `puntuaciones`: [{ participantId, puntuacion }] con la puntuación ya combinada (nota, puntos de
// revisor…). Las personas sin puntuación no entran. Devuelve [{ lugar, participantIds }] ordenado.
export function calcularPodioPorNota(puntuaciones, lugares = LUGARES_DEL_PODIO) {
  const conPuntuacion = puntuaciones.filter(
    (registro) => registro.participantId && Number.isFinite(registro.puntuacion) && registro.puntuacion > 0
  );
  const valoresDistintos = [...new Set(conPuntuacion.map((registro) => registro.puntuacion))].sort(
    (valorA, valorB) => valorB - valorA
  );

  return valoresDistintos.slice(0, lugares).map((valor, indice) => ({
    lugar: indice + 1,
    participantIds: conPuntuacion
      .filter((registro) => registro.puntuacion === valor)
      .map((registro) => registro.participantId)
      .sort(),
  }));
}
