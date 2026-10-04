// Parecido entre textos para la integridad del control de lectura — ver docs/14-control-de-lectura.md.
//
// Es determinista y barato: compara secuencias de 5 palabras («huellas»). Con la misma consigna y
// párrafos cortos es normal que dos textos compartan alguna palabra suelta; por eso se cuentan
// secuencias, no palabras, y las citas entre comillas no cuentan. El resultado es una ADVERTENCIA para
// el docente (un porcentaje y los fragmentos que coinciden), nunca una prueba ni una sanción.

export const PALABRAS_POR_HUELLA = 5;

export const BANDAS_DE_SIMILITUD = {
  SIN_INDICIO: 'sin_indicio',
  ATENCION: 'atencion',
  ALTO: 'alto',
  PROBABLE_COPIA: 'probable_copia',
};

// Porcentaje desde el cual empieza cada banda (editables en el Programa: `umbralesDeSimilitud`).
export const UMBRALES_DE_SIMILITUD_POR_DEFECTO = { atencion: 20, alto: 40, probableCopia: 60 };

export const ETIQUETA_DE_LA_BANDA = {
  [BANDAS_DE_SIMILITUD.SIN_INDICIO]: 'Sin indicio',
  [BANDAS_DE_SIMILITUD.ATENCION]: 'Atención',
  [BANDAS_DE_SIMILITUD.ALTO]: 'Alto',
  [BANDAS_DE_SIMILITUD.PROBABLE_COPIA]: 'Probable copia',
};

export const ORIGENES_DE_SIMILITUD = {
  OTRA_ENTREGA: 'otra_entrega',
  TEXTO_DE_REFERENCIA: 'texto_de_referencia',
  EJEMPLO: 'ejemplo',
};

// Los umbrales deben ir de menor a mayor; si no, se usan los de siempre.
export function resolverUmbralesDeSimilitud(programa) {
  const propuestos = programa?.umbralesDeSimilitud;
  const atencion = Number(propuestos?.atencion);
  const alto = Number(propuestos?.alto);
  const probableCopia = Number(propuestos?.probableCopia);
  const validos =
    Number.isFinite(atencion) && Number.isFinite(alto) && Number.isFinite(probableCopia) && atencion > 0 && atencion < alto && alto < probableCopia && probableCopia <= 100;
  return validos ? { atencion, alto, probableCopia } : { ...UMBRALES_DE_SIMILITUD_POR_DEFECTO };
}

export function clasificarSimilitud(porcentaje, umbrales = UMBRALES_DE_SIMILITUD_POR_DEFECTO) {
  if (porcentaje >= umbrales.probableCopia) {
    return BANDAS_DE_SIMILITUD.PROBABLE_COPIA;
  }
  if (porcentaje >= umbrales.alto) {
    return BANDAS_DE_SIMILITUD.ALTO;
  }
  if (porcentaje >= umbrales.atencion) {
    return BANDAS_DE_SIMILITUD.ATENCION;
  }
  return BANDAS_DE_SIMILITUD.SIN_INDICIO;
}

// Lo citado entre comillas se cita a propósito: no cuenta como copia. Cubre «…», “…” y "…".
function quitarCitas(texto) {
  return texto.replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, ' ');
}

