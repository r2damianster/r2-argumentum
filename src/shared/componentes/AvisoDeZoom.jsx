import { useEffect, useState } from 'react';
import { calcularZoomDelNavegador, zoomEstaMuyReducido, porcentajeDeZoom } from '../navegador/zoomDelNavegador.js';

function medirZoomActual() {
  return calcularZoomDelNavegador({ outerWidth: window.outerWidth, innerWidth: window.innerWidth });
}

// Barra fija que aparece solo cuando el navegador tiene el zoom muy por debajo del 100 %. El
// zoom de Chrome se recuerda por sitio y hace que host y participantes abran con la interfaz
// diminuta: la página se amplía sola (compensarZoomDelNavegador.js) y esta barra lo explica. Se monta una vez en cada punto de entrada, fuera de App.
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

  // En celulares y tabletas no se compensa nada (ver compensarZoomDelNavegador.js), así que
  // tampoco se avisa: incluye el modo dispositivo de las herramientas de desarrollo (F12).
  const esDispositivoTactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (oculto || esDispositivoTactil || !zoomEstaMuyReducido(zoom)) {
    return null;
  }

  return (
    <div className="aviso-de-zoom" role="alert">
      <span>
        🔍 El zoom del navegador está en {porcentajeDeZoom(zoom)} %, así que ampliamos la página para que se
        lea. Para dejarlo en su tamaño normal pulsa <strong>Ctrl + 0</strong> (en Mac, <strong>⌘ + 0</strong>).
      </span>
      <button type="button" onClick={() => setOculto(true)}>
        Ocultar
      </button>
    </div>
  );
}
