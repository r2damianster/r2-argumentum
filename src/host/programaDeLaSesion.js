// Arma el Programa que se publica al canal con la configuración que el moderador eligió para
// ESTA sesión (posturas tildadas, modo de calificación, idioma, posturas nuevas).
//
// Es una función pura para poder probar que ninguna pieza de la configuración se pierde al
// fusionar: un Programa republicado con el perfil por defecto le pisa al debate el modo de
// calificación que el docente eligió (bug reportado en la prueba del 19 de septiembre).
//
// Devuelve null si quedan menos de 2 posturas: un debate necesita al menos dos.

import { normalizarModeracion } from '../shared/nucleo/coModeracion/calcularCoModeradores.js';
import { normalizarIntegridad } from '../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { normalizarModoDeAhorro } from '../shared/nucleo/capacidad/modosDeAhorro.js';
import { aplicarCriteriosElegidos } from '../shared/nucleo/criteriosAdicionales/criteriosAdicionales.js';

const MINIMO_DE_POSTURAS = 2;

function activosPorDefecto(criterios) {
  return new Set(
    (Array.isArray(criterios) ? criterios : [])
      .filter((criterio) => criterio?.activo ?? criterio?.activoPorDefecto)
      .map((criterio) => criterio.id)
  );
}

export function armarProgramaDeLaSesion({
  programaBase,
  posturasDelPrograma,
  idsDePosturasSeleccionadas,
  perfilDePuntaje,
  permitirPosturasNuevas,
  idioma,
  asignacionPostura,
  moderacion,
  integridad,
  modoDeAhorro,
  idsDeCriteriosActivos,
}) {
  const posturasElegidas = posturasDelPrograma.filter((postura) => idsDePosturasSeleccionadas.has(postura.id));
  if (posturasElegidas.length < MINIMO_DE_POSTURAS) {
    return null;
  }
  return {
    ...programaBase,
    posturas: posturasElegidas,
    perfilDePuntaje,
    permitirPosturasNuevas: Boolean(permitirPosturasNuevas),
    idioma,
    asignacionPostura: asignacionPostura ?? programaBase.asignacionPostura ?? 'aleatoria',
    // Cuántos co-moderadores hay y cómo se eligen; sin elegir nada rige el modo reglamentario.
    moderacion: normalizarModeracion(moderacion ?? programaBase.moderacion),
    // Apagada por defecto: sin elegir nada no se registra ninguna señal de integridad.
    integridad: normalizarIntegridad(integridad ?? programaBase.integridad),
    // Criterios adicionales: el Programa los propone y el moderador activa o apaga cada uno para esta sesión.
    ...(programaBase.criteriosAdicionales === undefined
      ? {}
      : {
          criteriosAdicionales: aplicarCriteriosElegidos(
            programaBase.criteriosAdicionales,
            idsDeCriteriosActivos ?? activosPorDefecto(programaBase.criteriosAdicionales)
          ),
        }),
    // Solo las actividades donde importa (foro) lo piden; el debate hablado no lo trae y rige el comportamiento de siempre.
    ...(modoDeAhorro === undefined ? {} : { modoDeAhorro: normalizarModoDeAhorro(modoDeAhorro) }),
    // Programas guardados antes de retirar la apertura simultánea pueden traer esa fase: se
    // descarta, porque ya no existe (el ingreso con argumento se confirma en la sala de espera).
    fases: programaBase.fases?.filter((fase) => fase.tipo !== 'apertura_simultanea'),
  };
}
