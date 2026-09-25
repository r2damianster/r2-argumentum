// Arma el Programa que se publica al canal con la configuración que el moderador eligió para
// ESTA sesión (posturas tildadas, modo de calificación, idioma, posturas nuevas).
//
// Es una función pura para poder probar que ninguna pieza de la configuración se pierde al
// fusionar: un Programa republicado con el perfil por defecto le pisa al debate el modo de
// calificación que el docente eligió (bug reportado en la prueba del 19 de septiembre).
//
// Devuelve null si quedan menos de 2 posturas: un debate necesita al menos dos.

const MINIMO_DE_POSTURAS = 2;

export function armarProgramaDeLaSesion({
  programaBase,
  posturasDelPrograma,
  idsDePosturasSeleccionadas,
  perfilDePuntaje,
  permitirPosturasNuevas,
  idioma,
  asignacionPostura,
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
    // Programas guardados antes de retirar la apertura simultánea pueden traer esa fase: se
    // descarta, porque ya no existe (el ingreso con argumento se confirma en la sala de espera).
    fases: programaBase.fases?.filter((fase) => fase.tipo !== 'apertura_simultanea'),
  };
}
