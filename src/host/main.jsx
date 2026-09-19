import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AvisoDeZoom } from '../shared/componentes/AvisoDeZoom.jsx';
import '../shared/estilos/base.css';
import '../shared/estilos/sesion.css';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <AvisoDeZoom />
    <App />
  </StrictMode>
);
