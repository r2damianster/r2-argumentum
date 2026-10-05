// El Programa del control de lectura — ver docs/14-control-de-lectura.md.
//
// Funciones puras: validan el Programa que carga el docente, arman el que se publica con la
// configuración elegida para ESTA sesión y retiran lo que nunca debe llegar a los participantes.

import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { NIVELES_DE_INTEGRIDAD, normalizarIntegridad } from '../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { normalizarModoDeAhorro } from '../../shared/nucleo/capacidad/modosDeAhorro.js';
import { resolverRubricaDelPrograma } from '../../shared/nucleo/rubrica/rubrica.js';
import { resolverUmbralesDeSimilitud } from '../../shared/nucleo/integridad/similitudDeTextos.js';
import { normalizarPenalizacionPorPegado } from '../../shared/nucleo/integridad/penalizacionPorPegado.js';
import {
  DISTRIBUCIONES_DE_ESTRUCTURA,
  resolverEstructuraDelPrograma,
} from '../../shared/nucleo/escritura/estructurasDeEscritura.js';

export const ID_CONTROL_DE_LECTURA = 'control_de_lectura';

export const DURACION_POR_DEFECTO_DE_LA_ESCRITURA_MIN = 20;
export const VENTANA_DE_CONFIRMACION_POR_DEFECTO_MIN = 10;
export const REVISIONES_POR_PERSONA_POR_DEFECTO = 2;
export const DURACION_POR_DEFECTO_DE_LA_REVISION_DE_PARES_MIN = 10;
export const MINIMO_DE_PARTICIPANTES_PARA_REVISAR_ENTRE_PARES = 3;

// Lo que solo conoce el host: nunca viaja al canal de la sala, donde todos lo pueden leer. Con las
// claves de la lectura el estudiante podría saber qué ideas se esperan; con el texto de referencia,
// copiarlo.
export const CAMPOS_SOLO_DEL_HOST = ['clavesDeLaLectura', 'textoDeReferencia'];

export function esProgramaDeControlDeLectura(programa) {
  return programa?.actividad === ID_CONTROL_DE_LECTURA;
}

export function programaPublicable(programa) {
  if (!programa) {
    return programa;
  }
  const publicable = { ...programa };
  for (const campo of CAMPOS_SOLO_DEL_HOST) {
    delete publicable[campo];
  }
  return publicable;
}

// Lo que el host guarda para poder retomar la sesión tras un refresco: el Programa publicado más lo
// que solo conoce el host (que el canal de la sala no trae).
export function conCamposSoloDelHost(programaPublicado, programaCompleto) {
  if (!programaPublicado || !programaCompleto) {
    return programaPublicado ?? programaCompleto;
  }
  const camposDelHost = Object.fromEntries(
    CAMPOS_SOLO_DEL_HOST.filter((campo) => programaCompleto[campo] !== undefined).map((campo) => [campo, programaCompleto[campo]])
  );
  return { ...programaPublicado, ...camposDelHost };
}

export function normalizarRevisionDePares(revisionDePares) {
  const revisionesSolicitadas = Math.floor(Number(revisionDePares?.revisionesPorPersona));
  const duracionSolicitada = Math.floor(Number(revisionDePares?.duracionMin));
  return {
    activa: Boolean(revisionDePares?.activa),
    revisionesPorPersona: revisionesSolicitadas >= 1 ? Math.min(revisionesSolicitadas, 5) : REVISIONES_POR_PERSONA_POR_DEFECTO,
    duracionMin: duracionSolicitada >= 1 ? duracionSolicitada : DURACION_POR_DEFECTO_DE_LA_REVISION_DE_PARES_MIN,
  };
}

export function resolverVentanaDeConfirmacionMin(programa) {
  const ventana = Math.floor(Number(programa?.ventanaDeConfirmacionMin));
  return ventana >= 1 ? ventana : VENTANA_DE_CONFIRMACION_POR_DEFECTO_MIN;
}

export function resolverDuracionDeLaEscrituraMin(programa) {
  const fase = programa?.fases?.find((entrada) => entrada.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA);
  const duracion = Math.floor(Number(fase?.duracionMin));
  return duracion >= 1 ? duracion : DURACION_POR_DEFECTO_DE_LA_ESCRITURA_MIN;
}

// Las fases del Programa se arman a partir de lo elegido: escritura, revisión de pares (si se activó) y
// cierre. Un Programa no puede traer otras: el control de lectura no tiene ruleta ni conexiones.
export function armarFasesDelControlDeLectura({ duracionDeLaEscrituraMin, revisionDePares }) {
  const fases = [{ tipo: TIPOS_DE_FASE.CONTROL_DE_LECTURA, duracionMin: duracionDeLaEscrituraMin }];
  if (revisionDePares.activa) {
    fases.push({ tipo: TIPOS_DE_FASE.REVISION_DE_PARES, duracionMin: revisionDePares.duracionMin });
  }
  fases.push({ tipo: TIPOS_DE_FASE.CIERRE_Y_RANKING });
  return fases;
}

