import { useEffect, useState } from 'react';
import {
  calcularZoomDelNavegador,
  zoomEstaMuyReducido,
  factorParaLeerElAviso,
  porcentajeDeZoom,
} from '../navegador/zoomDelNavegador.js';

function medirZoomActual() {
  return calcularZoomDelNavegador({ outerWidth: window.outerWidth, innerWidth: window.innerWidth });
}

// Barra fija que aparece solo cuando el navegador tiene el zoom muy por debajo del 100 %. El
// zoom de Chrome se recuerda por sitio y hace que host y participantes abran con la interfaz
// diminuta (ver zoomDelNavegador.js). Se monta una vez en cada punto de entrada, fuera de App.
export function AvisoDeZoom() {
  const [zoom, setZoom] = useState(medirZoomActual);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    function remedir() {
      setZoom(medirZoomActual());
    }
    window.addEventListener('resize', remedir);
    return () => window.removeEventListener('resize', remedir);
  }, []);

  if (oculto || !zoomEstaMuyReducido(zoom)) {
    return null;
  }

  return (
    <div className="aviso-de-zoom" role="alert" style={{ fontSize: `${factorParaLeerElAviso(zoom)}rem` }}>
      <span>
        🔍 El zoom del navegador está en {porcentajeDeZoom(zoom)} %, por eso todo se ve diminuto. Pulsa{' '}
        <strong>Ctrl + 0</strong> (en Mac, <strong>⌘ + 0</strong>) para volver al 100 %.
      </span>
      <button type="button" onClick={() => setOculto(true)}>
        Ocultar
      </button>
    </div>
  );
}
