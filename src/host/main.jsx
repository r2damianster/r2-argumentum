import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { VentanaDeProyeccion } from './VentanaDeProyeccion.jsx';
import { AvisoDeZoom } from '../shared/componentes/AvisoDeZoom.jsx';
import '../shared/estilos/base.css';
import '../shared/estilos/sesion.css';

// `?proyeccion=<sala>` abre la ventana del proyector en vez de la consola (ver
// proyeccion/canalDeProyeccion.js). Se decide una vez al cargar la página.
const salaAProyectar = new URLSearchParams(window.location.search).get('proyeccion');

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <AvisoDeZoom />
    {salaAProyectar ? <VentanaDeProyeccion codigoDeSala={salaAProyectar} /> : <App />}
  </StrictMode>
);
