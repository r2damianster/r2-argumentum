// Criterios adicionales de un Programa — ver docs/03-programa-de-debate.md.
//
// Un criterio adicional es una exigencia extra sobre lo que se escribe («describe una escena de la
// película»), más allá de «afirmación + razón». El Programa trae los criterios propuestos y el
// moderador activa o apaga cada uno en la configuración de la sesión (igual que la integridad).
//
// Dónde se usa un criterio activo (siempre como ayuda, nunca como puntaje):
//   - quien escribe lo ve como recordatorio antes de publicar;
//   - la IA SUGIERE si el aporte lo cumple (misma llamada de siempre, sin consulta extra);
//   - co-moderadores y moderador lo ven como guía al decidir los tres niveles de siempre.
// No suma ni resta puntos por sí mismo: el puntaje sigue la fórmula única (docs/05).
//
// Funciones puras, independientes de la actividad.

export const MAXIMO_DE_CRITERIOS_ACTIVOS = 3;
// Tope de criterios que puede definir un Programa: más allá de esto la lista deja de ser manejable.
export const MAXIMO_DE_CRITERIOS_DEFINIDOS = 6;
const LARGO_MAXIMO_DE_ETIQUETA = 80;
const LARGO_MAXIMO_DE_DESCRIPCION = 240;

function textoLimpio(valor, largoMaximo) {
  return String(valor ?? '').trim().slice(0, largoMaximo);
}

// Acepta lo que trae el Programa (`activoPorDefecto`) y lo que publica la sesión (`activo`).
// Descarta entradas sin id o sin etiqueta y repetidas: un Programa mal escrito no rompe la sesión.
export function normalizarCriteriosAdicionales(criterios) {
  if (!Array.isArray(criterios)) {
    return [];
  }
  const idsVistos = new Set();
  const normalizados = [];
  for (const criterio of criterios) {
    const id = textoLimpio(criterio?.id, 40);
    const etiqueta = textoLimpio(criterio?.etiqueta, LARGO_MAXIMO_DE_ETIQUETA);
    if (!id || !etiqueta || idsVistos.has(id)) {
      continue;
    }
    idsVistos.add(id);
    normalizados.push({
      id,
      etiqueta,
      descripcion: textoLimpio(criterio?.descripcion, LARGO_MAXIMO_DE_DESCRIPCION),
      activo: typeof criterio?.activo === 'boolean' ? criterio.activo : Boolean(criterio?.activoPorDefecto),
    });
    if (normalizados.length >= MAXIMO_DE_CRITERIOS_DEFINIDOS) {
      break;
    }
  }
  return limitarActivos(normalizados);
}

// Si el Programa marca más de los permitidos, quedan activos los primeros.
function limitarActivos(criterios) {
  let activosContados = 0;
  return criterios.map((criterio) => {
    if (!criterio.activo) {
      return criterio;
    }
    activosContados += 1;
    return activosContados <= MAXIMO_DE_CRITERIOS_ACTIVOS ? criterio : { ...criterio, activo: false };
  });
}

export function criteriosActivosDelPrograma(programa) {
  return normalizarCriteriosAdicionales(programa?.criteriosAdicionales).filter((criterio) => criterio.activo);
}

// Aplica la elección del moderador (ids activos) sobre los criterios que trae el Programa.
export function aplicarCriteriosElegidos(criteriosDelPrograma, idsDeCriteriosActivos) {
  const elegidos = idsDeCriteriosActivos instanceof Set ? idsDeCriteriosActivos : new Set(idsDeCriteriosActivos ?? []);
  return limitarActivos(
    normalizarCriteriosAdicionales(criteriosDelPrograma).map((criterio) => ({
      ...criterio,
      activo: elegidos.has(criterio.id),
    }))
  );
}

// Lo que se manda a la IA: solo lo necesario para evaluarlo.
export function criteriosParaLaIA(programa) {
  return criteriosActivosDelPrograma(programa).map(({ id, etiqueta, descripcion }) => ({ id, etiqueta, descripcion }));
}
