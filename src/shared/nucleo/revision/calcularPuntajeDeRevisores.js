// Revisión de aportes por co-moderadores y moderador — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Funciones puras, independientes de cualquier actividad: un «elemento» puede ser un post del foro,
// la exposición oral de un argumento o cualquier cosa que se revise con una escala de niveles. Las
// actividades solo traducen sus calificaciones a niveles y llaman a estas funciones.
//
// Cómo puntúa un revisor (co-moderador):
//   referencia de cada elemento  → la decisión del moderador; si no intervino, el consenso de los
//                                   co-moderadores (el nivel que rige al cerrar, con al menos dos
//                                   votos); si tampoco hay, el elemento no cuenta para el acierto
//   cercanía de un voto          → 1 − |su nivel − nivel de referencia| / rango de la escala
//   acierto                      → promedio ponderado de la cercanía, corregido por azar
//   esfuerzo                     → elementos revisados / revisionesObjetivo (tope 1)
//   puntos                       → puntajeMaximo × acierto × esfuerzo

export const REVISIONES_OBJETIVO_POR_DEFECTO = 7;

// Una referencia del moderador es la más fiable; el consenso entre co-moderadores vale algo menos
// (misma proporción 3 : 5 que tenía el bono de revisión cruzada frente al de coincidir con el
// moderador).
export const PESO_DE_REFERENCIA_DEL_MODERADOR = 1;
export const PESO_DE_REFERENCIA_POR_CONSENSO = 0.6;
export const MINIMO_DE_VOTOS_PARA_HABER_CONSENSO = 2;

// Cercanía media que se obtiene votando al azar: por debajo no hay mérito. El acierto se mide
// por encima de ese piso, así que votar sin criterio no suma y no hace falta restar puntos.
export const CERCANIA_ESPERADA_POR_AZAR = 0.5;

// Cuando ningún elemento revisado tiene referencia (ni moderador ni otros co-moderadores) no se
// puede saber si acertó: se le reconoce el esfuerzo con un acierto neutro.
export const ACIERTO_SIN_REFERENCIA = 0.5;

export const ORIGENES_DE_REFERENCIA = {
  MODERADOR: 'moderador',
  CONSENSO: 'consenso',
  DESCARTADA: 'descartada',
  NINGUNO: null,
};

export const DECISIONES_DEL_MODERADOR_SOBRE_REVISION = {
  EVALUADA: 'evaluada',
  DESCARTADA: 'descartada',
  SIN_EVALUAR: 'sin_evaluar',
};

