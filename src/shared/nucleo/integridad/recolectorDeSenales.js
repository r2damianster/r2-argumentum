// Recolector de señales de integridad mientras alguien escribe — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Función pura (sin DOM): recibe lo que pasa en el campo de texto ya clasificado y, al enviar,
// resume qué señales hay. El reloj se inyecta para poder probarlo.
//
// Principios:
//  - Son SEÑALES, no pruebas. Todo detector del navegador se puede evadir, y algunos casos legítimos
//    (dictado por voz, autocorrector, teclados predictivos) insertan en bloque: por eso valen poco.
//  - No hay detector de «texto de IA»: es poco fiable y perjudica a quien escribe en un segundo idioma.
//  - Cada señal explica la EVIDENCIA concreta («pegó 412 de 430 caracteres»), no acusa.

export const TIPOS_DE_SENAL = {
  PEGADO: 'pegado',
  ARRASTRE: 'arrastre',
  BLOQUE: 'insercion_en_bloque',
  VELOCIDAD: 'velocidad_inusual',
  PESTANA: 'cambio_de_pestana',
  INTENTO_BLOQUEADO: 'intento_bloqueado',
  PARECIDO_A_EJEMPLO: 'parecido_a_un_ejemplo',
};

export const GRAVEDADES = { BAJA: 'baja', MEDIA: 'media', ALTA: 'alta' };

const ORDEN_DE_GRAVEDAD = { [GRAVEDADES.BAJA]: 1, [GRAVEDADES.MEDIA]: 2, [GRAVEDADES.ALTA]: 3 };

export const ETIQUETA_DE_SENAL = {
  [TIPOS_DE_SENAL.PEGADO]: 'Texto pegado',
  [TIPOS_DE_SENAL.ARRASTRE]: 'Texto arrastrado desde otra ventana',
  [TIPOS_DE_SENAL.BLOQUE]: 'Inserción de un bloque de texto',
  [TIPOS_DE_SENAL.VELOCIDAD]: 'Velocidad de escritura poco habitual',
  [TIPOS_DE_SENAL.PESTANA]: 'Salió de la pestaña mientras escribía',
  [TIPOS_DE_SENAL.INTENTO_BLOQUEADO]: 'Intento de pegar o arrastrar (bloqueado)',
  [TIPOS_DE_SENAL.PARECIDO_A_EJEMPLO]: 'Parecido a un ejemplo del Programa',
};

export const ETIQUETA_DE_GRAVEDAD = { baja: 'Baja', media: 'Media', alta: 'Alta' };

// Umbrales: calibrados para marcar lo evidente y dejar pasar el uso normal.
const MINIMO_DE_CARACTERES_PEGADOS_PARA_MARCAR = 20;
const PROPORCION_PEGADA_QUE_ES_ALTA = 0.6;
const PROPORCION_PEGADA_QUE_ES_MEDIA = 0.2;
const MINIMO_DE_CARACTERES_ARRASTRADOS_PARA_MARCAR = 10;
const MINIMO_DE_UN_BLOQUE_SIN_PEGAR = 60;
const CARACTERES_POR_SEGUNDO_QUE_NO_TECLEA_UNA_PERSONA = 12;
const MINIMO_DE_CARACTERES_TECLEADOS_PARA_MEDIR_VELOCIDAD = 80;
const MINIMO_DE_SEGUNDOS_PARA_MEDIR_VELOCIDAD = 5;
const MINIMO_DE_SALIDAS_DE_PESTANA_PARA_MARCAR = 3;
const SEGUNDOS_FUERA_DE_PESTANA_PARA_MARCAR = 30;

// Penalización por pegado (control de lectura, docs/14): pegar un bloque pequeño (una palabra, una cita corta)
// no cuenta. Y borrar lo pegado NO borra del todo el antecedente, pero la persona recupera casi toda su
// oportunidad: se conserva solo este porcentaje de lo que se pegó y se quitó (con el descuento máximo por
// defecto de 5 puntos, pegar todo y borrarlo todo deja un descuento de 1 punto, en un color casi verde).
export const MINIMO_DE_CARACTERES_PEGADOS_PARA_PENALIZAR = 20;
export const PORCENTAJE_RETENIDO_DE_LO_PEGADO_Y_BORRADO = 0.2;

export const TIPOS_DE_ENTRADA = {
  ESCRITURA: 'escritura',
  PEGADO: 'pegado',
  ARRASTRE: 'arrastre',
  BLOQUE: 'bloque',
  BORRADO: 'borrado',
  OTRA: 'otra',
};