// Errores que impiden abrir la sesión (lista vacía = Programa válido). Se revisan al cargar el archivo.
export function validarProgramaDeLectura(programa) {
  const errores = [];
  if (!String(programa?.consigna ?? '').trim()) {
    errores.push('Falta la «consigna»: lo que cada estudiante debe escribir.');
  }
  const estructuraPedida = programa?.estructura;
  if (typeof estructuraPedida === 'object' && estructuraPedida !== null && !estructuraPedida.id) {
    const nombreDeLaParte = (parte) => (typeof parte?.nombre === 'string' ? parte.nombre : (parte?.nombre?.es ?? ''));
    const partes = estructuraPedida.partes;
    if (!Array.isArray(partes) || partes.length === 0 || partes.some((parte) => !nombreDeLaParte(parte).trim())) {
      errores.push('Una estructura propia necesita «partes», cada una con su «nombre».');
    }
  }
  if (programa?.distribucion && !Object.values(DISTRIBUCIONES_DE_ESTRUCTURA).includes(programa.distribucion)) {
    errores.push('La «distribucion» debe ser «compacta» o «desarrollada».');
  }
  if (programa?.rubrica !== undefined && resolverRubricaDelPrograma({ rubrica: programa.rubrica }).length === 0) {
    errores.push('La «rubrica» no tiene ningún criterio válido (cada uno necesita «nombre»).');
  }
  return errores;
}

// Completa lo que el Programa no trae: sin posturas ni co-moderadores, integridad con advertencias
// (aquí es la regla: hay nota de por medio), una sola entrega por persona.
export function normalizarProgramaDeLectura(programa) {
  return {
    ...programa,
    actividad: ID_CONTROL_DE_LECTURA,
    posturas: [],
    moderacion: { modo: 'ninguno' },
    integridad: normalizarIntegridad(programa.integridad ?? { nivel: NIVELES_DE_INTEGRIDAD.ADVERTENCIAS }),
    modoDeAhorro: normalizarModoDeAhorro(programa.modoDeAhorro),
    ventanaDeConfirmacionMin: resolverVentanaDeConfirmacionMin(programa),
    revisionDePares: normalizarRevisionDePares(programa.revisionDePares),
  };
}

// El Programa que se publica con lo que el docente eligió en la configuración previa.
export function armarProgramaDeLaSesionDeLectura({
  programaBase,
  idioma,
  duracionDeLaEscrituraMin,
  numeroDeParrafos,
  estructura,
  distribucion,
  integridad,
  umbralesDeSimilitud,
  penalizacionPorPegado,
  revisionDePares,
  ventanaDeConfirmacionMin,
  modoDeAhorro,
}) {
  const revisionNormalizada = normalizarRevisionDePares(revisionDePares ?? programaBase.revisionDePares);
  const baseNormalizada = normalizarProgramaDeLectura(programaBase);
  const ventanaElegida = Math.floor(Number(ventanaDeConfirmacionMin));
  return {
    ...baseNormalizada,
    idioma: idioma ?? programaBase.idioma,
    numeroDeParrafos: Math.max(1, Math.floor(Number(numeroDeParrafos ?? programaBase.numeroDeParrafos) || 1)),
    estructura: estructura ?? programaBase.estructura ?? 'libre',
    distribucion: distribucion ?? programaBase.distribucion ?? DISTRIBUCIONES_DE_ESTRUCTURA.COMPACTA,
    integridad: normalizarIntegridad(integridad ?? baseNormalizada.integridad),
    modoDeAhorro: normalizarModoDeAhorro(modoDeAhorro ?? baseNormalizada.modoDeAhorro),
    // Descuento automático por texto pegado (reversible por el docente): activa y hasta cuántos puntos.
    penalizacionPorPegado: normalizarPenalizacionPorPegado(penalizacionPorPegado ?? programaBase.penalizacionPorPegado),
    // A partir de qué porcentaje de parecido se marca cada banda (atención, alto, probable copia).
    umbralesDeSimilitud: resolverUmbralesDeSimilitud({ umbralesDeSimilitud: umbralesDeSimilitud ?? programaBase.umbralesDeSimilitud }),
    ventanaDeConfirmacionMin: ventanaElegida >= 1 ? ventanaElegida : baseNormalizada.ventanaDeConfirmacionMin,
    revisionDePares: revisionNormalizada,
    fases: armarFasesDelControlDeLectura({
      duracionDeLaEscrituraMin: duracionDeLaEscrituraMin ?? resolverDuracionDeLaEscrituraMin(programaBase),
      revisionDePares: revisionNormalizada,
    }),
  };
}

// Lo que se le muestra a la clase del Programa: consigna y estructura ya resueltas en el idioma.
export function resumirLaConsigna(programa) {
  const estructura = resolverEstructuraDelPrograma(programa, programa?.idioma ?? 'es');
  return { consigna: String(programa?.consigna ?? '').trim(), estructura };
}
