import { useMemo, useState } from 'react';
import { DECISIONES_DE_CONFIRMACION, EVENTOS, TIPOS_DE_FASE } from '../../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../../shared/nucleo/entregas/canalesPrivados.js';
import { contarAvanceDeLasEntregas } from '../../../shared/nucleo/entregas/estadoPublicoDeEntregas.js';
import {
  ESTADOS_DE_CALIFICACION,
  construirColaDelDocente,
  construirDevolucionParaElEstudiante,
  NOTA_MINIMA_PARA_APROBAR_EN_LOTE,
  datosDeCalificacionDesdeSugerencia,
  resumirLaCola,
  seleccionarParaAprobarEnLote,
} from '../../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import {
  DECISIONES_SOBRE_UNA_REVISION,
  calcularPuntosDeRevisores,
  construirResultadoParaUnRevisor,
  construirRevisionesDeUnAutor,
  contarRevisionesPorAprobar,
  listarRevisionesAprobadasParaElAutor,
} from '../../../shared/nucleo/entregas/revisionesEntrePares.js';
import { resolverRubricaDelPrograma } from '../../../shared/nucleo/rubrica/rubrica.js';
import { resolverVentanaDeConfirmacionMin } from '../../../actividades/controlDeLectura/programaDeLectura.js';
import {
  construirCsvDeLectura,
  construirInformeDeLectura,
} from '../../../actividades/controlDeLectura/informeDeLectura.js';
import { descargarComoJSON } from '../../../shared/estado/exportarSesion.js';
import { descargarComoTexto } from '../../../shared/estado/descargarArchivo.js';
import { nombreDeParticipante } from '../../../shared/estado/seleccionesDerivadas.js';
import { PodioDelControlDeLectura } from '../../../shared/componentes/lectura/PodioDelControlDeLectura.jsx';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';
import { ControlDelTiempoDelForo } from '../ControlDelTiempoDelForo.jsx';
import { CalificadorDeEntrega } from './CalificadorDeEntrega.jsx';
import { RevisionesDeParesDeUnaEntrega } from './RevisionesDeParesDeUnaEntrega.jsx';
import { InformeImpresoDeLectura } from './InformeImpresoDeLectura.jsx';
import { construirIntegridadPorEntrega, hayAlgoQueRevisar } from '../../../shared/nucleo/entregas/integridadDeLasEntregas.js';
import { integridadEstaActiva } from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { construirAnexoDeIntegridadDeLectura } from '../../../actividades/controlDeLectura/informeDeLectura.js';
import { useSugerenciasDeCalificacion } from '../../useSugerenciasDeCalificacion.js';
import { perfilDeAhorro } from '../../../shared/nucleo/capacidad/modosDeAhorro.js';
import { useAsignacionDePares } from '../../useAsignacionDePares.js';

const ETIQUETA_DEL_ESTADO = {
  [ESTADOS_DE_CALIFICACION.SIN_CALIFICAR]: 'Sin calificar',
  [ESTADOS_DE_CALIFICACION.BORRADOR]: 'Borrador',
  [ESTADOS_DE_CALIFICACION.APROBADA]: 'Aprobada',
};

function textoDelEstadoDeLaEntrega(item) {
  if (item.confirmacion?.decision === DECISIONES_DE_CONFIRMACION.EN_DESACUERDO) {
    return item.reconsideracion ? 'Reconsiderada' : '⚠️ En desacuerdo';
  }
  if (item.confirmacion) {
    return 'Confirmada';
  }
  if (item.devuelta) {
    return 'Devuelta';
  }
  return ETIQUETA_DEL_ESTADO[item.estadoDeCalificacion];
}

