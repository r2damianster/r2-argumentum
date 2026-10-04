import { TIPOS_DE_REACCION } from '../../eventos/nombresDeEventos.js';
import { ETIQUETA_DE_REACCION, ICONO_DE_REACCION } from '../../nucleo/reacciones/contarReacciones.js';

// Reacciones con sentido a un aporte (no hay «me gusta» genérico). Pulsar la propia reacción la
// quita; pulsar otra la reemplaza. Nadie reacciona a lo suyo: en ese caso solo se ven los conteos.
export function ReaccionesDelAporte({ conteo, miReaccion, puedeReaccionar, onReaccionar }) {
  return (
    <div className="reacciones-del-aporte">
      {Object.values(TIPOS_DE_REACCION).map((tipo) => {
        const esMia = miReaccion === tipo;
        const etiqueta = `${ICONO_DE_REACCION[tipo]} ${ETIQUETA_DE_REACCION[tipo]}`;
        if (!puedeReaccionar) {
          return conteo[tipo] > 0 ? (
            <span key={tipo} className="reaccion-solo-lectura">
              {etiqueta} · {conteo[tipo]}
            </span>
          ) : null;
        }
        return (
          <button
            key={tipo}
            type="button"
            className={`boton-de-reaccion ${esMia ? 'boton-de-reaccion--mia' : ''}`}
            aria-pressed={esMia}
            onClick={() => onReaccionar(esMia ? null : tipo)}
          >
            {etiqueta}
            {conteo[tipo] > 0 && <span className="conteo-de-reaccion"> · {conteo[tipo]}</span>}
          </button>
        );
      })}
    </div>
  );
}