export function dividirEnPalabras(texto, { excluirCitas = false } = {}) {
  const base = excluirCitas ? quitarCitas(String(texto ?? '')) : String(texto ?? '');
  return (base.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function construirHuellas(palabras, n = PALABRAS_POR_HUELLA) {
  const huellas = new Set();
  for (let posicion = 0; posicion + n <= palabras.length; posicion += 1) {
    huellas.add(palabras.slice(posicion, posicion + n).join(' '));
  }
  return huellas;
}

// Qué parte de las huellas de A aparece en B (0–100). Es lo que importa al copiar: cuánto de lo escrito
// por A ya estaba en B.
function porcentajeDeAEnB(huellasDeA, huellasDeB) {
  if (huellasDeA.size === 0) {
    return 0;
  }
  let compartidas = 0;
  for (const huella of huellasDeA) {
    if (huellasDeB.has(huella)) {
      compartidas += 1;
    }
  }
  return (compartidas / huellasDeA.size) * 100;
}

// Los tramos de A que también están en B, como texto (máximo `maximo`, los más largos primero).
export function extraerFragmentosCoincidentes(palabrasDeA, huellasDeB, { maximo = 3, maximoDePalabras = 30 } = {}) {
  const tramos = [];
  let inicio = null;
  for (let posicion = 0; posicion + PALABRAS_POR_HUELLA <= palabrasDeA.length; posicion += 1) {
    const huella = palabrasDeA.slice(posicion, posicion + PALABRAS_POR_HUELLA).join(' ');
    if (huellasDeB.has(huella)) {
      inicio ??= posicion;
    } else if (inicio !== null) {
      tramos.push([inicio, posicion - 1 + PALABRAS_POR_HUELLA]);
      inicio = null;
    }
  }
  if (inicio !== null) {
    tramos.push([inicio, palabrasDeA.length]);
  }
  return tramos
    .sort((tramoA, tramoB) => tramoB[1] - tramoB[0] - (tramoA[1] - tramoA[0]))
    .slice(0, maximo)
    .map(([desde, hasta]) => {
      const palabras = palabrasDeA.slice(desde, Math.min(hasta, desde + maximoDePalabras));
      return palabras.join(' ') + (hasta - desde > maximoDePalabras ? '…' : '');
    });
}

// `entregas`: [{ id, texto }]. `referencias`: [{ id, origen, texto }] (el texto de la lectura, los ejemplos
// del Programa). Para cada entrega devuelve el mayor parecido que encontró, con quién y qué fragmentos.
// Sin ningún parecido → porcentaje 0 y banda «sin indicio».
export function analizarSimilitudDeLasEntregas({ entregas, referencias = [], umbrales = UMBRALES_DE_SIMILITUD_POR_DEFECTO }) {
  const palabrasPorEntrega = new Map(entregas.map((entrega) => [entrega.id, dividirEnPalabras(entrega.texto, { excluirCitas: true })]));
  const huellasPorEntrega = new Map([...palabrasPorEntrega].map(([id, palabras]) => [id, construirHuellas(palabras)]));
  // Contra lo que se compara se usa el texto completo: copiar un tramo citado en otra entrega también delata.
  const huellasCompletasPorEntrega = new Map(entregas.map((entrega) => [entrega.id, construirHuellas(dividirEnPalabras(entrega.texto))]));
  const huellasDeReferencias = referencias.map((referencia) => ({
    ...referencia,
    huellas: construirHuellas(dividirEnPalabras(referencia.texto)),
  }));

  const resultado = {};
  for (const entrega of entregas) {
    const huellasPropias = huellasPorEntrega.get(entrega.id);
    const comparaciones = [];

    for (const otra of entregas) {
      if (otra.id !== entrega.id) {
        comparaciones.push({
          origen: ORIGENES_DE_SIMILITUD.OTRA_ENTREGA,
          conId: otra.id,
          porcentaje: porcentajeDeAEnB(huellasPropias, huellasCompletasPorEntrega.get(otra.id)),
          huellasDelOtro: huellasCompletasPorEntrega.get(otra.id),
        });
      }
    }
    for (const referencia of huellasDeReferencias) {
      comparaciones.push({
        origen: referencia.origen,
        conId: referencia.id,
        porcentaje: porcentajeDeAEnB(huellasPropias, referencia.huellas),
        huellasDelOtro: referencia.huellas,
      });
    }

    const conParecido = comparaciones.filter((comparacion) => comparacion.porcentaje > 0).sort((comparacionA, comparacionB) => comparacionB.porcentaje - comparacionA.porcentaje);
    const mayor = conParecido[0] ?? null;
    const porcentaje = mayor ? Math.round(mayor.porcentaje) : 0;

    resultado[entrega.id] = {
      porcentaje,
      banda: clasificarSimilitud(porcentaje, umbrales),
      origen: mayor?.origen ?? null,
      conId: mayor?.conId ?? null,
      fragmentos: mayor ? extraerFragmentosCoincidentes(palabrasPorEntrega.get(entrega.id), mayor.huellasDelOtro) : [],
      // Todas las coincidencias que pasan de «sin indicio», para que el docente vea si es con varias.
      coincidencias: conParecido
        .filter((comparacion) => clasificarSimilitud(Math.round(comparacion.porcentaje), umbrales) !== BANDAS_DE_SIMILITUD.SIN_INDICIO)
        .map((comparacion) => ({ origen: comparacion.origen, conId: comparacion.conId, porcentaje: Math.round(comparacion.porcentaje) })),
    };
  }
  return resultado;
}
