import { AvisoDeConexion } from '../../shared/componentes/AvisoDeConexion.jsx';
import { DestacadoDelTurno } from '../../shared/componentes/DestacadoDelTurno.jsx';
import { FeedDeActividad } from '../../shared/componentes/FeedDeActividad.jsx';
import { GrafoDeArgumentos } from '../../shared/componentes/GrafoDeArgumentos.jsx';
import { ListaDeParticipantes } from './ListaDeParticipantes.jsx';

// Lo que la clase necesita ver desde el fondo del aula: quién habla, el argumento destacado, el
// mapa y el marcador. Sin ningún control del moderador. Lo usan las dos formas de proyectar:
// en la misma pestaña del host y en una ventana aparte para el proyector.
//
// La consola normal tiene el grafo y los controles apilados en una sola columna; aquí el mapa
// arranca compacto y crece con el debate (ver calcularAltoDelGrafo).
export function VistaDeProyeccion({ estado, programa, presencia, conexion, botonDeSalida = null }) {
  return (
    <main className="consola-de-sesion modo-proyeccion">
      <div className="barra-superior">
        <h1>{programa.titulo}</h1>
        {botonDeSalida}
      </div>
      <AvisoDeConexion conexion={conexion} />
      <DestacadoDelTurno estado={estado} presencia={presencia} programa={programa} enProyeccion />
      <FeedDeActividad estado={estado} presencia={presencia} />
      <GrafoDeArgumentos estado={estado} programa={programa} presencia={presencia} modoProyeccion />
      <ListaDeParticipantes estado={estado} presencia={presencia} programa={programa} />
    </main>
  );
}