// Panel del docente en el control de lectura (docs/14-control-de-lectura.md): avance de la clase, la cola
// de entregas anónimas, el calificador, la devolución y el cierre. La nota solo existe aquí.
export function PanelDelControlDeLecturaParaElDocente({
  estado,
  presencia,
  programa,
  motor,
  estadoPrivado,
  publicar,
  publicarComoDocente,
  enviarAlEstudiante,
  registrosDeIntegridad = [],
  onElegirOtraActividad,
}) {
  const programaVigente = estado.programa ?? programa;
  const rubrica = useMemo(() => resolverRubricaDelPrograma(programaVigente), [programaVigente]);
  const cola = useMemo(() => construirColaDelDocente({ estadoPrivado, estado, rubrica }), [estadoPrivado, estado, rubrica]);
  const resumen = resumirLaCola(cola);
  // Integridad (activada por defecto): señales de redacción y parecido entre textos. Usa el Programa
  // COMPLETO del host, que trae el texto de referencia (no viaja en el publicado).
  const integridadActiva = integridadEstaActiva(programaVigente);
  const integridadPorEntrega = useMemo(
    () =>
      integridadActiva
        ? construirIntegridadPorEntrega({
            cola,
            registrosDeIntegridad,
            programa: { ...programaVigente, textoDeReferencia: programa.textoDeReferencia },
          })
        : {},
    [integridadActiva, cola, registrosDeIntegridad, programaVigente, programa.textoDeReferencia]
  );
  const marcasPorRevisar = cola.filter(
    (item) =>
      (hayAlgoQueRevisar(integridadPorEntrega[item.participantId]) || item.descuentoAutomatico > 0) && !item.decisionDeIntegridad
  ).length;
  const avance = contarAvanceDeLasEntregas(estado);
  const fase = estado.fase.actual;

  const sesionCerrada = estado.sesion.cerrada;
  // Groq sugiere a medida que llegan las entregas. Lleva el Programa COMPLETO del host (con las claves de
  // la lectura, que no viajan en el publicado).
  const { estados: estadosDeLaSugerencia, reintentar: reintentarSugerencia } = useSugerenciasDeCalificacion({
    activo: !sesionCerrada && programaVigente.sugerenciasDeIA !== false,
    cola,
    programa: { ...programaVigente, clavesDeLaLectura: programa.clavesDeLaLectura },
    rubrica,
    publicarComoDocente,
    razonamiento: perfilDeAhorro({ programa: programaVigente, estado }).razonamientoDeGroq === 'bajo' ? 'bajo' : 'normal',
  });

  // Revisión entre pares: el reparto se hace solo al empezar esa fase (docs/14-control-de-lectura.md).
  const hayRevisionEntrePares = Boolean(programaVigente.revisionDePares?.activa);
  const { errorDeLaAsignacion, reintentarElReparto } = useAsignacionDePares({
    activo: hayRevisionEntrePares && !sesionCerrada,
    estado,
    estadoPrivado,
    programa: programaVigente,
    publicarComoDocente,
    enviarAlEstudiante,
  });
  // Con revisión entre pares, la devolución espera a que termine esa fase: nadie lee su devolución mientras
  // todavía está revisando a otros.
  const puedeDevolver = !hayRevisionEntrePares || fase?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING;

  const [participanteElegido, setParticipanteElegido] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const itemElegido = cola.find((item) => item.participantId === participanteElegido) ?? null;
  const quienesSiguenEscribiendo = Object.values(estado.participantes).filter(
    (participante) => participante.ingresoConfirmado && !estado.lectura?.entregas?.[participante.participantId]
  );

  async function ejecutar(accion) {
    setGuardando(true);
    setAviso('');
    try {
      await accion();
    } catch (fallo) {
      console.warn('[r2-argumentum] la acción del docente falló', fallo);
      setAviso('No se pudo completar la acción. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      setGuardando(false);
    }
  }

  function guardarCalificacion(item, datos) {
    return ejecutar(() => publicarComoDocente(EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, { participantId: item.participantId, ...datos }));
  }

  // Los comentarios van primero al canal privado del estudiante; después, el aviso público de que ya
  // hay devolución (sin contenido) y el registro en el estado del docente.
  async function enviarDevolucion(item, { revisada = false, calificacion = item.calificacion } = {}) {
    const hasta = revisada && item.confirmaHasta
      ? item.confirmaHasta
      : Date.now() + resolverVentanaDeConfirmacionMin(programaVigente) * 60 * 1000;
    const contenido = construirDevolucionParaElEstudiante({
      rubrica,
      calificacion,
      // Solo las revisiones de compañeros que el docente aprobó (con el texto que él dejó).
      revisionesDePares: listarRevisionesAprobadasParaElAutor({ estadoPrivado, estado, rubrica, autorId: item.participantId }),
    });
    await enviarAlEstudiante(item.participantId, EVENTOS_PRIVADOS.DEVOLUCION_RECIBIDA, { ...contenido, hasta, revisada });
    await publicarComoDocente(EVENTOS_PRIVADOS.DEVOLUCION_ENVIADA, { participantId: item.participantId, hasta, revisada });
    publicar(EVENTOS.LECTURA_DEVUELTA, { participantId: item.participantId, hasta, revisada });
  }

  function devolver(item) {
    return ejecutar(() => enviarDevolucion(item));
  }

  function decidirIntegridad(item, decision) {
    return ejecutar(() => publicarComoDocente(EVENTOS_PRIVADOS.DECISION_DE_INTEGRIDAD, { participantId: item.participantId, ...decision }));
  }

  // El docente decide qué de la revisión de un compañero llega al autor: aprobarla (editada o no) o descartarla.
  function moderarRevision(item, revisorId, decision) {
    return ejecutar(() =>
      publicarComoDocente(EVENTOS_PRIVADOS.MODERACION_DE_REVISION, { participantId: item.participantId, revisorId, ...decision })
    );
  }

  const revisionesPorAprobar = contarRevisionesPorAprobar({ estadoPrivado, estado, rubrica });

  function aprobarTodasLasRevisionesPendientes() {
    if (!window.confirm(`Vas a aprobar tal cual ${revisionesPorAprobar} revisión(es) de compañeros: sus comentarios llegarán a los autores. ¿Aprobar?`)) {
      return;
    }
    ejecutar(async () => {
      for (const item of cola) {
        const pendientes = construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica, autorId: item.participantId }).filter(
          (revision) => revision.decision === DECISIONES_SOBRE_UNA_REVISION.PENDIENTE
        );
        for (const revision of pendientes) {
          await publicarComoDocente(EVENTOS_PRIVADOS.MODERACION_DE_REVISION, {
            participantId: item.participantId,
            revisorId: revision.revisorId,
            estado: 'aprobada',
            comentariosPorCriterio: revision.comentariosPorCriterio,
            comentarioGeneral: revision.comentarioGeneral,
          });
        }
      }
    });
  }

  function devolverTodasLasAprobadas() {
    const porDevolver = cola.filter((item) => item.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA && !item.devuelta);
    return ejecutar(async () => {
      for (const item of porDevolver) {
        // Una por una: si una falla, las demás ya salieron y esta se puede reintentar sola.
        await enviarDevolucion(item);
      }
    });
  }

  function resolverDesacuerdo(item, { resultado, calificacion }) {
    return ejecutar(async () => {
      if (resultado === 'cambia' && calificacion) {
        await publicarComoDocente(EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, { participantId: item.participantId, ...calificacion });
      }
      await enviarDevolucion(item, { revisada: true, calificacion: resultado === 'cambia' ? calificacion : item.calificacion });
      await publicarComoDocente(EVENTOS_PRIVADOS.RECONSIDERACION_RESUELTA, { participantId: item.participantId, resultado });
    });
  }

  function cerrarYCalcular() {
    const sinCalificar = resumen.sinCalificar + resumen.enBorrador;
    const detalle = [
      sinCalificar > 0 ? `${sinCalificar} entrega(s) sin calificación aprobada (no entran al podio)` : '',
      resumen.porDevolver > 0 ? `${resumen.porDevolver} aprobada(s) sin devolver` : '',
      resumen.desacuerdosPorResolver > 0 ? `${resumen.desacuerdosPorResolver} desacuerdo(s) sin resolver` : '',
    ].filter(Boolean);
    const pendientes = detalle.length > 0 ? `Todavía hay: ${detalle.join('; ')}. ` : '';
    if (window.confirm(`${pendientes}Cerrar publica el podio y termina la actividad. Después ya no se puede calificar. ¿Cerrar y calcular?`)) {
      ejecutar(async () => {
        await enviarResultadosDeLaRevisionEntrePares();
        motor.cerrarSesion();
      });
    }
  }

  // Antes de cerrar, cada revisor recibe cómo le fue: si su criterio coincidió con el del docente. Va por su
  // canal privado y no revela la nota ni los niveles de nadie.
  async function enviarResultadosDeLaRevisionEntrePares() {
    if (!hayRevisionEntrePares || !estadoPrivado.asignaciones) {
      return;
    }
    const puntos = calcularPuntosDeRevisores({ estadoPrivado, estado, rubrica, cola });
    for (const [revisorId, delRevisor] of Object.entries(puntos)) {
      await enviarAlEstudiante(revisorId, EVENTOS_PRIVADOS.RESULTADO_DE_REVISION, construirResultadoParaUnRevisor(delRevisor));
    }
  }

  function informeActual() {
    return construirInformeDeLectura({ estado, estadoPrivado, programa: programaVigente, presencia });
  }

  function nombreDelArchivo(extension) {
    return `control-de-lectura-${programaVigente.programId}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  }

  const paraAprobarEnLote = seleccionarParaAprobarEnLote(cola, {
    rubrica,
    entregasConMarcas: new Set(
      cola
        .filter((item) => hayAlgoQueRevisar(integridadPorEntrega[item.participantId]) || item.descuentoAutomatico > 0)
        .map((item) => item.participantId)
    ),
  });

  // Una decisión del docente (botón con confirmación): la IA solo sugiere.
  function aprobarEnLoteLasSugerencias() {
    if (
      !window.confirm(
        `Vas a aprobar tal cual las sugerencias de la IA de ${paraAprobarEnLote.length} entrega(s): confianza alta, nota sugerida de ${NOTA_MINIMA_PARA_APROBAR_EN_LOTE} o más y sin marcas de integridad. Las demás las revisas tú. Podrás cambiar cualquiera después. ¿Aprobar?`
      )
    ) {
      return;
    }
    ejecutar(async () => {
      for (const item of paraAprobarEnLote) {
        await publicarComoDocente(EVENTOS_PRIVADOS.CALIFICACION_GUARDADA, {
          participantId: item.participantId,
          ...datosDeCalificacionDesdeSugerencia(item.sugerencia, { aprobada: true }),
        });
      }
    });
  }

  return (
    <section className="panel-del-control-de-lectura">
      <h2>📖 Control de lectura</h2>

      <ul className="franja-de-metricas">
        <li>
          <strong>{avance.participantes}</strong>
          En la sala
        </li>
        <li className={avance.escribiendo > 0 ? 'metrica-con-pendiente' : ''}>
          <strong>{avance.escribiendo}</strong>
          Faltan
        </li>
        <li>
          <strong>{avance.entregaron}</strong>
          Entregaron
        </li>
        <li className={resumen.sinCalificar + resumen.enBorrador > 0 ? 'metrica-con-pendiente' : ''}>
          <strong>{resumen.sinCalificar + resumen.enBorrador}</strong>
          Por calificar
        </li>
        <li>
          <strong>{resumen.devueltas}</strong>
          Devueltas
        </li>
        <li>
          <strong>{avance.confirmadas}</strong>
          Confirmadas
        </li>
        <li className={resumen.desacuerdosPorResolver > 0 ? 'metrica-con-pendiente' : ''}>
          <strong>{resumen.desacuerdosPorResolver}</strong>
          Desacuerdos
        </li>
        {integridadActiva && (
          <li className={marcasPorRevisar > 0 ? 'metrica-con-pendiente' : ''}>
            <strong>{marcasPorRevisar}</strong>
            Marcas por ver
          </li>
        )}
      </ul>

      {(fase?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA || fase?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES) &&
        fase.duracionMin &&
        motor?.extenderTiempo && <ControlDelTiempoDelForo fase={fase} motor={motor} />}

      {hayRevisionEntrePares && (fase?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES || estadoPrivado.asignaciones) && (
        <div className="estado-de-la-revision-entre-pares">
          <p>
            🔍 Revisión entre pares:{' '}
            {estadoPrivado.asignaciones
              ? Object.keys(estadoPrivado.asignaciones).length === 0
                ? 'no hubo entregas suficientes (mínimo 3).'
                : `${avance.revisionesEnviadas} de ${Object.values(estadoPrivado.asignaciones).reduce((suma, autores) => suma + autores.length, 0)} revisiones enviadas · ${revisionesPorAprobar} por aprobar`
              : 'repartiendo los textos…'}
          </p>
          {errorDeLaAsignacion && <p className="mensaje-de-error">{errorDeLaAsignacion}</p>}
          {(errorDeLaAsignacion || Object.keys(estadoPrivado.asignaciones ?? {}).length > 0) && (
            <button type="button" className="boton-secundario" onClick={reintentarElReparto}>
              Reenviar los textos a quienes revisan
            </button>
          )}
          {revisionesPorAprobar > 0 && (
            <button type="button" className="boton-secundario" disabled={guardando} onClick={aprobarTodasLasRevisionesPendientes}>
              Aprobar las {revisionesPorAprobar} revisiones pendientes
            </button>
          )}
        </div>
      )}

      {!sesionCerrada && quienesSiguenEscribiendo.length > 0 && (
        <details className="quienes-faltan">
          <summary>Quiénes todavía no entregan ({quienesSiguenEscribiendo.length})</summary>
          <p className="texto-de-ayuda">Solo aparecen quienes faltan: no se muestra quién entregó, para que califiques a ciegas.</p>
          <ul>
            {quienesSiguenEscribiendo.map((participante) => (
              <li key={participante.participantId}>{nombreDeParticipante(presencia, participante.participantId)}</li>
            ))}
          </ul>
        </details>
      )}

      {aviso && <p className="mensaje-de-error">{aviso}</p>}

      {sesionCerrada ? (
        <>
          <PodioDelControlDeLectura estado={estado} presencia={presencia} />
          <InformeImpresoDeLectura estado={estado} estadoPrivado={estadoPrivado} programa={programaVigente} presencia={presencia} />
          <div className="botonera-de-bid">
            <button type="button" className="boton-primario" onClick={() => descargarComoJSON(informeActual(), nombreDelArchivo('json'))}>
              ⬇️ Informe (JSON)
            </button>
            <button
              type="button"
              className="boton-primario"
              onClick={() => descargarComoTexto(construirCsvDeLectura(informeActual()), nombreDelArchivo('csv'), 'text/csv;charset=utf-8')}
            >
              ⬇️ Notas (CSV)
            </button>
            {integridadActiva && (
              <button
                type="button"
                className="boton-secundario"
                onClick={() =>
                  descargarComoJSON(
                    construirAnexoDeIntegridadDeLectura({ estado, cola, integridadPorEntrega, programa: programaVigente, presencia }),
                    nombreDelArchivo('integridad.json')
                  )
                }
              >
                🛡️ Anexo de integridad (JSON, aparte)
              </button>
            )}
          </div>
          <p className="texto-de-ayuda">
            Los archivos traen las notas y los textos: son solo para ti. La nota no se le muestra a nadie más.
          </p>
          {onElegirOtraActividad && (
            <button type="button" className="boton-secundario" onClick={onElegirOtraActividad}>
              Elegir otra actividad
            </button>
          )}
        </>
      ) : (
        <>
          <GuiaDeLaConsigna programa={programaVigente} conPartes={false} />

          <h3>Entregas para calificar ({cola.length})</h3>
          {cola.length === 0 ? (
            <p className="texto-de-ayuda">Todavía no llega ninguna entrega.</p>
          ) : (
            <>
              <ul className="cola-de-entregas">
                {cola.map((item) => (
                  <li key={item.participantId}>
                    <button
                      type="button"
                      className={`entrega-de-la-cola ${item.participantId === participanteElegido ? 'entrega-de-la-cola--elegida' : ''}`}
                      onClick={() => setParticipanteElegido(item.participantId)}
                    >
                      <span className="entrega-de-la-cola-codigo">
                        {item.etiqueta}
                        {item.sugerencia ? ' ✨' : estadosDeLaSugerencia[item.participantId] === 'en_curso' ? ' …' : ''}
                        {hayAlgoQueRevisar(integridadPorEntrega[item.participantId]) || item.descuentoAutomatico > 0
                          ? item.decisionDeIntegridad
                            ? ' 🛡️✓'
                            : ' 🛡️'
                          : ''}
                      </span>
                      <span className="texto-de-ayuda">
                        {item.palabras} palabras · {textoDelEstadoDeLaEntrega(item)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {paraAprobarEnLote.length > 0 && (
                <button type="button" className="boton-secundario" disabled={guardando} onClick={aprobarEnLoteLasSugerencias}>
                  ✨ Aprobar las {paraAprobarEnLote.length} sugerencias claras (nota alta, sin marcas)
                </button>
              )}
              {resumen.porDevolver > 0 && (
                <button type="button" className="boton-primario" disabled={guardando || !puedeDevolver} onClick={devolverTodasLasAprobadas}>
                  📤 Devolver las {resumen.porDevolver} aprobadas
                </button>
              )}
              {!puedeDevolver && resumen.porDevolver > 0 && (
                <p className="texto-de-ayuda">Podrás devolver cuando termine la revisión entre pares.</p>
              )}
            </>
          )}

          {itemElegido && (
            <CalificadorDeEntrega
              key={itemElegido.participantId}
              item={itemElegido}
              rubrica={rubrica}
              nombreDelAutor={nombreDeParticipante(presencia, itemElegido.participantId)}
              guardando={guardando}
              estadoDeLaSugerencia={estadosDeLaSugerencia[itemElegido.participantId] ?? null}
              alReintentarSugerencia={() => reintentarSugerencia(itemElegido.participantId)}
              integridad={integridadActiva ? (integridadPorEntrega[itemElegido.participantId] ?? null) : null}
              alDecidirIntegridad={(decision) => decidirIntegridad(itemElegido, decision)}
              puedeDevolver={puedeDevolver}
              alGuardar={(datos) => guardarCalificacion(itemElegido, datos)}
              alDevolver={() => devolver(itemElegido)}
              alResolverDesacuerdo={(decision) => resolverDesacuerdo(itemElegido, decision)}
            />
          )}
          {itemElegido && (
            <RevisionesDeParesDeUnaEntrega
              key={`pares-${itemElegido.participantId}`}
              revisiones={construirRevisionesDeUnAutor({ estadoPrivado, estado, rubrica, autorId: itemElegido.participantId })}
              rubrica={rubrica}
              guardando={guardando}
              alModerar={(revisorId, decision) => moderarRevision(itemElegido, revisorId, decision)}
            />
          )}

          <div className="cierre-del-control-de-lectura">
            <button type="button" className="boton-peligro" onClick={cerrarYCalcular}>
              ⏹️ Cerrar y calcular el podio
            </button>
            <p className="texto-de-ayuda">Al cerrar se publica el podio (sin notas). Los archivos con las notas se bajan después.</p>
          </div>
        </>
      )}
    </section>
  );
}
