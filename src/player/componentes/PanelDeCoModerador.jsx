import { EVENTOS, TIPOS_DE_BID } from '../../shared/eventos/nombresDeEventos.js';
import {
  obtenerBidsAbiertos,
  obtenerExposicionesSinCalificar,
  obtenerIntervencionesSinCalificar,
} from '../../shared/estado/seleccionesDerivadas.js';
import {
  CALIDADES_EN_ORDEN_DE_BOTONES,
  ETIQUETA_DE_CALIDAD_DE_EXPOSICION,
} from '../../shared/puntaje/etiquetasDeExposicion.js';

export function PanelDeCoModerador({ estado, presencia, participantId, publicar }) {
  // Juez y parte no: lo propio queda fuera de la cola (ver seleccionesDerivadas.js).
  const bidsAbiertos = obtenerBidsAbiertos(estado).filter((bid) => bid.participantId !== participantId);
  const intervencionesSinCalificar = obtenerIntervencionesSinCalificar(estado, {
    excluirParticipantId: participantId,
  });

  const exposicionesSinCalificar = obtenerExposicionesSinCalificar(estado, {
    coModeradorId: participantId,
    excluirParticipantId: participantId,
  });

  function calificarExposicion(argumentId, calidad) {
    publicar(EVENTOS.EXPOSICION_CALIFICADA, { argumentId, coModeradorId: participantId, calidad });
  }

  function votar(bidId, voto) {
    publicar(EVENTOS.BID_VOTO_COMODERADOR, { bidId, coModeradorId: participantId, voto });
  }

  function calificarIntervencion(intervencionId, calidad) {
    publicar(EVENTOS.INTERVENCION_VERBAL_CALIFICADA, { intervencionId, coModeradorId: participantId, calidad });
  }

  function nombreDe(otroParticipantId) {
    return presencia?.find((presente) => presente.participantId === otroParticipantId)?.nombre ?? 'Alguien';
  }

  return (
    <section className="tarjeta-de-co-moderador">
      <h3>Panel de co-moderador</h3>

      {exposicionesSinCalificar.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Exposiciones por calificar — ¿está hablando? ¿Lo que dice es coherente con el debate y con el punto al
            que responde? Juzga la exposición, no si estás de acuerdo. Tu nota se promedia con la de los demás
            co-moderadores y el moderador la revisa al cierre.
          </p>
          <ul className="lista-de-validaciones-pendientes">
            {exposicionesSinCalificar.map((exposicion) => {
              const argumento = estado.argumentos[exposicion.argumentId];
              const argumentoAlQueResponde = estado.argumentos[argumento?.argumentoObjetivoId];
              return (
                <li key={exposicion.argumentId}>
                  <p>
                    <strong>{nombreDe(exposicion.participantId)}</strong>{' '}
                    {exposicion.estado === 'en_curso' ? '🎙️ está hablando ahora' : 'ya terminó de exponer'}
                  </p>
                  {argumento && (
                    <div className="vista-previa-argumento-completo">
                      <header>
                        <span>Argumento expuesto</span>
                      </header>
                      <p className="vista-previa-argumento-texto">“{argumento.texto}”</p>
                    </div>
                  )}
                  {argumentoAlQueResponde && (
                    <>
                      <p className="texto-de-ayuda">
                        Responde a: “{argumentoAlQueResponde.texto.slice(0, 90)}…”
                      </p>
                      <div className="vista-previa-argumento-completo">
                        <header>
                          <span>Responde al argumento</span>
                        </header>
                        <p className="vista-previa-argumento-texto">“{argumentoAlQueResponde.texto}”</p>
                      </div>
                    </>
                  )}
                  <div className="botonera-de-bid">
                    {CALIDADES_EN_ORDEN_DE_BOTONES.map((calidad) => (
                      <button
                        key={calidad}
                        type="button"
                        className={
                          calidad === 'excelente' || calidad === 'buena'
                            ? 'boton-exito'
                            : calidad === 'aceptable'
                            ? 'boton-secundario'
                            : 'boton-peligro'
                        }
                        onClick={() => calificarExposicion(exposicion.argumentId, calidad)}
                      >
                        {ETIQUETA_DE_CALIDAD_DE_EXPOSICION[calidad]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {bidsAbiertos.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Evalúa el argumento, no la postura — tu voto es anónimo, nadie ve quién votó qué (ni el moderador).
          </p>
          <p className="texto-de-ayuda">Bids abiertos — vota aprobar o rechazar</p>
          <ul className="lista-de-bids-pendientes">
            {bidsAbiertos.map((bid) => (
              <li key={bid.bidId}>
                <div className="vista-previa-argumento-completo">
                  <header>
                    <span>{bid.tipoDeBid === TIPOS_DE_BID.DESMONTAR ? '💥 Bid: Desmontar' : '💪 Bid: Fortalecer'}</span>
                  </header>
                  <p className="vista-previa-argumento-texto">"{bid.texto}"</p>
                </div>
                <div className="botonera-de-bid">
                  <button type="button" className="boton-exito" onClick={() => votar(bid.bidId, 'aprueba')}>
                    Aprueba
                  </button>
                  <button type="button" className="boton-peligro" onClick={() => votar(bid.bidId, 'rechaza')}>
                    Rechaza
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {intervencionesSinCalificar.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Intervenciones habladas por calificar — juzga si aportó una razón, no si estás de acuerdo.
          </p>
          <ul className="lista-de-validaciones-pendientes">
            {intervencionesSinCalificar.map((intervencion) => (
              <li key={intervencion.intervencionId}>
                <p>
                  <strong>{nombreDe(intervencion.participantId)}</strong> intervino sin argumento escrito.
                </p>
                {intervencion.resumen && <p className="texto-de-ayuda">“{intervencion.resumen}”</p>}
                <div className="botonera-de-bid">
                  <button
                    type="button"
                    className="boton-exito"
                    onClick={() => calificarIntervencion(intervencion.intervencionId, 'buena')}
                  >
                    Aportó una razón
                  </button>
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => calificarIntervencion(intervencion.intervencionId, 'aceptable')}
                  >
                    Aceptable
                  </button>
                  <button
                    type="button"
                    className="boton-peligro"
                    onClick={() => calificarIntervencion(intervencion.intervencionId, 'insuficiente')}
                  >
                    Solo opinión
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bidsAbiertos.length === 0 &&
        intervencionesSinCalificar.length === 0 &&
        exposicionesSinCalificar.length === 0 && (
        <p className="texto-de-ayuda">Nada pendiente por ahora.</p>
      )}
    </section>
  );
}
