import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { obtenerSugerenciasVisiblesParaParticipante } from '../../shared/estado/seleccionesDerivadas.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PanelDeSugerencias({ estado, participantId, publicar }) {
  const sugerencias = obtenerSugerenciasVisiblesParaParticipante(estado, participantId);

  if (sugerencias.length === 0) {
    return null;
  }

  function aceptar(sugerencia) {
    publicar(EVENTOS.SUGERENCIA_RESUELTA, {
      suggestionId: sugerencia.suggestionId,
      resolucion: 'aceptada',
      porParticipanteId: participantId,
    });
    publicar(EVENTOS.CONEXION_CREADA, {
      linkId: generarId('conexion'),
      sourceArgumentId: sugerencia.sourceArgumentId,
      targetArgumentId: sugerencia.targetArgumentId,
      tipoDeRelacion: sugerencia.tipoDeRelacion,
      porParticipanteId: participantId,
    });
  }

  function rechazar(sugerencia) {
    publicar(EVENTOS.SUGERENCIA_RESUELTA, {
      suggestionId: sugerencia.suggestionId,
      resolucion: 'rechazada_reconectada',
      porParticipanteId: participantId,
    });
  }

  return (
    <section className="tarjeta-de-sugerencias">
      <p className="texto-de-ayuda">Groq sugiere estas conexiones</p>
      <ul className="lista-de-sugerencias">
        {sugerencias.map((sugerencia) => (
          <li key={sugerencia.suggestionId}>
            <p>
              {estado.argumentos[sugerencia.sourceArgumentId]?.texto?.slice(0, 40)}… → {sugerencia.tipoDeRelacion} →{' '}
              {estado.argumentos[sugerencia.targetArgumentId]?.texto?.slice(0, 40)}…
            </p>
            <p className="texto-de-ayuda">Confianza: {Math.round((sugerencia.confianza ?? 0) * 100)}%</p>
            <div className="botonera-de-bid">
              <button type="button" onClick={() => aceptar(sugerencia)}>
                Aceptar
              </button>
              <button type="button" className="boton-cambiar-programa" onClick={() => rechazar(sugerencia)}>
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
