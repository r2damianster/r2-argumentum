// Traduce lo que pasa en un campo de texto (pegar, arrastrar, escribir, cambiar de pestaña) a
// llamadas al recolector de señales. Está separado del hook de React para poder probarlo con
// eventos falsos, sin navegador.

import { buscarArgumentoParecido } from '../../argumentos/buscarArgumentoParecido.js';
import { GRAVEDADES, TIPOS_DE_ENTRADA, TIPOS_DE_SENAL, clasificarEntrada } from './recolectorDeSenales.js';

function leerTextoDelPortapapeles(evento) {
  return String(evento.clipboardData?.getData?.('text') ?? evento.clipboardData?.getData?.('text/plain') ?? '');
}

function leerTextoArrastrado(evento) {
  return String(evento.dataTransfer?.getData?.('text') ?? evento.dataTransfer?.getData?.('text/plain') ?? '');
}

// `bloquearPegado`: con el nivel restrictivo no se deja pegar ni arrastrar, y el intento queda registrado.
export function crearManejadoresDeEntrada({ recolector, bloquearPegado = false }) {
  return {
    alPegar(evento) {
      if (bloquearPegado) {
        evento.preventDefault();
        recolector.registrarIntentoBloqueado();
        return;
      }
      recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: leerTextoDelPortapapeles(evento).length });
    },

    alSoltar(evento) {
      if (bloquearPegado) {
        evento.preventDefault();
        recolector.registrarIntentoBloqueado();
        return;
      }
      recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ARRASTRE, caracteres: leerTextoArrastrado(evento).length });
    },

    // El pegado y el arrastre ya se contaron en sus propios eventos, con la cantidad exacta: el `input`
    // que los sigue se ignora para no contarlos dos veces.
    alEscribir(evento) {
      const eventoNativo = evento.nativeEvent ?? evento;
      const tipo = clasificarEntrada(eventoNativo.inputType, eventoNativo.data);
      if (tipo === TIPOS_DE_ENTRADA.PEGADO || tipo === TIPOS_DE_ENTRADA.ARRASTRE) {
        return;
      }
      // Un `insertText` trae lo que se insertó; la composición (autocorrector, teclados predictivos)
      // reenvía la palabra completa en cada pulsación, así que cuenta como un carácter por evento.
      const caracteres = eventoNativo.inputType === 'insertText' ? String(eventoNativo.data ?? '').length : 1;
      recolector.registrarEntrada({ tipo, caracteres });
    },

    alCambiarLaVisibilidad(pestanaVisible) {
      if (pestanaVisible) {
        recolector.registrarPestanaVisible();
      } else {
        recolector.registrarPestanaOculta();
      }
    },
  };
}

// Señal por parecido con los ejemplos «buenos» del Programa: copiar el ejemplo que el docente dio
// para orientar no es escribir con palabras propias.
export function senalDeParecidoAEjemplos(texto, ejemplosPorTema = []) {
  const ejemplosComoAportes = ejemplosPorTema
    .filter((ejemplo) => ejemplo?.bueno)
    .map((ejemplo, indice) => ({ argumentId: `ejemplo-${indice}`, participantId: 'programa', texto: ejemplo.bueno }));
  const parecido = buscarArgumentoParecido(texto, ejemplosComoAportes);
  if (!parecido) {
    return [];
  }
  return [
    {
      tipo: TIPOS_DE_SENAL.PARECIDO_A_EJEMPLO,
      gravedad: GRAVEDADES.MEDIA,
      detalle: `Se parece mucho a uno de los ejemplos del Programa (${Math.round(parecido.similitud * 100)} % de parecido de vocabulario).`,
    },
  ];
}
