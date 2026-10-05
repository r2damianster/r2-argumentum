import { useState } from 'react';
import {
  ESCALA_DE_NIVELES,
  calcularNotaDeRubrica,
  etiquetaDelNivel,
  rubricaEstaCompleta,
} from '../../../shared/nucleo/rubrica/rubrica.js';
import {
  ESTADOS_DE_CALIFICACION,
  datosDeCalificacionDesdeSugerencia,
} from '../../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { DECISIONES_DE_CONFIRMACION } from '../../../shared/eventos/nombresDeEventos.js';
import { MarcasDeIntegridadDeUnaEntrega } from './MarcasDeIntegridadDeUnaEntrega.jsx';

// Una entrega, a ciegas: el docente ve el texto y la rúbrica sin saber de quién es. La identidad se
// revela solo al aprobar. La nota que sale de los niveles es solo para él (docs/14-control-de-lectura.md).
export function CalificadorDeEntrega({
  item,
  rubrica,
  nombreDelAutor,
  guardando,
  estadoDeLaSugerencia = null,
  integridad = null,
  alDecidirIntegridad,
  puedeDevolver = true,
  alGuardar,
  alDevolver,
  alResolverDesacuerdo,
  alReintentarSugerencia,
  sugerenciaPorDemanda = false,
  alPedirSugerencia,
}) {
  const calificacionInicial = item.calificacion;
  const [niveles, setNiveles] = useState(() => calificacionInicial?.niveles ?? {});
  const [comentarios, setComentarios] = useState(() => calificacionInicial?.comentariosPorCriterio ?? {});
  const [comentarioGeneral, setComentarioGeneral] = useState(() => calificacionInicial?.comentarioGeneral ?? '');

  const aprobada = item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA;
  const completa = rubricaEstaCompleta(rubrica, niveles);
  const notaVigente = calcularNotaDeRubrica(rubrica, niveles);
  const desacuerdoPorResolver = item.confirmacion?.decision === DECISIONES_DE_CONFIRMACION.EN_DESACUERDO && !item.reconsideracion;

  function datosDeLaCalificacion(aprobar) {
    return { niveles, comentariosPorCriterio: comentarios, comentarioGeneral, aprobada: aprobar };
  }

  // La sugerencia solo llena el formulario cuando el docente lo pide: nunca pisa lo que ya escribió.
  function usarLaSugerencia() {
    const datos = datosDeCalificacionDesdeSugerencia(item.sugerencia, { aprobada: false });
    setNiveles(datos.niveles);
    setComentarios(datos.comentariosPorCriterio);
    setComentarioGeneral(datos.comentarioGeneral);
  }

  return (
    <section className="calificador-de-entrega">
      <header className="encabezado-del-calificador">
        <h3>{item.etiqueta}</h3>
        <p className="texto-de-ayuda">
          {item.palabras} palabras · {item.parrafos} párrafo(s)
          {item.enviadaPorTiempo ? ' · enviada al terminar el tiempo' : ''}
        </p>
      </header>

      {aprobada ? (
        <p className="autor-revelado">
          Autor: <strong>{nombreDelAutor}</strong> · Nota: <strong>{item.nota}</strong> / 10 (solo la ves tú)
          {item.descuentoDeIntegridad > 0 && (
            <span className="texto-de-ayuda">
              {' '}
              · rúbrica {item.notaDeLaRubrica} menos {item.descuentoDeIntegridad} por integridad
            </span>
          )}
        </p>
      ) : (
        <p className="texto-de-ayuda">El autor se revela cuando apruebes la calificación.</p>
      )}

      {item.textoPendiente ? (
        <p className="texto-de-ayuda">Todavía no llegó el texto de esta entrega: espera unos segundos.</p>
      ) : (
        <blockquote className="cita-de-argumento texto-de-la-entrega">{item.texto}</blockquote>
      )}

      {integridad && (
        <MarcasDeIntegridadDeUnaEntrega
          key={`integridad-${item.participantId}`}
          integridad={integridad}
          decision={item.decisionDeIntegridad}
          descuentoAutomatico={item.descuentoAutomatico}
          guardando={guardando}
          alDecidir={alDecidirIntegridad}
        />
      )}

      {sugerenciaPorDemanda && !item.sugerencia && !estadoDeLaSugerencia && !item.sugerenciaOmitida && !item.textoPendiente && (
        <p className="texto-de-ayuda">
          <button type="button" className="boton-secundario" onClick={alPedirSugerencia}>
            ✨ Pedir sugerencia de la IA para esta entrega
          </button>
        </p>
      )}

      {(item.sugerencia || estadoDeLaSugerencia || item.sugerenciaOmitida) && (
        <div className="sugerencia-de-la-ia">
          <p>
            <strong>✨ Sugerencia de la IA</strong>{' '}
            <span className="texto-de-ayuda">
              · orientativa, anónima y solo para ti
              {item.sugerencia?.confianza !== null && item.sugerencia?.confianza !== undefined
                ? ` · confianza ${Math.round(item.sugerencia.confianza * 100)} %`
                : ''}
            </span>
          </p>
          {estadoDeLaSugerencia === 'en_curso' && <p className="texto-de-ayuda">Consultando…</p>}
          {estadoDeLaSugerencia === 'en_espera' && (
            <p className="texto-de-ayuda">En espera: la IA alcanzó su límite por minuto. La sugerencia llegará sola; mientras tanto puedes calificar a mano.</p>
          )}
          {estadoDeLaSugerencia === 'fallo' && (
            <p className="texto-de-ayuda">
              No se pudo obtener la sugerencia. Puedes calificar a mano.{' '}
              <button type="button" className="boton-secundario" onClick={alReintentarSugerencia}>
                Reintentar
              </button>
            </p>
          )}
          {item.sugerenciaOmitida === 'texto_muy_corto' && (
            <p className="texto-de-ayuda">El texto es muy corto para sugerir una calificación.</p>
          )}
          {item.sugerencia && (
            <>
              <ul className="niveles-sugeridos">
                {rubrica.map((criterio) => (
                  <li key={criterio.id}>
                    {criterio.nombre}:{' '}
                    <strong>{item.sugerencia.niveles[criterio.id] ? etiquetaDelNivel(item.sugerencia.niveles[criterio.id]) : '—'}</strong>
                  </li>
                ))}
              </ul>
              {item.sugerencia.partesDetectadas.length > 0 && (
                <p className="texto-de-ayuda">
                  Partes de la estructura:{' '}
                  {item.sugerencia.partesDetectadas.map((parte) => `${parte.presente ? '✔' : '✘'} ${parte.nombre}`).join(' · ')}
                </p>
              )}
              {item.sugerencia.comentarioGeneral && <p className="texto-de-ayuda">{item.sugerencia.comentarioGeneral}</p>}
              <div className="botonera-de-bid">
                <button type="button" className="boton-secundario" onClick={usarLaSugerencia}>
                  Usar la sugerencia como punto de partida
                </button>
                {item.sugerencia.completa && !aprobada && (
                  <button
                    type="button"
                    className="boton-exito"
                    disabled={guardando || item.textoPendiente}
                    onClick={() => alGuardar(datosDeCalificacionDesdeSugerencia(item.sugerencia, { aprobada: true }))}
                  >
                    ✅ Aprobar tal cual
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <ul className="criterios-del-calificador">
        {rubrica.map((criterio) => (
          <li key={criterio.id}>
            <p>
              <strong>{criterio.nombre}</strong> <span className="texto-de-ayuda">· peso {criterio.peso}</span>
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
              Comentario para el estudiante
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
        Comentario general
        <textarea rows={3} value={comentarioGeneral} onChange={(evento) => setComentarioGeneral(evento.target.value)} />
      </label>

      <p className="nota-vigente">
        Nota con lo marcado: <strong>{notaVigente === null ? '—' : notaVigente}</strong> / 10{' '}
        {!completa && <span className="texto-de-ayuda">· marca un nivel en cada criterio para poder aprobar</span>}
      </p>

      <div className="botonera-de-bid">
        {!aprobada && (
          <button type="button" className="boton-secundario" disabled={guardando} onClick={() => alGuardar(datosDeLaCalificacion(false))}>
            Guardar borrador
          </button>
        )}
        <button
          type="button"
          className="boton-exito"
          disabled={guardando || !completa || item.textoPendiente}
          onClick={() => alGuardar(datosDeLaCalificacion(true))}
        >
          {aprobada ? 'Guardar cambios' : '✅ Aprobar y ver autor'}
        </button>
        {aprobada && !item.devuelta && (
          <button type="button" className="boton-primario" disabled={guardando || !puedeDevolver} onClick={alDevolver}>
            📤 Devolver al estudiante
          </button>
        )}
      </div>
      {aprobada && item.devuelta && (
        <p className="texto-de-ayuda">
          Devuelta
          {item.confirmacion
            ? item.confirmacion.decision === DECISIONES_DE_CONFIRMACION.DE_ACUERDO
              ? ' · el estudiante está de acuerdo'
              : item.confirmacion.decision === DECISIONES_DE_CONFIRMACION.AUTOMATICA
                ? ' · confirmada sola (no respondió)'
                : ' · el estudiante no está de acuerdo'
            : ' · esperando su respuesta'}
          .
        </p>
      )}

      {desacuerdoPorResolver && (
        <div className="aviso-de-validacion desacuerdo-por-resolver">
          <p>
            <strong>El estudiante no está de acuerdo.</strong>
          </p>
          <blockquote className="cita-de-argumento">{item.motivoDeDesacuerdo || 'No escribió un motivo.'}</blockquote>
          <p className="texto-de-ayuda">Reconsideras una sola vez. Si cambias algo arriba, usa «Cambiar y responder».</p>
          <div className="botonera-de-bid">
            <button type="button" className="boton-secundario" disabled={guardando} onClick={() => alResolverDesacuerdo({ resultado: 'mantiene' })}>
              Mantener y responder
            </button>
            <button
              type="button"
              className="boton-primario"
              disabled={guardando || !completa}
              onClick={() => alResolverDesacuerdo({ resultado: 'cambia', calificacion: datosDeLaCalificacion(true) })}
            >
              Cambiar y responder
            </button>
          </div>
        </div>
      )}
      {item.reconsideracion && (
        <p className="texto-de-ayuda">
          Ya reconsideraste este caso ({item.reconsideracion.resultado === 'cambia' ? 'cambiaste la calificación' : 'la mantuviste'}).
        </p>
      )}
    </section>
  );
}
