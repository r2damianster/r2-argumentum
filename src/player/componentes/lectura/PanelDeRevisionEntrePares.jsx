import { useState } from 'react';
import { EVENTOS, TIPOS_DE_FASE } from '../../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../../shared/nucleo/entregas/canalesPrivados.js';
import { perfilDeAhorro } from '../../../shared/nucleo/capacidad/modosDeAhorro.js';
import { ESCALA_DE_NIVELES, resolverRubricaDelPrograma, rubricaEstaCompleta } from '../../../shared/nucleo/rubrica/rubrica.js';
import { useCuentaAtras } from '../../../shared/nucleo/temporizador/useCuentaAtras.js';
import { BarraDeTiempo } from '../../../shared/componentes/foro/BarraDeTiempo.jsx';

// Revisar el texto de un compañero: sin saber de quién es (y él tampoco sabe quién lo revisa), con la
// misma rúbrica que usa el docente. El comentario llega al autor solo si el docente lo aprueba.
function RevisionDeUnTexto({ revision, rubrica, yaEnviada, puedeEnviar, alEnviar }) {
  const [niveles, setNiveles] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentarioGeneral, setComentarioGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const completa = rubricaEstaCompleta(rubrica, niveles);

  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      await alEnviar({ indice: revision.indice, niveles, comentariosPorCriterio: comentarios, comentarioGeneral });
    } catch (fallo) {
      console.warn('[r2-argumentum] no se pudo enviar la revisión', fallo);
      setError('No se pudo enviar. Revisa tu conexión y vuelve a intentarlo: tu revisión sigue aquí.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="revision-de-un-texto">
      <h4>Texto {revision.indice + 1}</h4>
      <blockquote className="cita-de-argumento texto-entregado">{revision.texto || 'Este texto todavía no llegó.'}</blockquote>

      {yaEnviada ? (
        <p>✅ Enviaste tu revisión de este texto.</p>
      ) : !puedeEnviar ? (
        <p className="texto-de-ayuda">El tiempo de revisión terminó y no enviaste esta revisión.</p>
      ) : (
        <>
          <ul className="criterios-del-calificador">
            {rubrica.map((criterio) => (
              <li key={criterio.id}>
                <p>
                  <strong>{criterio.nombre}</strong>
                  {criterio.descripcion && (
                    <>
                      <br />
                      <span className="texto-de-ayuda">{criterio.descripcion}</span>
                    </>
                  )}
                </p>
                <div className="niveles-de-la-rubrica" role="radiogroup" aria-label={criterio.nombre}>
                  {ESCALA_DE_NIVELES.map((nivel) => (
                    <button
                      key={nivel.id}
                      type="button"
                      role="radio"
                      aria-checked={niveles[criterio.id] === nivel.id}
                      className={niveles[criterio.id] === nivel.id ? 'nivel-de-rubrica nivel-de-rubrica--elegido' : 'nivel-de-rubrica'}
                      onClick={() => setNiveles((actuales) => ({ ...actuales, [criterio.id]: nivel.id }))}
                    >
                      {nivel.etiqueta}
                    </button>
                  ))}
                </div>
                <label>
                  Comentario para tu compañero (opcional)
                  <textarea
                    rows={2}
                    value={comentarios[criterio.id] ?? ''}
                    onChange={(evento) => setComentarios((actuales) => ({ ...actuales, [criterio.id]: evento.target.value }))}
                  />
                </label>
              </li>
            ))}
          </ul>
          <label>
            Comentario general (opcional)
            <textarea rows={3} value={comentarioGeneral} onChange={(evento) => setComentarioGeneral(evento.target.value)} />
          </label>
          {error && <p className="mensaje-de-error">{error}</p>}
          {!completa && <p className="texto-de-ayuda">Marca un nivel en cada criterio para poder enviar.</p>}
          <div className="botonera-de-bid">
            <button type="button" className="boton-primario" disabled={enviando || !completa || !revision.texto} onClick={enviar}>
              {enviando ? 'Enviando…' : 'Enviar esta revisión'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// La fase de revisión entre pares vista por quien revisa (docs/14-control-de-lectura.md).
export function PanelDeRevisionEntrePares({ estado, programa, participantId, revisionAsignada, publicar, publicarEntregaPrivada }) {
  const fase = estado.fase.actual?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES ? estado.fase.actual : null;
  const cuentaAtras = useCuentaAtras(fase);
  const rubrica = resolverRubricaDelPrograma(programa);
  const entrego = Boolean(estado.lectura?.entregas?.[participantId]);
  // Las revisiones que esta persona acaba de enviar: si el host anuncia en lote, la sala lo sabe unos segundos después.
  const [enviadasLocalmente, setEnviadasLocalmente] = useState({});
  const enviadas = { ...enviadasLocalmente, ...(estado.lectura?.revisiones?.[participantId] ?? {}) };
  const faseAbierta = Boolean(fase) && !cuentaAtras.haVencido && !estado.sesion.cerrada;

  if (!fase && Object.keys(enviadas).length === 0 && !revisionAsignada) {
    return null;
  }

  async function enviarRevision({ indice, niveles, comentariosPorCriterio, comentarioGeneral }) {
    await publicarEntregaPrivada(EVENTOS_PRIVADOS.ENTREGA_REVISION_PAR, { indice, niveles, comentariosPorCriterio, comentarioGeneral });
    // En los modos «ahorro» y masivo el aviso a la sala lo anuncia el host en lote (anunciosEnLote.js).
    if (perfilDeAhorro({ programa: estado.programa ?? programa, estado }).avisosDeLaLectura === 'sueltos') {
      publicar(EVENTOS.LECTURA_REVISION_ENVIADA, { participantId, indice });
    }
    setEnviadasLocalmente((previas) => ({ ...previas, [indice]: { enviadaEn: Date.now() } }));
  }

  return (
    <section className="panel-de-revision-entre-pares">
      <h3>🔍 Revisión entre pares</h3>
      {fase && <BarraDeTiempo restanteMs={cuentaAtras.restanteMs} haVencido={cuentaAtras.haVencido} enAvisoFinal={cuentaAtras.enAvisoFinal} />}

      {!entrego ? (
        <p className="texto-de-ayuda">No entregaste un texto, así que en esta ronda no revisas.</p>
      ) : !revisionAsignada ? (
        <p className="texto-de-ayuda">Esperando que tu docente reparta los textos. Aparecerán aquí en unos segundos.</p>
      ) : revisionAsignada.revisiones.length === 0 ? (
        <p className="texto-de-ayuda">En esta ronda no te tocó revisar ningún texto (hubo pocas entregas).</p>
      ) : (
        <>
          <p className="texto-de-ayuda">
            Revisa los textos de tus compañeros con la misma rúbrica del docente. Es anónimo: no sabes de quién es cada texto ni
            quién te revisa a ti. Tu docente aprueba los comentarios antes de que lleguen al autor.
          </p>
          {revisionAsignada.revisiones.map((revision) => (
            <RevisionDeUnTexto
              key={revision.indice}
              revision={revision}
              rubrica={rubrica}
              yaEnviada={Boolean(enviadas[revision.indice])}
              puedeEnviar={faseAbierta}
              alEnviar={enviarRevision}
            />
          ))}
        </>
      )}
    </section>
  );
}

// Cómo le fue a quien revisó, explicado sin revelar la nota de nadie: si su criterio coincidió con el del
// docente, criterio por criterio.
export function ResultadoDeTuRevision({ resultado }) {
  if (!resultado) {
    return null;
  }
  return (
    <section className="resultado-de-tu-revision">
      <h3>🔍 Cómo te fue como revisor</h3>
      <p>
        Enviaste {resultado.hechas} de {resultado.asignadas} revisión(es) y sumaste <strong>{resultado.puntos}</strong> punto(s) a tu
        resultado.
      </p>
      <ul className="comentarios-por-criterio">
        {resultado.revisiones.map((revision) => (
          <li key={revision.indice}>
            <strong>Texto {revision.indice + 1}</strong>
            {revision.estado === 'no_enviada' && <p>No enviaste esta revisión.</p>}
            {revision.estado === 'descartada' && <p>Tu docente no tomó en cuenta esta revisión.</p>}
            {revision.estado === 'enviada' && revision.sinReferencia && (
              <p>Todavía no hay una evaluación del docente con la cual comparar tu revisión.</p>
            )}
            {revision.estado === 'enviada' &&
              revision.comparaciones.map((comparacion) => (
                <p key={comparacion.nombre}>
                  {comparacion.nombre}: tu evaluación {comparacion.frase}.
                </p>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
