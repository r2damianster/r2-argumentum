import {
  calcularRankingPorPostura,
  calcularPodioDePosturas,
  calcularPodioIndividual,
} from '../../shared/estado/seleccionesDerivadas.js';
import { exportarAnexoDeIntegridad, exportarSesion, descargarComoJSON } from '../../shared/estado/exportarSesion.js';
import { resolverActividadDelPrograma } from '../../actividades/registroDeActividades.js';
import { ID_FORO_ESCRITO } from '../../actividades/foroEscrito/definicion.js';
import { imprimirInformeComoPDF } from '../imprimirInforme.js';

export function PantallaDeRanking({
  estado,
  eventos,
  programa,
  presencia,
  motor,
  onNuevoDebate,
  integridadActiva = false,
  registrosDeIntegridad = [],
  incluirAnexoDeIntegridad = false,
  onAlternarAnexoDeIntegridad = () => {},
}) {
  const esForo = resolverActividadDelPrograma(estado.programa ?? programa).id === ID_FORO_ESCRITO;
  const podioPosturas = calcularPodioDePosturas(estado, programa, presencia);
  const podioIndividual = calcularPodioIndividual(estado, presencia);
  const ranking = calcularRankingPorPostura(estado, programa, presencia);
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));
  const sesionCerrada = estado.sesion.cerrada;
  // Hasta cerrar, el marcador es provisional: al cerrar se aplican las exposiciones y las revisiones.
  const hayAjustesPorAplicar =
    Object.values(estado.exposiciones ?? {}).some((exposicion) => exposicion.estado === 'terminada') ||
    Object.keys(estado.revisiones ?? {}).length > 0 ||
    Object.values(estado.argumentos ?? {}).some((aporte) => aporte.oculto);

  function manejarDescargaDeJSON() {
    const sesionExportada = exportarSesion({ eventos, estado, programa, presencia });
    const sufijo = sesionCerrada ? '' : '-parcial';
    descargarComoJSON(sesionExportada, `r2-argumentum-${programa.programId}${sufijo}-${Date.now()}.json`);
  }

  function manejarDescargaDelAnexoDeIntegridad() {
    const anexo = exportarAnexoDeIntegridad({ registros: registrosDeIntegridad, estado, programa, presencia });
    descargarComoJSON(anexo, `r2-argumentum-${programa.programId}-integridad-${Date.now()}.json`);
  }

  function manejarNuevoDebate() {
    const confirmado = window.confirm(
      'Vas a salir de este informe y volver a elegir la actividad. Si todavía no descargaste el JSON o el PDF, hazlo antes: al salir no hay forma de recuperarlo desde aquí. ¿Continuar?'
    );
    if (confirmado) {
      onNuevoDebate();
    }
  }

  return (
    <section className="tarjeta-de-ranking" id="ranking-del-debate">
      <h3>{sesionCerrada ? '🏆 Marcador y Podios finales' : '📊 Marcador y Podios parciales (el debate sigue)'}</h3>
      {!sesionCerrada && hayAjustesPorAplicar && (
        <p className="texto-de-ayuda">
          Este marcador es provisional: al cerrar {esForo ? 'el foro' : 'el debate'} se aplican las revisiones{' '}
          {esForo ? 'de los aportes (co-moderadores y tuyas)' : 'de las exposiciones (co-moderadores y tuyas)'}. Revísalas
          antes en «{esForo ? 'Revisión de aportes' : 'Evaluación de exposiciones'}».
        </p>
      )}

      {/* 1. PODIO DE POSTURAS (Postura vs Postura con Argumentos Centrales) */}
      <div className="seccion-podio">
        <h4>🏆 1. Podio de Posturas (Comparativa por bando)</h4>
        <div className="grilla-podio-posturas">
          {podioPosturas.map((postura, idx) => {
            const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            return (
              <div
                key={postura.stanceId}
                className={`tarjeta-podio-postura tarjeta-podio-postura-${idx + 1}`}
              >
                <div className="encabezado-podio-postura">
                  <span style={{ color: postura.color, fontSize: '1.05rem' }}>
                    {medalla} {postura.etiqueta}
                  </span>
                  <span style={{ color: 'var(--color-marca-oscuro)', fontWeight: 'bold' }}>
                    {postura.puntajeTotalPostura} pts
                  </span>
                </div>
                <p className="texto-de-ayuda" style={{ margin: 0 }}>
                  👥 {postura.totalIntegrantes} participante(s) · Promedio: {postura.promedioPuntaje} pts/estudiante
                </p>

                {postura.argumentosCentrales.length > 0 && (
                  <div>
                    <p className="texto-de-ayuda" style={{ fontWeight: 'bold', marginTop: '6px', marginBottom: '2px' }}>
                      💬 Argumentos centrales destacados:
                    </p>
                    <ul className="argumentos-destacados-postura">
                      {postura.argumentosCentrales.map((arg) => (
                        <li key={arg.argumentId}>
                          "{arg.texto}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PODIO INDIVIDUAL DE ESTUDIANTES */}
      <div className="seccion-podio">
        <h4>🎖️ 2. Podio Individual de Estudiantes (Mejores puntajes)</h4>
        <ol className="lista-del-informe" style={{ paddingLeft: '20px' }}>
          {podioIndividual.map((estudiante) => {
            const postura = posturaPorId[estudiante.stanceId];
            const medalla =
              estudiante.posicion === 1
                ? '🥇'
                : estudiante.posicion === 2
                ? '🥈'
                : estudiante.posicion === 3
                ? '🥉'
                : `#${estudiante.posicion}`;
            return (
              <li key={estudiante.participantId} style={{ marginBottom: '6px' }}>
                <strong>
                  {medalla} {estudiante.emoji} {estudiante.nombre}
                </strong>{' '}
                {postura ? <span style={{ color: postura.color }}>({postura.etiqueta})</span> : ''} —{' '}
                <strong>{estudiante.puntajeTotal} pts</strong> ({estudiante.tier})
              </li>
            );
          })}
        </ol>
      </div>

      {/* 3. RANKING AGRUPADO POR POSTURA */}
      <div className="seccion-podio">
        <h4>👥 3. Desglose de integrantes por postura</h4>
        {Object.entries(ranking).map(([stanceId, participantes]) => (
          <div key={stanceId} className="columna-de-ranking">
            <h5 style={{ color: posturaPorId[stanceId]?.color, margin: '8px 0 4px', fontSize: '0.95rem' }}>
              {posturaPorId[stanceId]?.etiqueta}
            </h5>
            <ol style={{ paddingLeft: '20px' }}>
              {participantes.map((participante) => (
                <li key={participante.participantId}>
                  {participante.tier === 'Sólido' ? '🥇' : participante.tier === 'Consistente' ? '🥈' : '🥉'}{' '}
                  {participante.emoji} {participante.nombre} — {participante.puntajeTotal} pts ({participante.tier})
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="acciones-del-ranking">
        {!sesionCerrada && (
          <button type="button" className="boton-peligro" onClick={motor.cerrarSesion}>
            {esForo ? '🛑 Cerrar y calcular los puntajes' : '🛑 Cerrar debate'}
          </button>
        )}
        <button type="button" className="boton-exito" onClick={() => imprimirInformeComoPDF(programa.titulo)}>
          📄 Descargar informe (PDF)
        </button>
        <button type="button" className="boton-secundario" onClick={manejarDescargaDeJSON}>
          💾 Descargar sesión (.json)
        </button>
        {integridadActiva && (
          <button type="button" className="boton-secundario" onClick={manejarDescargaDelAnexoDeIntegridad}>
            🛡️ Descargar anexo de integridad (.json)
          </button>
        )}
        {sesionCerrada && (
          <button type="button" className="boton-primario" onClick={manejarNuevoDebate}>
            ➕ Elegir otra actividad
          </button>
        )}
      </div>
      {integridadActiva && (
        <label className="casilla-de-falta">
          <input type="checkbox" checked={incluirAnexoDeIntegridad} onChange={onAlternarAnexoDeIntegridad} />
          Incluir el anexo de integridad en el PDF (confidencial)
        </label>
      )}
      <p className="texto-de-ayuda">
        El PDF se genera con el diálogo de impresión del navegador: elige «Guardar como PDF» como destino. Incluye el
        desglose del puntaje de cada persona
        {esForo ? ' y la revisión de cada aporte' : ''}. El JSON conserva el registro completo de eventos.
        {integridadActiva
          ? ' Las señales de integridad van en un archivo aparte y no se imprimen salvo que marques la casilla.'
          : ''}
      </p>
    </section>
  );
}