export function calcularMediana(valores) {
  if (valores.length === 0) {
    return null;
  }
  const ordenados = [...valores].sort((valorA, valorB) => valorA - valorB);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

export function calcularCercaniaEntreNiveles(nivelA, nivelB, escala) {
  const rango = escala.maximo - escala.minimo;
  if (rango <= 0) {
    throw new Error('La escala de revisión necesita un máximo mayor que su mínimo.');
  }
  return 1 - Math.abs(nivelA - nivelB) / rango;
}

// Pasa un nivel de una escala a otra (por ejemplo −1 / 0 / +1 de las exposiciones a 0 / 0,5 / 1).
export function normalizarNivel(nivel, escalaOrigen, escalaDestino = { minimo: 0, maximo: 1 }) {
  const fraccion = (nivel - escalaOrigen.minimo) / (escalaOrigen.maximo - escalaOrigen.minimo);
  return escalaDestino.minimo + fraccion * (escalaDestino.maximo - escalaDestino.minimo);
}

// Con qué nivel se queda un elemento al cerrar: el del moderador si lo evaluó; ninguno si descartó
// las revisiones; si no intervino, la mediana de los co-moderadores (la mayoría, en una escala con
// niveles ordenados); y ninguno si nadie lo revisó.
export function resolverNivelFinalDeRevision({ nivelesPorRevisor = {}, decisionDelModerador = null }) {
  if (decisionDelModerador?.decision === DECISIONES_DEL_MODERADOR_SOBRE_REVISION.DESCARTADA) {
    return { nivel: null, descartada: true, delModerador: false };
  }
  if (decisionDelModerador?.decision === DECISIONES_DEL_MODERADOR_SOBRE_REVISION.EVALUADA) {
    return { nivel: decisionDelModerador.nivel, descartada: false, delModerador: true };
  }
  return {
    nivel: calcularMediana(Object.values(nivelesPorRevisor)),
    descartada: false,
    delModerador: false,
  };
}

// Contra qué se mide el voto de un revisor: contra el nivel que de verdad rige el elemento al
// cerrar (el del moderador o, si no intervino, el consenso). Un voto solitario no es consenso: con
// un único co-moderador y sin moderador no hay referencia contra la cual medir el acierto.
export function resolverReferenciaDeRevision({ nivelesPorRevisor = {}, decisionDelModerador = null }) {
  if (decisionDelModerador?.decision === DECISIONES_DEL_MODERADOR_SOBRE_REVISION.DESCARTADA) {
    return { nivel: null, origen: ORIGENES_DE_REFERENCIA.DESCARTADA, peso: 0 };
  }
  if (decisionDelModerador?.decision === DECISIONES_DEL_MODERADOR_SOBRE_REVISION.EVALUADA) {
    return {
      nivel: decisionDelModerador.nivel,
      origen: ORIGENES_DE_REFERENCIA.MODERADOR,
      peso: PESO_DE_REFERENCIA_DEL_MODERADOR,
    };
  }

  const niveles = Object.values(nivelesPorRevisor);
  if (niveles.length < MINIMO_DE_VOTOS_PARA_HABER_CONSENSO) {
    return { nivel: null, origen: ORIGENES_DE_REFERENCIA.NINGUNO, peso: 0 };
  }
  return {
    nivel: calcularMediana(niveles),
    origen: ORIGENES_DE_REFERENCIA.CONSENSO,
    peso: PESO_DE_REFERENCIA_POR_CONSENSO,
  };
}

// Convierte la cercanía media (0–1) en acierto (0–1) descontando lo que se lograría al azar.
export function corregirAciertoPorAzar(cercaniaPromedio) {
  const aciertoSobreElAzar = (cercaniaPromedio - CERCANIA_ESPERADA_POR_AZAR) / (1 - CERCANIA_ESPERADA_POR_AZAR);
  return Math.min(1, Math.max(0, aciertoSobreElAzar));
}

// Lo máximo que gana un revisor es lo que gana un debatiente con todas sus posiciones, así el rol
// es comparable al de argumentar y escala solo con el perfil de puntaje.
export function calcularPuntajeMaximoDeRevisor(parametrosDePuntaje) {
  return parametrosDePuntaje.valoresBasePosicion.reduce((suma, valor) => suma + valor, 0);
}

// `revisiones`: [{ elementoId, nivelesPorRevisor: { [revisorId]: nivel }, decisionDelModerador }]
// Devuelve una entrada por cada revisor que votó al menos un elemento.
export function calcularPuntajeDeRevisores({
  revisiones,
  escala,
  puntajeMaximo,
  revisionesObjetivo = REVISIONES_OBJETIVO_POR_DEFECTO,
}) {
  const acumuladoPorRevisor = new Map();

  for (const revision of revisiones) {
    // Si el moderador descartó las revisiones de un elemento, ese elemento no cuenta para nadie:
    // ni como acierto ni como esfuerzo (docs/05: sin una referencia fiable nadie queda como bueno
    // ni como malo).
    if (revision.decisionDelModerador?.decision === DECISIONES_DEL_MODERADOR_SOBRE_REVISION.DESCARTADA) {
      continue;
    }
    for (const [revisorId, nivel] of Object.entries(revision.nivelesPorRevisor ?? {})) {
      if (!acumuladoPorRevisor.has(revisorId)) {
        acumuladoPorRevisor.set(revisorId, {
          revisadas: 0,
          conReferencia: 0,
          sumaPonderadaDeCercania: 0,
          sumaDePesos: 0,
        });
      }
      const acumulado = acumuladoPorRevisor.get(revisorId);
      acumulado.revisadas += 1;

      const referencia = resolverReferenciaDeRevision({
        nivelesPorRevisor: revision.nivelesPorRevisor,
        decisionDelModerador: revision.decisionDelModerador,
      });
      if (referencia.nivel === null) {
        continue;
      }
      acumulado.conReferencia += 1;
      acumulado.sumaPonderadaDeCercania += referencia.peso * calcularCercaniaEntreNiveles(nivel, referencia.nivel, escala);
      acumulado.sumaDePesos += referencia.peso;
    }
  }

  return [...acumuladoPorRevisor.entries()].map(([revisorId, acumulado]) => {
    const cercaniaPromedio =
      acumulado.sumaDePesos > 0 ? acumulado.sumaPonderadaDeCercania / acumulado.sumaDePesos : null;
    const acierto = cercaniaPromedio === null ? ACIERTO_SIN_REFERENCIA : corregirAciertoPorAzar(cercaniaPromedio);
    const esfuerzo = Math.min(1, acumulado.revisadas / revisionesObjetivo);
    return {
      revisorId,
      revisadas: acumulado.revisadas,
      conReferencia: acumulado.conReferencia,
      cercaniaPromedio,
      acierto,
      esfuerzo,
      puntos: Math.round(puntajeMaximo * acierto * esfuerzo),
    };
  });
}

// Hash FNV-1a de 32 bits: estable entre dispositivos y sesiones, sin depender de ningún evento.
function calcularHashEstable(texto) {
  let hash = 0x811c9dc5;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// A quiénes les toca revisar un elemento. Todos los clientes llegan al mismo resultado sin
// intercambiar mensajes, y el reparto queda parejo entre co-moderadores.
export function asignarRevisores(elementoId, idsDeCoModeradores, cantidad = 2) {
  if (idsDeCoModeradores.length === 0) {
    return [];
  }
  const ordenados = [...idsDeCoModeradores].sort();
  const cantidadReal = Math.min(cantidad, ordenados.length);
  const indiceInicial = calcularHashEstable(String(elementoId)) % ordenados.length;
  return Array.from({ length: cantidadReal }, (_, desplazamiento) => ordenados[(indiceInicial + desplazamiento) % ordenados.length]);
}
