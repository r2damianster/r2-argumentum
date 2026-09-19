// Filtro determinista previo a Groq (checkpoint 1). No juzga el contenido: solo descarta lo que
// ni siquiera parece un argumento, para no gastar una llamada ni aprobar por error.
//
// Motivo real: en una prueba en vivo se presentó al debate un argumento que decía "Este texto
// no debería presentarse porque ....". Tenía el conector "porque", así que a un modelo que busca
// "afirmación + razón" le puede parecer bien formado, pero después del conector no hay ninguna
// razón. El prefijo "_" en el nombre evita que Vercel lo exponga como endpoint.

// Los conectores dependen del idioma en que se escribe el debate (el Programa lo define). Los
// mensajes al participante siguen en español: la interfaz no se traduce.
const CONECTORES_DE_RAZON_POR_IDIOMA = {
  es: ['porque', 'ya que', 'dado que', 'debido a', 'puesto que'],
  en: ['because', 'since', 'given that', 'due to', 'as a result of'],
};

const MINIMO_DE_PALABRAS_EN_TOTAL = 5;
const MINIMO_DE_PALABRAS_TRAS_EL_CONECTOR = 2;

function contarPalabras(fragmento) {
  return (fragmento.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

export function revisarFormaMinima(texto, idioma = 'es') {
  const textoLimpio = String(texto ?? '').trim();

  if (contarPalabras(textoLimpio) < MINIMO_DE_PALABRAS_EN_TOTAL) {
    return {
      valido: false,
      motivo: 'El texto es demasiado corto para ser un argumento.',
      sugerencia: 'Escribe lo que afirmas y la razón que lo sostiene, en una o dos frases completas.',
    };
  }

  const textoEnMinusculas = textoLimpio.toLowerCase();
  const conectores = CONECTORES_DE_RAZON_POR_IDIOMA[idioma] ?? CONECTORES_DE_RAZON_POR_IDIOMA.es;
  for (const conector of conectores) {
    const expresion = new RegExp(`(?<![\\p{L}])${conector}(?![\\p{L}])`, 'gu');
    let coincidencia = expresion.exec(textoEnMinusculas);
    while (coincidencia) {
      const desdeElConector = coincidencia.index + conector.length;
      // La razón llega hasta el final del texto o hasta el siguiente punto y aparte: lo que
      // sigue a un punto ya es otra frase y no puede rescatar a un conector vacío.
      const razon = textoEnMinusculas.slice(desdeElConector).split(/[.!?]+\s+/u)[0];
      if (contarPalabras(razon) < MINIMO_DE_PALABRAS_TRAS_EL_CONECTOR) {
        return {
          valido: false,
          motivo: `Después de «${conector}» no explicas la razón.`,
          sugerencia: 'Completa la frase: di concretamente cuál es la causa, el dato o el ejemplo.',
        };
      }
      coincidencia = expresion.exec(textoEnMinusculas);
    }
  }

  return { valido: true, motivo: '', sugerencia: '' };
}
