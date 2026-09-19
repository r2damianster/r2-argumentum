import { calcularRankingPorPostura, nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import { imprimirInformeComoPDF } from '../imprimirInforme.js';

// Informe imprimible para evaluar el debate.
//
// Se genera como vista de impresión en vez de armar el PDF con una librería: el docente usa
// "Guardar como PDF" del navegador y obtiene un documento con texto real (seleccionable y
// buscable), no una imagen. Cero dependencias nuevas, y el mismo HTML sirve para imprimir en
// papel. Ver docs/03, campo `exportaPDF`.
export function InformeDelDebate({ estado, programa, presencia, eventos }) {
  const ranking = calcularRankingPorPostura(estado, programa, presencia);
  const argumentos = Object.values(estado.argumentos).sort((a, b) => a.timestamp - b.timestamp);
  const conexiones = Object.values(estado.conexiones);
  const intervencionesVerbales = Object.values(estado.intervencionesVerbales);
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
      <div className="acciones-del-informe">
        <button type="button" onClick={() => imprimirInformeComoPDF(programa.titulo)}>
          🖨️ Generar PDF del debate
        </button>
        <p className="texto-de-ayuda">
          Se abre el diálogo de impresión: elige “Guardar como PDF” como destino.
        </p>
      </div>

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

        <h2>Resultados por postura</h2>
        {programa.posturas.map((postura) => {
          const deEstaPostura = ranking[postura.id] ?? [];
          if (deEstaPostura.length === 0) {
            return null;
          }
          return (
            <div key={postura.id} className="bloque-del-informe">
              <h3>{postura.etiqueta}</h3>
              <table className="tabla-del-informe">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Puntaje</th>
                    <th>Nivel</th>
                    <th>Intervenciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deEstaPostura.map((participante) => (
                    <tr key={participante.participantId}>
                      <td>{participante.nombre}</td>
                      <td>{participante.puntajeTotal}</td>
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
