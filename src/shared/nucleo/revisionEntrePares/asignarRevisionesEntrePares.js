// Revisión entre pares: quién revisa a quién — ver docs/14-control-de-lectura.md.
//
// Es una pieza del núcleo, sin conocer ninguna actividad: recibe quiénes entregaron y cuántas revisiones
// hace cada uno, y devuelve el reparto. El reparto es un anillo barajado: nadie se revisa a sí mismo y
// cada texto recibe exactamente la misma cantidad de revisiones que cada persona hace.

export const MINIMO_DE_PARTICIPANTES_PARA_REVISAR_ENTRE_PARES = 3;

function barajar(lista, azar) {
  const copia = [...lista];
  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const elegido = Math.floor(azar() * (indice + 1));
    [copia[indice], copia[elegido]] = [copia[elegido], copia[indice]];
  }
  return copia;
}

// `autoresIds`: quienes entregaron (y por lo tanto revisan y son revisados). Con menos del mínimo no hay
// revisión entre pares. Si piden más revisiones de las posibles (n − 1), se acotan.
// Devuelve { asignaciones: { [revisorId]: [autorId, …] }, revisionesPorPersona } o
// { asignaciones: {}, revisionesPorPersona: 0, motivo } si no se puede.
export function asignarRevisionesEntrePares({ autoresIds, revisionesPorPersona = 2, azar = Math.random }) {
  const sinRepetir = [...new Set(autoresIds)];
  if (sinRepetir.length < MINIMO_DE_PARTICIPANTES_PARA_REVISAR_ENTRE_PARES) {
    return { asignaciones: {}, revisionesPorPersona: 0, motivo: 'pocas_entregas' };
  }

  const cantidad = Math.min(Math.max(1, Math.floor(revisionesPorPersona)), sinRepetir.length - 1);
  const anillo = barajar(sinRepetir, azar);
  const asignaciones = {};
  anillo.forEach((revisorId, posicion) => {
    asignaciones[revisorId] = Array.from({ length: cantidad }, (_, desplazamiento) => anillo[(posicion + 1 + desplazamiento) % anillo.length]);
  });
  return { asignaciones, revisionesPorPersona: cantidad };
}

// A quiénes revisa una persona, según el reparto guardado. El índice es lo que la persona conoce de cada
// texto (nunca el autor): «tu revisión 1», «tu revisión 2».
export function listarAutoresQueRevisa(asignaciones, revisorId) {
  return asignaciones?.[revisorId] ?? [];
}

export function listarRevisoresDeUnAutor(asignaciones, autorId) {
  return Object.entries(asignaciones ?? {})
    .filter(([, autores]) => autores.includes(autorId))
    .map(([revisorId]) => revisorId);
}
