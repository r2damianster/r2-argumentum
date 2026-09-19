import { useEffect, useRef, useState } from 'react';
import { nombreDeParticipante } from '../estado/seleccionesDerivadas.js';

const SEGUNDOS_DE_ENFASIS = 12;

const ETIQUETA_DE_TIPO = {
  nuevo: 'Argumento nuevo',
  contraargumento: 'Contraargumento',
  refuerzo: 'Refuerzo',
  dilema: 'Dilema',
  pregunta: 'Pregunta',
  concesion: 'Concesión',
};

// Cuando alguien recibe la palabra y anuncia el argumento que va a defender, ese texto aparece
// en grande unos segundos para que toda la sala lo tenga claro mientras empieza a hablar, y
// después se retira: queda solo en su tamaño normal dentro del banner de actividad.
//
// No se muestra al recargar la página a mitad de un turno (sería un énfasis fuera de tiempo), y
// quien está hablando no lo necesita ver: `omitirParaParticipanteId` lo deja fuera de su pantalla.
export function DestacadoDelTurno({ estado, presencia, programa, omitirParaParticipanteId = null, enProyeccion = false }) {
  const turnoEnCurso = estado.turnos.turnoEnCurso;
  const presentacion = turnoEnCurso?.presentacion ?? null;
  const turnoAnunciadoAhora = presentacion ? turnoEnCurso.turnId : null;

  const turnosYaDestacadosRef = useRef(new Set(turnoAnunciadoAhora ? [turnoAnunciadoAhora] : []));
  const [turnoDestacado, setTurnoDestacado] = useState(null);

  useEffect(() => {
    if (!turnoAnunciadoAhora || turnosYaDestacadosRef.current.has(turnoAnunciadoAhora)) {
      return undefined;
    }
    turnosYaDestacadosRef.current.add(turnoAnunciadoAhora);
    setTurnoDestacado(turnoAnunciadoAhora);
    const temporizador = setTimeout(() => setTurnoDestacado(null), SEGUNDOS_DE_ENFASIS * 1000);
    return () => clearTimeout(temporizador);
  }, [turnoAnunciadoAhora]);

  const hayQueMostrar =
    turnoDestacado !== null &&
    turnoDestacado === turnoAnunciadoAhora &&
    turnoEnCurso.participantId !== omitirParaParticipanteId;
  if (!hayQueMostrar) {
    return null;
  }

  const postura = programa?.posturas?.find((candidata) => candidata.id === presentacion.stanceId);

  return (
    <div
      className={`destacado-del-turno${enProyeccion ? ' destacado-en-proyeccion' : ''}`}
      style={{ animationDuration: `${SEGUNDOS_DE_ENFASIS}s` }}
      role="status"
      onClick={() => setTurnoDestacado(null)}
      title="Toca para cerrar"
    >
      <p className="destacado-del-turno-autor">
        🗣️ {nombreDeParticipante(presencia, turnoEnCurso.participantId)}
        {presentacion.tipoDeclarado && ` · ${ETIQUETA_DE_TIPO[presentacion.tipoDeclarado] ?? presentacion.tipoDeclarado}`}
        {postura && (
          <span className="chip-de-postura" style={{ color: postura.color }}>
            {postura.etiqueta}
          </span>
        )}
      </p>
      <blockquote className="destacado-del-turno-texto">{presentacion.texto}</blockquote>
    </div>
  );
}
