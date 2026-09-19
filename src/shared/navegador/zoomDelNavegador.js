// El zoom de página de Chrome/Edge se guarda POR SITIO: si alguien lo bajó una vez con Ctrl+−
// (o lo dejó en 33 % para ver el grafo entero), host y participantes —que comparten el mismo
// origen— abren siempre con la interfaz diminuta. La página no puede cambiar ese zoom, pero sí
// detectarlo y avisar cómo volver al 100 %.
//
// En Chrome/Edge `outerWidth` no se escala con el zoom (son píxeles del sistema) y `innerWidth`
// sí (son píxeles CSS), así que su cociente es el nivel de zoom: ~1 al 100 %, ~0,5 al 50 %.
// En otros navegadores el cociente queda cerca de 1 y simplemente no se avisa.

// Por debajo de esto la interfaz ya cuesta leerla; entre 0,8 y 1 es zoom "normal" (100 %, un
// panel de DevTools acoplado, bordes de ventana) y no se molesta a nadie.
const ZOOM_MINIMO_SIN_AVISAR = 0.8;

export function calcularZoomDelNavegador({ outerWidth, innerWidth }) {
  if (!outerWidth || !innerWidth || outerWidth <= 0 || innerWidth <= 0) {
    return 1;
  }
  return outerWidth / innerWidth;
}

export function zoomEstaMuyReducido(zoom) {
  return zoom < ZOOM_MINIMO_SIN_AVISAR;
}

// Al 33 % el propio aviso se vería a un tercio de su tamaño: se le aplica el factor inverso
// para que se lea, con un tope para no desbordar la ventana.
export function factorParaLeerElAviso(zoom) {
  return Math.min(4, Math.max(1, 1 / zoom));
}

export function porcentajeDeZoom(zoom) {
  return Math.round(zoom * 100);
}
