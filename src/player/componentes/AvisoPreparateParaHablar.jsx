import { useState, useEffect } from 'react';

// Aviso visual prominente «Prepárate para hablar» que alerta al estudiante recién ingresado
// de que los turnos se sortean aleatoriamente y debe estar listo para defender su argumento.
export function AvisoPreparateParaHablar({ visible = true }) {
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    // Si vuelve a ser visible tras haber sido desmontado/re-montado, reinicia el estado.
    setDescartado(false);
  }, [visible]);

  if (!visible || descartado) {
    return null;
  }

  return (
    <div className="aviso-preparate-para-hablar" role="status" aria-live="polite">
      <div className="aviso-preparate-contenido">
        <span className="aviso-preparate-icono" aria-hidden="true">
          ⚡
        </span>
        <div className="aviso-preparate-texto">
          <strong>¡PREPÁRATE PARA HABLAR!</strong>
          <p>
            Se están asignando turnos aleatoriamente para defender tu argumento y te puede tocar a ti en cualquier momento.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="boton-descartar-aviso"
        onClick={() => setDescartado(true)}
        aria-label="Cerrar aviso de preparación"
      >
        ✕
      </button>
    </div>
  );
}

