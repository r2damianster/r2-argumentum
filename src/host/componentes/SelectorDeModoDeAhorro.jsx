import {
  ETIQUETA_DEL_MODO_DE_AHORRO,
  MODOS_DE_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO,
} from '../../shared/nucleo/capacidad/modosDeAhorro.js';

// Modo de ahorro de mensajes y de IA según el tamaño de la sala (ver nucleo/capacidad/modosDeAhorro.js). En
// «automático» el host lo fija al iniciar según cuántas personas hay conectadas.
export function SelectorDeModoDeAhorro({ modoDeAhorro, onCambiarModoDeAhorro }) {
  const opciones = [
    {
      modo: MODOS_DE_AHORRO.AUTOMATICO,
      titulo: `${ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.AUTOMATICO]} (recomendado)`,
      ayuda: `Al iniciar, si hay ${PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO} personas o más se usa el modo de sala grande; si hay menos, el de sala pequeña.`,
    },
    {
      modo: MODOS_DE_AHORRO.PEQUENA,
      titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.PEQUENA],
      ayuda: 'Todo al instante: cada entrega se avisa a la sala al momento y la IA revisa con el esfuerzo normal.',
    },
    {
      modo: MODOS_DE_AHORRO.MODERADA,
      titulo: ETIQUETA_DEL_MODO_DE_AHORRO[MODOS_DE_AHORRO.MODERADA],
      ayuda:
        'Ahorra mensajes y tokens de IA: las entregas se anuncian en lote cada pocos segundos, la IA razona con menos esfuerzo y las réplicas muy cortas del foro no se consultan.',
    },
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
