import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AvisoDeZoom } from '../shared/componentes/AvisoDeZoom.jsx';
import { iniciarCompensacionDeZoom } from '../shared/navegador/compensarZoomDelNavegador.js';
import '../shared/estilos/base.css';
import '../shared/estilos/sesion.css';

// Con el zoom del navegador muy reducido la página se amplía sola (ver compensarZoomDelNavegador.js).
iniciarCompensacionDeZoom();

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <AvisoDeZoom />
    <App />
  </StrictMode>
);
