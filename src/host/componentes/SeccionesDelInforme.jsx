import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import {
  ETIQUETA_DEL_TIPO_DE_MOVIMIENTO,
  TIPOS_DE_MOVIMIENTO,
  calcularDesgloseDePuntaje,
} from '../../shared/nucleo/informe/desgloseDePuntaje.js';
import { ETIQUETA_DE_REACCION } from '../../shared/nucleo/reacciones/contarReacciones.js';
import { agruparSenalesPorParticipante } from '../../shared/nucleo/integridad/canalPrivado.js';
import { ETIQUETA_DE_GRAVEDAD, ETIQUETA_DE_SENAL } from '../../shared/nucleo/integridad/recolectorDeSenales.js';

function redondear(numero) {
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(1);
}

// De dónde sale el puntaje de cada persona. Antes el informe solo mostraba el total.
export function SeccionDeDesgloseDelPuntaje({ numero, eventos, estado, presencia }) {
  const desglose = calcularDesgloseDePuntaje(eventos);
  const filas = Object.entries(desglose)
    .map(([participantId, datos]) => ({ participantId, ...datos }))
    .sort((filaA, filaB) => filaB.totalFinal - filaA.totalFinal);
  if (filas.length === 0) {
    return null;
  }

  return (
    <>
      <h2>{numero}. Desglose del puntaje (de dónde sale cada punto)</h2>
      <table className="tabla-del-informe">
        <thead>
          <tr>
            <th>Persona</th>
            <th>{ETIQUETA_DEL_TIPO_DE_MOVIMIENTO[TIPOS_DE_MOVIMIENTO.APORTES]}</th>
            <th>{ETIQUETA_DEL_TIPO_DE_MOVIMIENTO[TIPOS_DE_MOVIMIENTO.REVISION]}</th>
            <th>{ETIQUETA_DEL_TIPO_DE_MOVIMIENTO[TIPOS_DE_MOVIMIENTO.CO_MODERACION]}</th>
            <th>Otros</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.participantId}>
              <td>
                {nombreDeParticipante(presencia, fila.participantId)}
                {estado.participantes[fila.participantId]?.rol === 'co_moderador' ? ' (co-moderador)' : ''}
              </td>
              <td>{fila.subtotales[TIPOS_DE_MOVIMIENTO.APORTES]}</td>
              <td>{fila.subtotales[TIPOS_DE_MOVIMIENTO.REVISION]}</td>
              <td>{fila.subtotales[TIPOS_DE_MOVIMIENTO.CO_MODERACION]}</td>
              <td>
                {fila.subtotales[TIPOS_DE_MOVIMIENTO.TURNO_HABLADO] +
                  fila.subtotales[TIPOS_DE_MOVIMIENTO.PENALIDAD] +
                  fila.subtotales[TIPOS_DE_MOVIMIENTO.OTROS]}
              </td>
              <td>
                <strong>{fila.totalFinal}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="texto-de-ayuda">
        El total nunca baja de cero: si una penalidad o un ajuste superan lo ganado, se cuenta como 0.
      </p>
    </>
  );
}