// Qué tipo de entrada es un `input` del navegador, según su `inputType`. Pegar y arrastrar tienen un
// tipo propio; un texto que entra de golpe SIN ser pegado (dictado, autocompletado, teclado
// predictivo) cuenta aparte porque puede ser legítimo.
export function clasificarEntrada(inputType, datos) {
  const tipo = String(inputType ?? '');
  if (tipo.startsWith('insertFromPaste') || tipo === 'insertFromYank') {
    return TIPOS_DE_ENTRADA.PEGADO;
  }
  if (tipo === 'insertFromDrop') {
    return TIPOS_DE_ENTRADA.ARRASTRE;
  }
  if (tipo.startsWith('delete')) {
    return TIPOS_DE_ENTRADA.BORRADO;
  }
  if (tipo === 'insertText' || tipo === 'insertCompositionText' || tipo === 'insertReplacementText') {
    return String(datos ?? '').length > 1 && tipo === 'insertText' ? TIPOS_DE_ENTRADA.BLOQUE : TIPOS_DE_ENTRADA.ESCRITURA;
  }
  if (tipo === 'insertLineBreak' || tipo === 'insertParagraph') {
    return TIPOS_DE_ENTRADA.ESCRITURA;
  }
  return TIPOS_DE_ENTRADA.OTRA;
}

