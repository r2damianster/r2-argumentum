// Perfiles de puntaje — ver docs/05-reglas-de-puntaje.md.
//
// NO son tablas de puntaje paralelas: son juegos de parámetros que alimentan la MISMA fórmula
// única de formulaDePuntaje.js. La proporción entre posiciones se mantiene en los tres, así que
// el ranking por tiers (cortes por percentil dentro de cada postura) funciona igual con
// cualquiera. Lo que cambia es la escala y qué tan caro sale demorarse, escalar a co-moderador
// o rechazar un turno.

export const PERFILES_DE_PUNTAJE = {
  liviano: {
    etiqueta: 'Liviano',
    descripcion: 'Escala chica y descuentos suaves. Para primeras experiencias con la dinámica.',
    valoresBasePosicion: [10, 8, 3],
    descuentoRonda2: 0.85,
    descuentoViaCoModerador: 0.7,
    penalidadPorRechazoDeTurno: 2,
    factorDeBonosDeCoModeracion: 1,
  },
  estandar: {
    etiqueta: 'Estándar',
    descripcion: 'Los descuentos de docs/05 tal cual, con escala de centenas.',
    valoresBasePosicion: [100, 80, 30],
    descuentoRonda2: 0.7,
    descuentoViaCoModerador: 0.5,
    penalidadPorRechazoDeTurno: 20,
    factorDeBonosDeCoModeracion: 10,
  },
  estricto: {
    etiqueta: 'Estricto',
    descripcion: 'Escala de miles, descuentos fuertes y penalidad alta por rechazar el turno.',
    valoresBasePosicion: [1000, 800, 300],
    descuentoRonda2: 0.5,
    descuentoViaCoModerador: 0.3,
    penalidadPorRechazoDeTurno: 300,
    factorDeBonosDeCoModeracion: 100,
  },
};

export const PERFIL_POR_DEFECTO = 'liviano';

// El perfil elegido por el docente manda sobre los valores sueltos del JSON del Programa: esos
// quedan como compatibilidad para Programas viejos que no traen `perfilDePuntaje`.
export function resolverParametrosDePuntaje(programa) {
  const perfilElegido = programa?.perfilDePuntaje;
  if (perfilElegido && PERFILES_DE_PUNTAJE[perfilElegido]) {
    return PERFILES_DE_PUNTAJE[perfilElegido];
  }

  const perfilBase = PERFILES_DE_PUNTAJE[PERFIL_POR_DEFECTO];
  return {
    ...perfilBase,
    valoresBasePosicion: programa?.valoresBasePosicion ?? perfilBase.valoresBasePosicion,
    descuentoRonda2: programa?.descuentoRonda2 ?? perfilBase.descuentoRonda2,
    descuentoViaCoModerador: programa?.descuentoViaCoModerador ?? perfilBase.descuentoViaCoModerador,
  };
}
