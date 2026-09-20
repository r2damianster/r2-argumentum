import {
  EVENTOS,
  TIPOS_DE_FASE,
  DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION,
} from '../../shared/eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import { calcularNivelPromedioDeExposicion } from '../../shared/puntaje/evaluacionDeExposiciones.js';
import {
  CALIDADES_EN_ORDEN_DE_BOTONES,
  ETIQUETA_DE_CALIDAD_DE_EXPOSICION,
  describirNivelPromedio,
} from '../../shared/puntaje/etiquetasDeExposicion.js';

function describirDecisionDelModerador(decisionModerador) {
  if (!decisionModerador) {
    return 'Sin evaluar: rige el promedio de los co-moderadores.';
  }
  if (decisionModerador.decision === DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.DESCARTADA) {
    return 'Descartaste las calificaciones: esta exposición no ajusta puntos.';
  }
  return `Tu evaluación: ${ETIQUETA_DE_CALIDAD_DE_EXPOSICION[decisionModerador.calidad]}. Manda sobre el promedio.`;
}

// Las calificaciones de las exposiciones (co-moderadores y moderador) no cambian el marcador
// mientras el debate sigue: se aplican una sola vez al cerrar la sesión (docs/05). Aquí el moderador
// puede evaluar cada exposición (opcional, incluso mientras se expone) y, antes de cerrar, revisar
// todas: fijar su propia evaluación, descartar las de los co-moderadores o dejarlas como están.
// Del promedio solo se ve cuántos calificaron y qué salió, nunca quién puso qué.
export function PanelDeEvaluacionDeExposiciones({ estado, presencia, publicar }) {
  const exposiciones = Object.values(estado.exposiciones ?? {}).filter(
    (exposicion) => exposicion.estado === 'en_curso' || exposicion.estado === 'terminada'
  );
  if (exposiciones.length === 0 || estado.sesion.cerrada) {
    return null;
  }

  const hayUnaEnCurso = exposiciones.some((exposicion) => exposicion.estado === 'en_curso');
  const enElCierre = estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING;
  // La que se está diciendo ahora primero; después, las más recientes.
  const ordenadas = [...exposiciones].sort((una, otra) => {
    if (una.estado !== otra.estado) {
      return una.estado === 'en_curso' ? -1 : 1;
    }
    return (otra.terminadaEn ?? 0) - (una.terminadaEn ?? 0);
  });

  function decidir(argumentId, decision, calidad = null) {
    publicar(EVENTOS.EXPOSICION_EVALUADA_POR_MODERADOR, { argumentId, decision, calidad });
  }

  return (
    <section className="tarjeta-de-fase">
      <details open={hayUnaEnCurso || enElCierre}>
        <summary>
          Evaluación de exposiciones ({exposiciones.length}){hayUnaEnCurso ? ' · hay una en curso' : ''}
        </summary>
        <p className="texto-de-ayuda">
          Evaluar es opcional. Tu evaluación manda sobre el promedio de los co-moderadores y define si su
          calificación fue consistente; «Descartar» anula las calificaciones de esa exposición. Los ajustes de
          puntaje se aplican al cerrar el debate: hasta entonces el marcador es provisional.
        </p>
        <ul className="lista-de-validaciones-pendientes">
          {ordenadas.map((exposicion) => {
            const argumento = estado.argumentos[exposicion.argumentId];
            const cantidadDeCalificaciones = Object.keys(exposicion.calificaciones).length;
            const promedio = calcularNivelPromedioDeExposicion(exposicion.calificaciones);
            return (
              <li key={exposicion.argumentId}>
                <p>
                  <strong>{nombreDeParticipante(presencia, exposicion.participantId)}</strong>{' '}
                  {exposicion.estado === 'en_curso' ? '🎙️ está exponiendo ahora' : 'terminó de exponer'}
                </p>
                {argumento && <p className="texto-de-ayuda">“{argumento.texto}”</p>}
                <p className="texto-de-ayuda">
                  Co-moderadores que calificaron: {cantidadDeCalificaciones} — promedio:{' '}
                  {describirNivelPromedio(promedio)}
                </p>
                <p className="texto-de-ayuda">{describirDecisionDelModerador(exposicion.decisionModerador)}</p>
                <div className="botonera-de-bid">
                  {CALIDADES_EN_ORDEN_DE_BOTONES.map((calidad) => (
                    <button
                      key={calidad}
                      type="button"
                      onClick={() =>
                        decidir(exposicion.argumentId, DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.EVALUADA, calidad)
                      }
                    >
                      {ETIQUETA_DE_CALIDAD_DE_EXPOSICION[calidad]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="boton-cambiar-programa"
                    onClick={() => decidir(exposicion.argumentId, DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.DESCARTADA)}
                  >
                    Descartar calificaciones
                  </button>
                  {exposicion.decisionModerador && (
                    <button
                      type="button"
                      className="boton-cambiar-programa"
                      onClick={() => decidir(exposicion.argumentId, DECISIONES_DEL_MODERADOR_SOBRE_EXPOSICION.SIN_EVALUAR)}
                    >
                      Dejar sin evaluar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