// Cómo revisaron los co-moderadores: su puntaje sale del porcentaje de acierto sobre el azar y de
// cuánto revisaron, no de coincidencias sueltas.
export function SeccionDeCoModeradores({ numero, evaluacion }) {
  if (evaluacion.length === 0) {
    return null;
  }
  return (
    <>
      <h2>{numero}. Resultado de los co-moderadores</h2>
      <table className="tabla-del-informe">
        <thead>
          <tr>
            <th>Co-moderador</th>
            <th>Revisó</th>
            <th>Con referencia</th>
            <th>Acierto sobre el azar</th>
            <th>Esfuerzo</th>
            <th>Puntos</th>
          </tr>
        </thead>
        <tbody>
          {evaluacion.map((fila) => (
            <tr key={fila.coModeradorId}>
              <td>{fila.nombre}</td>
              <td>{fila.aportesRevisados}</td>
              <td>{fila.aportesConReferencia}</td>
              <td>{fila.aportesConReferencia > 0 ? `${fila.aciertoSobreElAzarPorcentaje} %` : 'sin referencia'}</td>
              <td>{fila.esfuerzoPorcentaje} %</td>
              <td>
                <strong>{fila.puntos} pts</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="texto-de-ayuda">
        La referencia es la decisión del moderador; si no intervino, el consenso de los co-moderadores. Votar al azar no
        suma puntos.
      </p>
    </>
  );
}

// Lo propio del foro escrito: participación, reacciones y la revisión aporte por aporte.
export function SeccionesDelForo({ numeroInicial, resumen, programa }) {
  const { metricasDeParticipacion: metricas, reacciones, resumenDeSugerenciasDeLaIA: ia, revisionDeAportes } = resumen;
  const posturaPorId = Object.fromEntries(programa.posturas.map((postura) => [postura.id, postura]));

  return (
    <>
      <h2>{numeroInicial}. Participación en el foro</h2>
      <ul className="lista-del-informe">
        <li>
          {metricas.totalDePosts} post(s) y {metricas.totalDeReplicas} réplica(s) de {metricas.totalDeDebatientes} participante(s).
        </li>
        <li>
          {redondear(metricas.postsPorDebatiente)} posts por persona · {redondear(metricas.replicasPorPost)} réplicas por post.
        </li>
        <li>
          {metricas.postsSinDebatir} post(s) quedaron sin debatir ({metricas.porcentajeDePostsSinDebatir} %) y{' '}
          {metricas.debatientesSinIntervenir} persona(s) no publicaron nada.
        </li>
      </ul>

      <h2>{numeroInicial + 1}. Reacciones</h2>
      <p>
        {Object.entries(reacciones.totalPorTipo)
          .map(([tipo, cantidad]) => `${ETIQUETA_DE_REACCION[tipo]}: ${cantidad}`)
          .join(' · ')}
        . <strong>Convencimiento cruzado: {reacciones.convencimientoCruzado}</strong> («me convenció» de quien defiende la
        postura contraria; no da puntos).
      </p>

      <h2>{numeroInicial + 2}. Sugerencias de la IA (en conjunto)</h2>
      <p>
        {ia.aportesConSugerencia} aporte(s) con sugerencia: {ia.completos} completo(s), {ia.incompletos} incompleto(s),{' '}
        {ia.sinRazon} sin razón y {ia.conPosiblesFalacias} con alguna posible falacia. Son orientaciones: ninguna cambió el
        puntaje por sí sola; decidieron las personas que moderan.
      </p>

      <h2>{numeroInicial + 3}. Revisión de los aportes</h2>
      <table className="tabla-del-informe">
        <thead>
          <tr>
            <th>Autor</th>
            <th>Aporte</th>
            <th>Co-moderadores (cuenta · parcial · no)</th>
            <th>Nivel final</th>
            <th>Ajuste</th>
          </tr>
        </thead>
        <tbody>
          {revisionDeAportes.map((aporte) => (
            <tr key={aporte.argumentId}>
              <td>
                {aporte.autor}
                {posturaPorId[aporte.stanceId] ? ` · ${posturaPorId[aporte.stanceId].etiqueta}` : ''}
              </td>
              <td>
                <em>{aporte.esReplica ? 'Réplica' : 'Post'}</em>
                {aporte.oculto ? ' (oculto)' : ''}: {aporte.texto}
              </td>
              <td>
                {aporte.votosDeCoModeradores.cuenta} · {aporte.votosDeCoModeradores.parcial} ·{' '}
                {aporte.votosDeCoModeradores.noCuenta}
              </td>
              <td>{aporte.etiquetaDelNivelFinal}</td>
              <td>{aporte.ajusteAplicado === 0 ? '—' : aporte.ajusteAplicado}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="texto-de-ayuda">
        Sin revisión, el aporte cuenta completo. «Nivel final»: decide el moderador; si no intervino, la mayoría de los
        co-moderadores. Los aportes ocultos no cuentan.
      </p>
    </>
  );
}

// Confidencial: por defecto NO se imprime. El moderador lo incluye a propósito, porque el informe puede
// proyectarse o compartirse.
export function AnexoDeIntegridad({ registros, estado, presencia }) {
  const grupos = agruparSenalesPorParticipante(registros);
  return (
    <>
      <h2>Anexo de integridad (confidencial)</h2>
      <p className="texto-de-ayuda">
        Son señales que ayudan a revisar, no pruebas: el dictado por voz, el autocorrector y el uso del celular pueden
        generarlas. Conversa con la persona antes de actuar.
      </p>
      {grupos.length === 0 ? (
        <p>No se registraron señales.</p>
      ) : (
        <ul className="lista-del-informe">
          {grupos.map((grupo) => (
            <li key={grupo.participantId}>
              <strong>
                {nombreDeParticipante(presencia, grupo.participantId)} — gravedad {ETIQUETA_DE_GRAVEDAD[grupo.gravedadMaxima].toLowerCase()}
              </strong>
              <ul>
                {grupo.registros.flatMap((registro) =>
                  registro.senales.map((senal, indice) => (
                    <li key={`${registro.idDelMensaje}-${indice}`}>
                      {ETIQUETA_DE_SENAL[senal.tipo] ?? senal.tipo} ({ETIQUETA_DE_GRAVEDAD[senal.gravedad]}): {senal.detalle}
                      {registro.argumentId && estado.argumentos[registro.argumentId]
                        ? ` — «${estado.argumentos[registro.argumentId].texto.slice(0, 80)}…»`
                        : ''}
                    </li>
                  ))
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
