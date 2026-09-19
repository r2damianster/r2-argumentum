// Si el zoom del navegador quedó muy por debajo del 100 % (Chrome lo recuerda POR SITIO, así que
// host y participantes abren igual), la interfaz sale diminuta en una tira estrecha en medio de
// la pantalla: la página no puede cambiar ese zoom, pero sí ampliarse a sí misma en la misma
// proporción para que la persona la vea a tamaño normal desde el primer momento. Ver
// zoomDelNavegador.js para cómo se detecta.
//
// Se usa la propiedad CSS `zoom` sobre <html>. Las unidades de viewport (vh) se escalan junto
// con ella, por eso la altura de la ventana se expone ya compensada en `--alto-de-ventana`.

import { calcularZoomDelNavegador, zoomEstaMuyReducido, factorParaLeerElAviso } from './zoomDelNavegador.js';

export function calcularFactorDeCompensacion(zoom) {
  return zoomEstaMuyReducido(zoom) ? factorParaLeerElAviso(zoom) : 1;
}

// Factor que está aplicado ahora mismo (1 si ninguno). Lo leen los componentes que dimensionan
// cosas a partir de `window.innerHeight`, que sigue en píxeles del zoom del navegador.
export function factorDeCompensacionActual() {
  const factor = parseFloat(document.documentElement.style.zoom);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function aplicarCompensacion() {
  const zoom = calcularZoomDelNavegador({ outerWidth: window.outerWidth, innerWidth: window.innerWidth });
  // En un celular o tableta (puntero táctil) `outerWidth` no mide lo mismo que en escritorio y el
  // cociente no es un nivel de zoom: ahí no se toca nada.
  const esDispositivoTactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const factor = esDispositivoTactil ? 1 : calcularFactorDeCompensacion(zoom);
  const raiz = document.documentElement;

  if (factor === 1) {
    raiz.style.removeProperty('zoom');
    raiz.style.removeProperty('--alto-de-ventana');
    return;
  }
  raiz.style.zoom = String(factor);
  raiz.style.setProperty('--alto-de-ventana', `${Math.round(window.innerHeight / factor)}px`);
}

// Se llama una vez por punto de entrada, antes de montar React. Al cambiar el zoom del navegador
// (Ctrl + 0, por ejemplo) el navegador dispara `resize` y la compensación se recalcula sola.
export function iniciarCompensacionDeZoom() {
  aplicarCompensacion();
  window.addEventListener('resize', aplicarCompensacion);
}
