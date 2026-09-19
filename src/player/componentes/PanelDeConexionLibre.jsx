import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { misArgumentosSinConexionSaliente } from '../../shared/estado/seleccionesDerivadas.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PanelDeConexionLibre({ estado, participantId, publicar }) {
  const [argumentoOrigenId, setArgumentoOrigenId] = useState('');
  const [argumentoDestinoId, setArgumentoDestinoId] = useState('');
  const [tipoDeRelacion, setTipoDeRelacion] = useState(TIPOS_DE_RELACION.REFUERZO);

  const misArgumentosDisponibles = misArgumentosSinConexionSaliente(estado, participantId);
  // Se conecta con argumentos de otras personas: el propio nunca es un destino válido.
  const argumentosDestinoPosibles = Object.values(estado.argumentos).filter(
    (argumento) => argumento.participantId !== participantId
  );

  if (misArgumentosDisponibles.length === 0) {
    return null;
  }

  function manejarEnvio(evento) {
    evento.preventDefault();
    if (!argumentoOrigenId || !argumentoDestinoId) {
      return;
    }
    const yaTieneSalida = estado.argumentos[argumentoOrigenId]?.conexionSalienteId;
    if (yaTieneSalida) {
      return;
    }
    publicar(EVENTOS.CONEXION_CREADA, {
      linkId: generarId('conexion'),
      sourceArgumentId: argumentoOrigenId,
      targetArgumentId: argumentoDestinoId,
      tipoDeRelacion,
      porParticipanteId: participantId,
    });
    setArgumentoOrigenId('');
    setArgumentoDestinoId('');
  }

  return (
    <section className="tarjeta-de-conexion-libre">
      <p className="texto-de-ayuda">Conectar uno de tus argumentos con el de otro participante</p>
      <form onSubmit={manejarEnvio}>
        <label>
          Tu argumento
          <select value={argumentoOrigenId} onChange={(evento) => setArgumentoOrigenId(evento.target.value)}>
            <option value="">Elige uno…</option>
            {misArgumentosDisponibles.map((argumento) => (
              <option key={argumento.argumentId} value={argumento.argumentId}>
                {argumento.texto.slice(0, 50)}…
              </option>
            ))}
          </select>
        </label>
        <label>
          Se conecta con
          <select value={argumentoDestinoId} onChange={(evento) => setArgumentoDestinoId(evento.target.value)}>
            <option value="">Elige uno…</option>
            {argumentosDestinoPosibles.map((argumento) => (
              <option key={argumento.argumentId} value={argumento.argumentId}>
                {argumento.texto.slice(0, 50)}…
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de relación
          <select value={tipoDeRelacion} onChange={(evento) => setTipoDeRelacion(evento.target.value)}>
            <option value={TIPOS_DE_RELACION.REFUERZO}>Refuerzo</option>
            <option value={TIPOS_DE_RELACION.CONTRAARGUMENTO}>Contraargumento</option>
            <option value={TIPOS_DE_RELACION.DILEMA}>Dilema</option>
            <option value={TIPOS_DE_RELACION.CONEXION}>Conexión</option>
          </select>
        </label>
        <button type="submit">Conectar</button>
      </form>
    </section>
  );
}
