// Idioma en el que se escriben los argumentos de un debate.
//
// Solo afecta a lo que escriben los participantes: el corrector ortográfico del navegador (por el
// atributo `lang` de la página) y el idioma con el que Groq valida y comenta el argumento. La
// interfaz (botones, avisos, instrucciones) sigue siempre en español; este proyecto no tiene capa
// de traducción de interfaz (ver CLAUDE.md).

export const IDIOMA_POR_DEFECTO = 'es';

export const IDIOMAS_DEL_DEBATE = {
  es: { etiqueta: 'Español', nombreParaGroq: 'español' },
  en: { etiqueta: 'English', nombreParaGroq: 'inglés' },
};

// Un Programa viejo (sin `idioma`) o con un valor desconocido se juega en español.
export function resolverIdiomaDelDebate(programa) {
  const idiomaDelPrograma = programa?.idioma;
  return idiomaDelPrograma && IDIOMAS_DEL_DEBATE[idiomaDelPrograma] ? idiomaDelPrograma : IDIOMA_POR_DEFECTO;
}
