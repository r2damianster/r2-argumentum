import { useReceptorDeProyeccion } from './proyeccion/canalDeProyeccion.js';
import { VistaDeProyeccion } from './componentes/VistaDeProyeccion.jsx';

// Ventana pensada para el proyector (se abre desde "Proyectar en otra ventana" de la consola).
// No se conecta a Ably ni ejecuta el motor: recibe el estado ya calculado de la pestaña del host.
export function VentanaDeProyeccion({ codigoDeSala }) {
  const { paquete, sinSoporte } = useReceptorDeProyeccion(codigoDeSala);

  if (sinSoporte) {
    return (
      <main className="ventana-de-proyeccion-esperando">
        <h1>R2 Argumentum</h1>
        <p className="mensaje-de-error">
          Este navegador no permite compartir la proyección entre ventanas. Usa “Proyectar aquí” en la consola
          del host.
        </p>
      </main>
    );
  }

  if (!paquete?.estado || !paquete?.programa) {
    return (
      <main className="ventana-de-proyeccion-esperando">
        <h1>R2 Argumentum</h1>
        <p className="texto-de-ayuda">
          Esperando a la consola del host de la sala {codigoDeSala}… Mantén abierta esa pestaña: esta ventana
          solo muestra lo que ella envía.
        </p>
      </main>
    );
  }

  return (
    <VistaDeProyeccion
      estado={paquete.estado}
      programa={paquete.programa}
      presencia={paquete.presencia ?? []}
      conexion={paquete.conexion}
    />
  );
}
