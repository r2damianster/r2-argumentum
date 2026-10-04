// Cuántos co-moderadores tiene una sesión y quiénes son — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Funciones puras y sin conocer ninguna actividad: sirven igual para el debate hablado, el foro
// escrito y las actividades que se agreguen. El moderador elige el modo en la sala de espera.

export const MODOS_DE_CO_MODERACION = {
  // `ceil(10 %)` de los participantes, solo si hay gente suficiente (por defecto).
  REGLAMENTARIO: 'reglamentario',
  // El moderador fija el número.
  FIJO: 'fijo',
  // Todo lo decide el moderador.
  NINGUNO: 'ninguno',
};

export const MODO_DE_CO_MODERACION_POR_DEFECTO = MODOS_DE_CO_MODERACION.REGLAMENTARIO;

// Con menos gente que esto no se co-modera: con 3 debatientes no hay co-moderadores como regla.
export const MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR = 6;

// Un co-moderador sorteado no debate (exclusión mutua), así que la sala nunca puede quedarse con
// menos personas debatiendo que esto, elija el moderador el número que elija.
export const MINIMO_DE_DEBATIENTES = 3;

// Un co-moderador por cada 10 participantes, redondeando hacia arriba (equivale a `ceil(10 %)`).
// Se divide en lugar de multiplicar por 0,1: en JavaScript `30 * 0.1` da 3.0000000000000004 y el
// redondeo hacia arriba subiría a 4.
export const PARTICIPANTES_POR_CO_MODERADOR_REGLAMENTARIO = 10;

export function resolverModoDeCoModeracion(programa) {
  const modoElegido = programa?.moderacion?.modo;
  return Object.values(MODOS_DE_CO_MODERACION).includes(modoElegido) ? modoElegido : MODO_DE_CO_MODERACION_POR_DEFECTO;
}

// Lo que el moderador elige en la configuración, con valores seguros por si falta algo.
export function normalizarModeracion(moderacion) {
  const modo = Object.values(MODOS_DE_CO_MODERACION).includes(moderacion?.modo)
    ? moderacion.modo
    : MODO_DE_CO_MODERACION_POR_DEFECTO;
  const numeroPedido = Math.floor(Number(moderacion?.numeroFijo));
  return {
    modo,
    numeroFijo: Number.isFinite(numeroPedido) && numeroPedido > 0 ? numeroPedido : null,
  };
}

// Cuántos co-moderadores corresponden según lo que dice el Programa vigente.
export function calcularCantidadSegunElPrograma(programa, totalDeParticipantes) {
  const { modo, numeroFijo } = normalizarModeracion(programa?.moderacion);
  return calcularCantidadDeCoModeradores({
    totalDeParticipantes,
    modo,
    numeroFijo,
    minimoParaCoModerar: programa?.moderacion?.minimoParaCoModerar ?? MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR,
    topeMaximo: programa?.topeMaximoCoModeradores ?? null,
  });
}

// Máximo de co-moderadores que una sala admite sin dejar a nadie sin debatir.
export function calcularMaximoDeCoModeradoresPosible(totalDeParticipantes) {
  return Math.max(0, totalDeParticipantes - MINIMO_DE_DEBATIENTES);
}

export function calcularCantidadDeCoModeradores({
  totalDeParticipantes,
  modo = MODO_DE_CO_MODERACION_POR_DEFECTO,
  numeroFijo = null,
  minimoParaCoModerar = MINIMO_DE_PARTICIPANTES_PARA_CO_MODERAR,
  topeMaximo = null,
}) {
  if (modo === MODOS_DE_CO_MODERACION.NINGUNO || totalDeParticipantes <= 0) {
    return 0;
  }

  const maximoPosible = calcularMaximoDeCoModeradoresPosible(totalDeParticipantes);

  if (modo === MODOS_DE_CO_MODERACION.FIJO) {
    const cantidadPedida = Math.max(0, Math.floor(numeroFijo ?? 0));
    return Math.min(cantidadPedida, maximoPosible);
  }

  if (totalDeParticipantes < minimoParaCoModerar) {
    return 0;
  }

  const cantidadReglamentaria = Math.ceil(totalDeParticipantes / PARTICIPANTES_POR_CO_MODERADOR_REGLAMENTARIO);
  const cantidadConTope = topeMaximo ? Math.min(cantidadReglamentaria, topeMaximo) : cantidadReglamentaria;
  return Math.min(cantidadConTope, maximoPosible);
}

// Sorteo uniforme (Fisher–Yates). Recibe el generador aleatorio para poder probarlo; el
// `sort(() => Math.random() - 0.5)` que se usaba antes no reparte de forma uniforme.
export function sortearCoModeradores(idsElegibles, cantidad, generadorAleatorio = Math.random) {
  const barajados = [...idsElegibles];
  for (let indice = barajados.length - 1; indice > 0; indice -= 1) {
    const indiceElegido = Math.floor(generadorAleatorio() * (indice + 1));
    [barajados[indice], barajados[indiceElegido]] = [barajados[indiceElegido], barajados[indice]];
  }
  return barajados.slice(0, Math.max(0, cantidad));
}

// Valida la lista que arma el moderador a mano: solo entran personas elegibles (ya ingresaron),
// sin repetirse y sin pasar del máximo que deja a la sala con suficientes debatientes.
export function validarDesignacionManual({ idsElegidos, idsElegibles, totalDeParticipantes }) {
  const elegibles = new Set(idsElegibles);
  const aceptados = [];
  const rechazados = [];

  for (const idElegido of idsElegidos) {
    if (!elegibles.has(idElegido) || aceptados.includes(idElegido)) {
      rechazados.push(idElegido);
    } else {
      aceptados.push(idElegido);
    }
  }

  const maximoPosible = calcularMaximoDeCoModeradoresPosible(totalDeParticipantes);
  const excedentes = aceptados.splice(maximoPosible);
  rechazados.push(...excedentes);

  return {
    idsValidos: aceptados,
    idsRechazados: rechazados,
    superaElMaximo: excedentes.length > 0,
    maximoPosible,
  };
}
