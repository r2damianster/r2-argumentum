import { nombreDeParticipante } from '../estado/seleccionesDerivadas.js';
import { TIPOS_DE_FASE } from '../eventos/nombresDeEventos.js';

const ETIQUETA_DE_TIPO = {
  nuevo: 'un argumento nuevo',
  contraargumento: 'un contraargumento',
  refuerzo: 'un refuerzo',
  dilema: 'un dilema',
  pregunta: 'una pregunta',
  concesion: 'una concesión',
};

const ETIQUETA_DE_RELACION = {
  refuerzo: 'refuerzo',
  contraargumento: 'contraargumento',
  dilema: 'dilema',
  conexion: 'conexión',
};

// Pantalla proyectable: narra en lenguaje humano quién habla y qué acaba de pasar, en vez
// de mostrar solo datos crudos (ids, timestamps). Pensado para host (proyector) y también
// útil para el participante mientras espera su turno.
export function FeedDeActividad({ estado, presencia }) {
  // En cierre y ranking ya no hay ruleta de turnos: el banner de espera seguía prometiendo un
  // turno que nunca iba a llegar. Bug real reportado en prueba en vivo.
  const hayRuletaDeTurnos =
    !estado.sesion.cerrada && estado.fase.actual?.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS;

  const quienHabla = estado.turnos.turnoEnCurso
    ? nombreDeParticipante(presencia, estado.turnos.turnoEnCurso.participantId)
    : null;
  // El texto que anunció quien tiene la palabra (ver DestacadoDelTurno): tras el énfasis inicial
  // sigue a la vista, en tamaño normal, mientras dure su turno.
  const argumentoQueDefiende = estado.turnos.turnoEnCurso?.presentacion?.texto ?? null;
  const quienFueOfrecido =
    !quienHabla && estado.turnos.ofertaActiva
      ? nombreDeParticipante(presencia, estado.turnos.ofertaActiva.candidateId)
      : null;

  const eventosDeArgumentos = Object.values(estado.argumentos).map((argumento) => ({
    id: `arg-${argumento.argumentId}`,
    timestamp: argumento.timestamp,
    texto: `💬 ${nombreDeParticipante(presencia, argumento.participantId)} agregó ${
      ETIQUETA_DE_TIPO[argumento.tipoDeclarado] || 'un argumento'
    }`,
  }));

  const eventosDeConexiones = Object.values(estado.conexiones).map((conexion) => ({
    id: `link-${conexion.linkId}`,
    timestamp: conexion.timestamp,
    texto: `🔗 ${nombreDeParticipante(presencia, conexion.porParticipanteId)} conectó su argumento (${
      ETIQUETA_DE_RELACION[conexion.tipoDeRelacion] || conexion.tipoDeRelacion
    })`,
  }));

  const actividadReciente = [...eventosDeArgumentos, ...eventosDeConexiones]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6);

  return (
    <section className="tarjeta-de-actividad">
      {hayRuletaDeTurnos && (
        <>
          {quienHabla && <p className="banner-de-turno">🗣️ {quienHabla} está hablando ahora</p>}
          {quienHabla && argumentoQueDefiende && (
            <blockquote className="cita-de-argumento">{argumentoQueDefiende}</blockquote>
          )}
          {quienFueOfrecido && (
            <p className="banner-de-turno banner-de-espera">⏳ Se le ofreció el turno a {quienFueOfrecido}…</p>
          )}
          {!quienHabla && !quienFueOfrecido && (
            <p className="banner-de-turno banner-de-espera">⏳ Esperando que se ofrezca el próximo turno…</p>
          )}
        </>
      )}
      <p className="texto-de-ayuda">Actividad reciente</p>
      <ul className="lista-de-actividad">
        {actividadReciente.length === 0 && <li className="texto-de-ayuda">Todavía no hay actividad.</li>}
        {actividadReciente.map((evento) => (
          <li key={evento.id}>{evento.texto}</li>
        ))}
      </ul>
    </section>
  );
}
