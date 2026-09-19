import { useState } from 'react';
import { CapaInstruccional } from '../../shared/componentes/CapaInstruccional.jsx';
import { combinarParticipantesConPresencia } from '../../shared/estado/seleccionesDerivadas.js';

// Deja al moderador ver qué está viendo cualquier participante, para entender en vivo por qué
// alguien está trabado (docs/07). Es estrictamente de lectura: no puede publicar nada en nombre
// de esa persona, y NO muestra lo que está tecleando — el borrador vive solo en su navegador y
// nunca viaja por el canal.
export function VistaEspejoDeParticipante({ estado, presencia, programa }) {
  const [participantIdObservado, setParticipantIdObservado] = useState('');

  const participantes = combinarParticipantesConPresencia(estado, presencia);
  const observado = participantes.find((participante) => participante.participantId === participantIdObservado);
  const postura = observado?.stanceId
    ? programa.posturas.find((unaPostura) => unaPostura.id === observado.stanceId)
    : null;

  return (
    <section className="tarjeta-de-participantes">
      <h3>Ver la pantalla de un participante</h3>
      <p className="texto-de-ayuda">
        Solo lectura: ves lo mismo que esa persona tiene en pantalla, no lo que está escribiendo.
      </p>

      <label>
        Participante
        <select
          value={participantIdObservado}
          onChange={(evento) => setParticipantIdObservado(evento.target.value)}
        >
          <option value="">Elige uno…</option>
          {participantes.map((participante) => (
            <option key={participante.participantId} value={participante.participantId}>
              {participante.emoji} {participante.nombre}
              {participante.rol === 'co_moderador' ? ' (co-moderador)' : ''}
              {participante.ingresoConfirmado ? '' : ' — sin confirmar ingreso'}
            </option>
          ))}
        </select>
      </label>

      {observado && (
        <div className="panel-espejo">
          <p className="texto-de-ayuda">
            {observado.emoji} <strong>{observado.nombre}</strong>
            {postura && (
              <span className="chip-de-postura" style={{ color: postura.color }}>
                {postura.etiqueta}
              </span>
            )}{' '}
            · {observado.puntajeTotal} pts · {observado.intervenciones} intervención(es)
          </p>

          <CapaInstruccional
            estado={estado}
            presencia={presencia}
            participantId={observado.participantId}
            soloLectura
          />

          <ul className="lista-instruccional">
            <li>
              Argumento preparado esperando turno: {observado.argumentoListo ? 'sí' : 'no'}
            </li>
            <li>Posiciones completadas: {observado.posicionesCompletadas}</li>
            <li>
              Turnos rechazados: {observado.turnosRechazadosEnTotal}
              {observado.rechazosAcumulados > 0 && ` (${observado.rechazosAcumulados} seguidos)`}
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
