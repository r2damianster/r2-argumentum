import { useState } from 'react';
import { DECISIONES_DE_CONFIRMACION, EVENTOS } from '../../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../../shared/nucleo/entregas/canalesPrivados.js';
import { useCuentaAtras } from '../../../shared/nucleo/temporizador/useCuentaAtras.js';
import { formatearCuentaAtras } from '../../../shared/nucleo/temporizador/calcularTiempoRestante.js';

const MINIMO_DE_CARACTERES_DEL_MOTIVO = 8;

const TEXTO_DE_LA_RESPUESTA = {
  [DECISIONES_DE_CONFIRMACION.DE_ACUERDO]: 'Respondiste que estás de acuerdo.',
  [DECISIONES_DE_CONFIRMACION.EN_DESACUERDO]: 'Respondiste que no estás de acuerdo: tu docente revisará tu caso.',
  [DECISIONES_DE_CONFIRMACION.AUTOMATICA]: 'No respondiste a tiempo: tu entrega se confirmó sola.',
};

// La devolución del docente: comentarios por cada criterio y un comentario general. NUNCA la nota (ver
// docs/14-control-de-lectura.md). La persona responde «de acuerdo» o «no estoy de acuerdo» (con un
// motivo) dentro de una ventana; si no responde, la entrega se confirma sola.
export function TarjetaDeDevolucion({ estado, participantId, devolucion, publicar, publicarEntregaPrivada }) {
  const entrega = estado.lectura?.entregas?.[participantId] ?? null;
  const [mostrandoDesacuerdo, setMostrandoDesacuerdo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const ventana = entrega?.devueltaEn && entrega?.confirmaHasta
    ? {
        iniciadaEn: entrega.devueltaEn,
        duracionMin: Math.max((entrega.confirmaHasta - entrega.devueltaEn) / 60000, 0.01),
        extensionesMin: 0,
      }
    : null;
  const cuentaAtras = useCuentaAtras(ventana);

  if (!entrega?.devueltaEn) {
    return null;
  }

  async function responder(decision) {
    setEnviando(true);
    setError('');
    try {
      await publicarEntregaPrivada(EVENTOS_PRIVADOS.ENTREGA_CONFIRMACION, {
        decision,
        motivo: decision === DECISIONES_DE_CONFIRMACION.EN_DESACUERDO ? motivo.trim() : '',
      });
      publicar(EVENTOS.LECTURA_CONFIRMADA, { participantId, decision });
    } catch (fallo) {
      console.warn('[r2-argumentum] no se pudo enviar la respuesta', fallo);
      setError('No se pudo enviar tu respuesta. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      setEnviando(false);
    }
  }

  const respuesta = entrega.confirmacion;
  const puedeResponder = !respuesta && !cuentaAtras.haVencido;
  const motivoSuficiente = motivo.trim().length >= MINIMO_DE_CARACTERES_DEL_MOTIVO;

  return (
    <section className="tarjeta-de-devolucion">
      <h3>📝 La devolución de tu docente</h3>
      {devolucion?.revisada && <p className="texto-de-ayuda">Tu docente revisó tu caso: estos son los comentarios actualizados.</p>}

      {!devolucion ? (
        <p className="texto-de-ayuda">Cargando los comentarios…</p>
      ) : (
        <>
          {devolucion.criterios.length === 0 && !devolucion.comentarioGeneral && (
            <p className="texto-de-ayuda">Tu docente no dejó comentarios escritos.</p>
          )}
          <ul className="comentarios-por-criterio">
            {devolucion.criterios.map((criterio) => (
              <li key={criterio.criterioId}>
                <strong>{criterio.nombre}</strong>
                <p>{criterio.comentario}</p>
              </li>
            ))}
          </ul>
          {devolucion.comentarioGeneral && (
            <div className="comentario-general-de-la-devolucion">
              <strong>Comentario general</strong>
              <p>{devolucion.comentarioGeneral}</p>
            </div>
          )}
          {(devolucion.revisionesDePares ?? []).map((revision, indice) => (
            <div key={indice} className="comentario-de-un-par">
              <strong>{(devolucion.revisionesDePares ?? []).length > 1 ? `Comentarios de un compañero (${indice + 1})` : 'Comentarios de un compañero'}</strong>
              <span className="texto-de-ayuda"> · anónimo, revisado por tu docente</span>
              <ul className="comentarios-por-criterio">
                {revision.criterios.map((criterio) => (
                  <li key={criterio.criterioId}>
                    <strong>{criterio.nombre}</strong>
                    <p>{criterio.comentario}</p>
                  </li>
                ))}
              </ul>
              {revision.comentarioGeneral && <p>{revision.comentarioGeneral}</p>}
            </div>
          ))}
        </>
      )}

      {respuesta && <p className="texto-de-ayuda">{TEXTO_DE_LA_RESPUESTA[respuesta.decision]}</p>}

      {puedeResponder && (
        <div className="respuesta-a-la-devolucion">
          <p className="texto-de-ayuda">
            ⏱️ Te quedan {formatearCuentaAtras(cuentaAtras.restanteMs)} para responder. Si no respondes, tu entrega se confirma
            sola.
          </p>
          {error && <p className="mensaje-de-error">{error}</p>}
          {!mostrandoDesacuerdo ? (
            <div className="botonera-de-bid">
              <button
                type="button"
                className="boton-exito"
                disabled={enviando || !devolucion}
                onClick={() => responder(DECISIONES_DE_CONFIRMACION.DE_ACUERDO)}
              >
                {enviando ? 'Enviando…' : '👍 De acuerdo'}
              </button>
              {!devolucion?.revisada && (
                <button type="button" className="boton-secundario" disabled={enviando} onClick={() => setMostrandoDesacuerdo(true)}>
                  No estoy de acuerdo
                </button>
              )}
            </div>
          ) : (
            <div className="desacuerdo-con-la-devolucion">
              <label>
                ¿Qué no te convence? (lo lee solo tu docente)
                <textarea value={motivo} rows={4} onChange={(evento) => setMotivo(evento.target.value)} />
              </label>
              <div className="botonera-de-bid">
                <button
                  type="button"
                  className="boton-primario"
                  disabled={enviando || !motivoSuficiente}
                  onClick={() => responder(DECISIONES_DE_CONFIRMACION.EN_DESACUERDO)}
                >
                  {enviando ? 'Enviando…' : 'Enviar mi desacuerdo'}
                </button>
                <button type="button" className="boton-secundario" disabled={enviando} onClick={() => setMostrandoDesacuerdo(false)}>
                  Volver
                </button>
              </div>
              {!motivoSuficiente && <p className="texto-de-ayuda">Cuéntale a tu docente, en pocas palabras, qué no te convence.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