function porcentaje(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function crearRecolectorDeSenales({ ahora = () => Date.now() } = {}) {
  let estado;

  function reiniciar() {
    estado = {
      inicio: null,
      pegadoCaracteres: 0,
      pegadoVeces: 0,
      arrastradoCaracteres: 0,
      arrastradoVeces: 0,
      tecleadoCaracteres: 0,
      mayorBloque: 0,
      // Lo pegado o arrastrado que sigue en el texto (estimado) y lo que se pegó y luego se borró.
      pegadoVigente: 0,
      pegadoBorrado: 0,
      intentosBloqueados: 0,
      salidasDePestana: 0,
      milisegundosFueraDePestana: 0,
      pestanaOcultaDesde: null,
    };
  }
  reiniciar();

  function marcarInicio() {
    if (estado.inicio === null) {
      estado.inicio = ahora();
    }
  }

  function registrarEntrada({ tipo, caracteres = 0 }) {
    marcarInicio();
    if (tipo === TIPOS_DE_ENTRADA.PEGADO) {
      estado.pegadoCaracteres += caracteres;
      estado.pegadoVeces += 1;
      estado.pegadoVigente += caracteres;
    } else if (tipo === TIPOS_DE_ENTRADA.ARRASTRE) {
      estado.arrastradoCaracteres += caracteres;
      estado.arrastradoVeces += 1;
      estado.pegadoVigente += caracteres;
    } else if (tipo === TIPOS_DE_ENTRADA.BORRADO) {
      // Se supone que lo que se borra es primero lo pegado: la hipótesis más estricta con quien pega y quita.
      const quitado = Math.min(Math.max(0, caracteres), estado.pegadoVigente);
      estado.pegadoVigente -= quitado;
      estado.pegadoBorrado += quitado;
    } else if (tipo === TIPOS_DE_ENTRADA.BLOQUE) {
      estado.mayorBloque = Math.max(estado.mayorBloque, caracteres);
    } else if (tipo === TIPOS_DE_ENTRADA.ESCRITURA) {
      estado.tecleadoCaracteres += Math.max(1, caracteres);
    }
  }

  function registrarIntentoBloqueado() {
    marcarInicio();
    estado.intentosBloqueados += 1;
  }

  function registrarPestanaOculta() {
    if (estado.inicio !== null && estado.pestanaOcultaDesde === null) {
      estado.pestanaOcultaDesde = ahora();
      estado.salidasDePestana += 1;
    }
  }

  function registrarPestanaVisible() {
    if (estado.pestanaOcultaDesde !== null) {
      estado.milisegundosFueraDePestana += ahora() - estado.pestanaOcultaDesde;
      estado.pestanaOcultaDesde = null;
    }
  }

  // Qué parte del texto se considera pegada, entre 0 y 1: lo pegado que sigue ahí, más un porcentaje de lo
  // pegado y borrado, sobre todo lo que se escribió, pegó y quitó. Se calcula al vuelo para avisar mientras se
  // escribe; con menos de MINIMO_DE_CARACTERES_PEGADOS_PARA_PENALIZAR pegados no hay penalización.
  function proporcionPenalizada() {
    if (estado.pegadoCaracteres + estado.arrastradoCaracteres < MINIMO_DE_CARACTERES_PEGADOS_PARA_PENALIZAR) {
      return 0;
    }
    const efectivo = estado.pegadoVigente + PORCENTAJE_RETENIDO_DE_LO_PEGADO_Y_BORRADO * estado.pegadoBorrado;
    const total = estado.tecleadoCaracteres + estado.pegadoVigente + estado.pegadoBorrado;
    return total > 0 ? Math.min(1, efectivo / total) : 0;
  }

  // Resume lo registrado frente al texto que se va a enviar. `senalesExternas` permite sumar señales
  // que se calculan fuera (por ejemplo el parecido a un ejemplo del Programa).
  function resumir({ textoFinal = '', senalesExternas = [] } = {}) {
    const caracteresFinales = String(textoFinal).length;
    const segundos = estado.inicio === null ? 0 : Math.max(0, (ahora() - estado.inicio) / 1000);
    const milisegundosFuera =
      estado.milisegundosFueraDePestana + (estado.pestanaOcultaDesde === null ? 0 : ahora() - estado.pestanaOcultaDesde);
    const senales = [];

    if (estado.pegadoCaracteres >= MINIMO_DE_CARACTERES_PEGADOS_PARA_MARCAR) {
      const proporcion = estado.pegadoCaracteres / Math.max(caracteresFinales, estado.pegadoCaracteres);
      senales.push({
        tipo: TIPOS_DE_SENAL.PEGADO,
        gravedad:
          proporcion >= PROPORCION_PEGADA_QUE_ES_ALTA
            ? GRAVEDADES.ALTA
            : proporcion >= PROPORCION_PEGADA_QUE_ES_MEDIA
              ? GRAVEDADES.MEDIA
              : GRAVEDADES.BAJA,
        detalle: `Pegó ${estado.pegadoCaracteres} caracteres en ${estado.pegadoVeces} ocasión(es): ${porcentaje(
          estado.pegadoCaracteres,
          Math.max(caracteresFinales, estado.pegadoCaracteres)
        )} % del texto enviado.`,
      });
    }

    if (estado.arrastradoCaracteres >= MINIMO_DE_CARACTERES_ARRASTRADOS_PARA_MARCAR) {
      senales.push({
        tipo: TIPOS_DE_SENAL.ARRASTRE,
        gravedad: GRAVEDADES.ALTA,
        detalle: `Arrastró ${estado.arrastradoCaracteres} caracteres desde otra ventana.`,
      });
    }

    if (estado.mayorBloque >= MINIMO_DE_UN_BLOQUE_SIN_PEGAR) {
      senales.push({
        tipo: TIPOS_DE_SENAL.BLOQUE,
        gravedad: GRAVEDADES.BAJA,
        detalle: `Entró un bloque de ${estado.mayorBloque} caracteres de una sola vez, sin ser pegado. Puede ser dictado por voz, autocompletado o un teclado predictivo.`,
      });
    }

    if (
      estado.tecleadoCaracteres >= MINIMO_DE_CARACTERES_TECLEADOS_PARA_MEDIR_VELOCIDAD &&
      segundos >= MINIMO_DE_SEGUNDOS_PARA_MEDIR_VELOCIDAD &&
      estado.tecleadoCaracteres / segundos > CARACTERES_POR_SEGUNDO_QUE_NO_TECLEA_UNA_PERSONA
    ) {
      senales.push({
        tipo: TIPOS_DE_SENAL.VELOCIDAD,
        gravedad: GRAVEDADES.MEDIA,
        detalle: `Tecleó ${estado.tecleadoCaracteres} caracteres en ${Math.round(segundos)} segundos (${(
          estado.tecleadoCaracteres / segundos
        ).toFixed(1)} por segundo).`,
      });
    }

    if (
      estado.salidasDePestana >= MINIMO_DE_SALIDAS_DE_PESTANA_PARA_MARCAR ||
      milisegundosFuera / 1000 >= SEGUNDOS_FUERA_DE_PESTANA_PARA_MARCAR
    ) {
      senales.push({
        tipo: TIPOS_DE_SENAL.PESTANA,
        gravedad: GRAVEDADES.BAJA,
        detalle: `Salió de la pestaña ${estado.salidasDePestana} vez/veces (${Math.round(
          milisegundosFuera / 1000
        )} s en total) mientras escribía. En el celular es frecuente por mensajes y llamadas.`,
      });
    }

    if (estado.intentosBloqueados > 0) {
      senales.push({
        tipo: TIPOS_DE_SENAL.INTENTO_BLOQUEADO,
        gravedad: GRAVEDADES.MEDIA,
        detalle: `Intentó pegar o arrastrar texto ${estado.intentosBloqueados} vez/veces; se bloqueó.`,
      });
    }

    senales.push(...senalesExternas);
    senales.sort((senalA, senalB) => ORDEN_DE_GRAVEDAD[senalB.gravedad] - ORDEN_DE_GRAVEDAD[senalA.gravedad]);

    const gravedadMaxima = senales.length > 0 ? senales[0].gravedad : null;
    return {
      senales,
      gravedadMaxima,
      // Solo se interrumpe a quien escribe con las señales de gravedad media o alta; las bajas se registran
      // (y se avisó de que se registran) pero no merecen frenar el envío.
      requiereAdvertencia: gravedadMaxima !== null && ORDEN_DE_GRAVEDAD[gravedadMaxima] >= ORDEN_DE_GRAVEDAD[GRAVEDADES.MEDIA],
      estadisticas: {
        caracteresFinales,
        segundosDeRedaccion: Math.round(segundos),
        pegadoCaracteres: estado.pegadoCaracteres,
        arrastradoCaracteres: estado.arrastradoCaracteres,
        tecleadoCaracteres: estado.tecleadoCaracteres,
        intentosBloqueados: estado.intentosBloqueados,
        salidasDePestana: estado.salidasDePestana,
        proporcionPenalizada: Math.round(proporcionPenalizada() * 10000) / 10000,
      },
    };
  }

  return {
    proporcionPenalizada,
    registrarEntrada,
    registrarIntentoBloqueado,
    registrarPestanaOculta,
    registrarPestanaVisible,
    reiniciar,
    resumir,
  };
}
