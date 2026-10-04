import { nombreDeParticipante } from '../../../shared/estado/seleccionesDerivadas.js';
import {
  calcularMetricasDeParticipacion,
  listarPostsSinDebatir,
  listarRespuestasPendientesParaParticipante,
} from '../../../shared/nucleo/conciencia/calcularMetricasDeParticipacion.js';

const MAXIMO_DE_POSTS_SIN_DEBATIR_VISIBLES = 3;

// Lo que ayuda a que el foro sea un debate y no una pared de monólogos: invita a publicar el
// primer post, destaca lo que nadie ha respondido y avisa a quien le respondieron. Son empujones,
// no asignaciones: nadie está obligado a responder a algo en particular.
export function AvisosDelForo({ estado, presencia, programa, participantId, escrituraAbierta, onResponderA }) {
  const metricas = calcularMetricasDeParticipacion(estado);
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;

  const respuestasPendientes = listarRespuestasPendientesParaParticipante(estado, participantId);
  const postsSinDebatir = listarPostsSinDebatir(estado, {
    posturaDeQuienPregunta: stanceId,
    participantIdDeQuienPregunta: participantId,
  }).slice(0, MAXIMO_DE_POSTS_SIN_DEBATIR_VISIBLES);

  const etiquetaDePostura = (aporte) => programa.posturas.find((postura) => postura.id === aporte.stanceId)?.etiqueta;

  if (metricas.totalDePosts === 0 && escrituraAbierta) {
    return (
      <div className="aviso-del-foro">
        <p>
          <strong>Aún no hay posts.</strong> Publica el primero: tu postura y la razón que la sostiene.
        </p>
      </div>
    );
  }

  return (
    <>
      {respuestasPendientes.length > 0 && escrituraAbierta && (
        <div className="aviso-del-foro">
          <p>
            <strong>Te respondieron ({respuestasPendientes.length}).</strong> Contestar convierte un foro en un debate.
          </p>
          {respuestasPendientes.map((respuesta) => (
            <p key={respuesta.argumentId}>
              {nombreDeParticipante(presencia, respuesta.participantId)}: «{respuesta.texto.slice(0, 80)}…»{' '}
              <button type="button" className="boton-secundario" onClick={() => onResponderA(respuesta)}>
                Contestar
              </button>
            </p>
          ))}
        </div>
      )}

      {postsSinDebatir.length > 0 && escrituraAbierta && (
        <div className="aviso-del-foro">
          <p>
            <strong>
              Hay {metricas.postsSinDebatir} post(s) sin debatir.
            </strong>{' '}
            Nadie les ha respondido todavía:
          </p>
          {postsSinDebatir.map((post) => (
            <p key={post.argumentId}>
              {nombreDeParticipante(presencia, post.participantId)}
              {etiquetaDePostura(post) ? ` (${etiquetaDePostura(post)})` : ''}, hace {post.minutosEsperando} min:
              «{post.texto.slice(0, 80)}…»{' '}
              <button type="button" className="boton-secundario" onClick={() => onResponderA(post)}>
                Responder
              </button>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
