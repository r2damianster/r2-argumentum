import {
  ETIQUETA_DEL_MODO_DE_AHORRO,
  MODOS_DE_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO,
} from '../../shared/nucleo/capacidad/modosDeAhorro.js';

// Modo de ahorro de mensajes y de IA según el tamaño de la sala (ver nucleo/capacidad/modosDeAhorro.js). En
// «automático» el host lo fija al iniciar según cuántas personas hay conectadas. `conMasivo`: el modo masivo solo existe
// para el control de lectura (donde cada persona trabaja sola).
export function SelectorDeModoDeAhorro({ modoDeAhorro, onCambiarModoDeAhorro, conMasivo = false }) {
  const opciones = [
    {
      modo: MODOS_DE_AHORRO.AUTOMATICO,
      titulo: `${ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.AUTOMATICO]} (recomendado)`,
      ayuda: `Al iniciar se elige según cuántas personas haya: menos de ${PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO}, sala pequeña; de ${PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO} a ${PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO - 1}, sala grande (moderado); ${PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO} o más, sala grande (ahorro).`,
    },
    {
      modo: MODOS_DE_AHORRO.PEQUENA,
      titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.PEQUENA],
      ayuda: 'Todo al instante: cada entrega se avisa a la sala al momento y la IA sugiere sola, con el esfuerzo normal.',
    },
    {
      modo: MODOS_DE_AHORRO.MODERADA,
      titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.MODERADA],
      ayuda:
        'Ahorra mensajes y tokens de IA: las entregas se anuncian en lote cada pocos segundos, la IA razona con menos esfuerzo y las réplicas muy cortas del foro no se consultan.',
    },
    {
      modo: MODOS_DE_AHORRO.AHORRO,
      titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.AHORRO],
      ayuda:
        'Además de lo anterior: revisiones, respuestas y devoluciones también se anuncian en lote, la IA solo sugiere cuando tú la pides y en el foro consulta una sola vez por aporte y nunca por réplicas.',
    },
    ...(conMasivo
      ? [
          {
            modo: MODOS_DE_AHORRO.MASIVO,
            titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.MASIVO],
            ayuda:
              'Para cientos de personas: nadie publica en la sala (ni siquiera al entrar); todo va por canales privados y tú ves resúmenes cada pocos segundos. La entrada tarda unos segundos y ya no ves quién está conectado. Se elige aquí, antes de abrir la sala.',
          },
        ]
      : []),
  ];

  return (
    <div className="bloque-de-configuracion">
      <p className="texto-de-ayuda">Modo de ahorro (según el tamaño de la sala)</p>
      <ul className="lista-de-perfiles">
        {opciones.map((opcion) => (
          <li key={opcion.modo}>
            <label>
              <input
                type="radio"
                name="modo-de-ahorro"
                checked={modoDeAhorro === opcion.modo}
                onChange={() => onCambiarModoDeAhorro(opcion.modo)}
              />
              <span>
                <strong>{opcion.titulo}</strong>
                <br />
                <span className="texto-de-ayuda">{opcion.ayuda}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
