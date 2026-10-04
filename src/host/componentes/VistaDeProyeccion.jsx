import { AvisoDeConexion } from '../../shared/componentes/AvisoDeConexion.jsx';
import { DestacadoDelTurno } from '../../shared/componentes/DestacadoDelTurno.jsx';
import { FeedDeActividad } from '../../shared/componentes/FeedDeActividad.jsx';
import { GrafoDeArgumentos } from '../../shared/componentes/GrafoDeArgumentos.jsx';
import { BarraDeTiempo } from '../../shared/componentes/foro/BarraDeTiempo.jsx';
import { FranjaDeMetricas } from '../../shared/componentes/foro/FranjaDeMetricas.jsx';
import { ListaDeHilos } from '../../shared/componentes/foro/ListaDeHilos.jsx';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { ORDENES_DE_HILOS, construirHilos, ordenarHilos } from '../../shared/nucleo/conciencia/construirHilos.js';
import { useCuentaAtras } from '../../shared/nucleo/temporizador/useCuentaAtras.js';
import { resolverActividadDelPrograma } from '../../actividades/registroDeActividades.js';
import { ID_FORO_ESCRITO } from '../../actividades/foroEscrito/definicion.js';
import { ListaDeParticipantes } from './ListaDeParticipantes.jsx';

// Cuántos hilos caben legibles desde el fondo del aula.
const HILOS_VISIBLES_EN_PROYECCION = 5;

// Lo que la clase necesita ver del foro desde el fondo del aula: cuánto tiempo queda, cómo va la
// participación y los hilos más activos. Sin sugerencias de la IA, sin aportes ocultos y sin
// ningún control del moderador.
function ProyeccionDelForo({ estado, programa, presencia }) {
  const fase = estado.fase.actual;
  const faseConTiempo = fase?.tipo === TIPOS_DE_FASE.FORO_ESCRITO ? fase : null;
  const cuentaAtras = useCuentaAtras(faseConTiempo);
  const hilos = ordenarHilos(construirHilos(estado), ORDENES_DE_HILOS.RECIENTES).slice(0, HILOS_VISIBLES_EN_PROYECCION);

  return (
    <>
      {programa.preguntaGuia && <p className="cita-de-argumento">{programa.preguntaGuia}</p>}
      {faseConTiempo && (
        <BarraDeTiempo
          restanteMs={cuentaAtras.restanteMs}
          haVencido={cuentaAtras.haVencido}
          enAvisoFinal={cuentaAtras.enAvisoFinal}
        />
      )}
      {fase?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING && !estado.sesion.cerrada && <BarraDeTiempo escrituraCerrada />}
      <FranjaDeMetricas estado={estado} />
      <ListaDeHilos
        hilos={hilos}
        estado={estado}
        presencia={presencia}
        programa={programa}
        mensajeVacio="Todavía no hay posts. ¡Publica el primero!"
      />
      <ListaDeParticipantes estado={estado} presencia={presencia} programa={programa} />
    </>
  );
}

// Lo que la clase necesita ver desde el fondo del aula: quién habla, el argumento destacado, el
// mapa y el marcador. Sin ningún control del moderador. Lo usan las dos formas de proyectar:
// en la misma pestaña del host y en una ventana aparte para el proyector.
//
// La consola normal tiene el grafo y los controles apilados en una sola columna; aquí el mapa
// arranca compacto y crece con el debate (ver calcularAltoDelGrafo).
export function VistaDeProyeccion({ estado, programa, presencia, conexion, botonDeSalida = null }) {
  const esForo = resolverActividadDelPrograma(programa).id === ID_FORO_ESCRITO;

  return (
    <main className="consola-de-sesion modo-proyeccion">
      <div className="barra-superior">
        <h1>{programa.titulo}</h1>
        {botonDeSalida}
      </div>
      <AvisoDeConexion conexion={conexion} />
      {esForo ? (
        <ProyeccionDelForo estado={estado} programa={programa} presencia={presencia} />
      ) : (
        <>
          <DestacadoDelTurno estado={estado} presencia={presencia} programa={programa} enProyeccion />
          <FeedDeActividad estado={estado} presencia={presencia} />
          <GrafoDeArgumentos estado={estado} programa={programa} presencia={presencia} modoProyeccion />
          <ListaDeParticipantes estado={estado} presencia={presencia} programa={programa} />
        </>
      )}
    </main>
  );
}
