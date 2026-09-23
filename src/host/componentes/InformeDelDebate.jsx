import {
  calcularRankingPorPostura,
  calcularPodioIndividual,
  calcularPodioDePosturas,
  nombreDeParticipante,
} from '../../shared/estado/seleccionesDerivadas.js';
import { calcularNivelPromedioDeExposicion } from '../../shared/puntaje/evaluacionDeExposiciones.js';
import {
  ETIQUETA_DE_CALIDAD_DE_EXPOSICION,
  describirNivelPromedio,
} from '../../shared/puntaje/etiquetasDeExposicion.js';

function describirDecisionParaElInforme(decisionModerador) {
  if (!decisionModerador) {
    return 'El moderador no la evaluó: rige el promedio de los co-moderadores.';
  }
  if (decisionModerador.decision === 'descartada') {
    return 'El moderador descartó las calificaciones: no ajustó puntos.';
  }
  return `El moderador la evaluó como «${ETIQUETA_DE_CALIDAD_DE_EXPOSICION[decisionModerador.calidad]}».`;
}

// Informe imprimible para evaluar el debate.
//
// Se genera como vista de impresión en vez de armar el PDF con una librería: el docente usa
// "Guardar como PDF" del navegador y obtiene un documento con texto real (seleccionable y
// buscable), no una imagen. Cero dependencias nuevas, y el mismo HTML sirve para imprimir en
// papel. Ver docs/03, campo `exportaPDF`. El botón para generarlo vive una sola vez, junto al
// ranking (PantallaDeRanking), con el resto de las acciones de cierre.
export function InformeDelDebate({ estado, programa, presencia, eventos }) {
  const podioIndividual = calcularPodioIndividual(estado, presencia);
  const podioPosturas = calcularPodioDePosturas(estado, programa, presencia);
  const ranking = calcularRankingPorPostura(estado, programa, presencia);
  const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);
  const conexiones = Object.values(estado.conexiones);
  const intervencionesVerbales = Object.values(estado.intervencionesVerbales);
  const exposiciones = Object.values(estado.exposiciones ?? {}).filter(
    (exposicion) => exposicion.estado === 'terminada'
  );
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));

  const faltas = argumentos
    .filter((argumento) => argumento.validacion?.faltaMarcada)
    .map((argumento) => ({
      autor: nombreDeParticipante(presencia, argumento.participantId),
      texto: argumento.texto,
      nota: argumento.validacion.nota,
      coModerador: nombreDeParticipante(presencia, argumento.validacion.coModeradorId),
    }));

  return (
    <section className="informe-del-debate">
      <article className="hoja-del-informe">
        <header>
          <h1>{programa.titulo}</h1>
          {!estado.sesion.cerrada && (
            <p>
              <strong>Informe parcial:</strong> el debate seguía en curso al generarlo.
            </p>
          )}
          <p>{programa.temaCentral}</p>
          <p className="texto-de-ayuda">
            Informe generado el {new Date().toLocaleString('es-EC')} · {argumentos.length} argumentos ·{' '}
            {conexiones.length} conexiones · {eventos.length} eventos registrados
          </p>
        </header>

        {/* 1. PRIMERO EN PDF: LISTA INDIVIDUAL DE ESTUDIANTES (POR PERSONA, INCLUYENDO DE 0 PTS) */}
        <h2>1. Lista Individual de Estudiantes (Por persona)</h2>
        <table className="tabla-del-informe" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th>Posición</th>
              <th>Estudiante</th>
              <th>Postura</th>
              <th>Puntaje Total</th>
              <th>Nivel / Tier</th>
              <th>Intervenciones</th>
            </tr>
          </thead>
          <tbody>
            {podioIndividual.map((participante) => {
              const postura = posturaPorId[participante.stanceId];
              return (
                <tr key={participante.participantId}>
                  <td>#{participante.posicion}</td>
                  <td>
                    {participante.emoji} {participante.nombre}
                  </td>
                  <td>{postura ? postura.etiqueta : 'Sin postura'}</td>
                  <td>
                    <strong>{participante.puntajeTotal} pts</strong>
                  </td>
                  <td>{participante.tier}</td>
                  <td>{estado.participantes[participante.participantId]?.intervenciones ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 2. SEGUNDO EN PDF: LISTA COLABORATIVA POR POSTURA (POR POSTURA) */}
        <h2>2. Lista Colaborativa por Postura (Por bando)</h2>
        {podioPosturas.map((postura, idx) => {
          const integrantesDePostura = ranking[postura.stanceId] ?? [];
          return (
            <div key={postura.stanceId} className="bloque-del-informe" style={{ marginBottom: '16px' }}>
              <h3 style={{ color: postura.color }}>
                #{idx + 1} {postura.etiqueta} — Total: {postura.puntajeTotalPostura} pts (Promedio: {postura.promedioPuntaje} pts/integrante)
              </h3>

              {postura.argumentosCentrales.length > 0 && (
                <p className="texto-de-ayuda" style={{ fontStyle: 'italic', margin: '4px 0 8px' }}>
                  💬 Argumentos centrales: {postura.argumentosCentrales.map((a) => `"${a.texto}"`).join(' | ')}
                </p>
              )}

              <table className="tabla-del-informe">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Puntaje Individual</th>
                    <th>Nivel</th>
                    <th>Intervenciones</th>
                  </tr>
                </thead>
                <tbody>
                  {integrantesDePostura.map((participante) => (
                    <tr key={participante.participantId}>
                      <td>
                        {participante.emoji} {participante.nombre}
                      </td>
                      <td>{participante.puntajeTotal} pts</td>
                      <td>{participante.tier}</td>
                      <td>{estado.participantes[participante.participantId]?.intervenciones ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <h2>Evolución de los argumentos</h2>
        <ol className="lista-del-informe">
          {argumentos.map((argumento) => {
            const postura = posturaPorId[argumento.stanceId];
            return (
              <li key={argumento.argumentId}>
                <strong>{nombreDeParticipante(presencia, argumento.participantId)}</strong>
                {postura ? ` · ${postura.etiqueta}` : ''} ·{' '}
                {argumento.validacion?.tipoFinal || argumento.tipoDeclarado}
                <p>{argumento.texto}</p>
              </li>
            );
          })}
        </ol>

        {conexiones.length > 0 && (
          <>
            <h2>Conexiones entre argumentos</h2>
            <ul className="lista-del-informe">
              {conexiones.map((conexion) => (
                <li key={conexion.linkId}>
                  <strong>{nombreDeParticipante(presencia, conexion.porParticipanteId)}</strong> marcó un{' '}
                  {conexion.tipoDeRelacion} entre dos argumentos del mapa.
                </li>
              ))}
            </ul>
          </>
        )}

        {exposiciones.length > 0 && (
          <>
            <h2>Exposiciones orales de los argumentos</h2>
            <ul className="lista-del-informe">
              {exposiciones.map((exposicion) => (
                <li key={exposicion.argumentId}>
                  <strong>{nombreDeParticipante(presencia, exposicion.participantId)}</strong> · calificaron{' '}
                  {Object.keys(exposicion.calificaciones).length} co-moderador(es) — promedio:{' '}
                  {describirNivelPromedio(calcularNivelPromedioDeExposicion(exposicion.calificaciones))}
                  <p>{describirDecisionParaElInforme(exposicion.decisionModerador)}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        {intervencionesVerbales.length > 0 && (
          <>
            <h2>Intervenciones habladas sin argumento escrito</h2>
            <ul className="lista-del-informe">
              {intervencionesVerbales.map((intervencion) => (
                <li key={intervencion.intervencionId}>
                  <strong>{nombreDeParticipante(presencia, intervencion.participantId)}</strong>
                  {intervencion.calificacion ? ` · calificada como ${intervencion.calificacion.calidad}` : ' · sin calificar'}
                  {intervencion.resumen && <p>{intervencion.resumen}</p>}
                </li>
              ))}
            </ul>
          </>
        )}

        {faltas.length > 0 && (
          <>
            <h2>Faltas marcadas</h2>
            <ul className="lista-del-informe">
              {faltas.map((falta, indice) => (
                <li key={indice}>
                  <strong>{falta.autor}</strong> — marcada por {falta.coModerador}.
                  <p>{falta.nota || 'Sin justificación escrita.'}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        <footer>
          <p className="texto-de-ayuda">
            R2 Argumentum — Arturo Damián Rodríguez Zambrano · Docente, investigador y vibe coder
          </p>
        </footer>
      </article>
    </section>
  );
}
