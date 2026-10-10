import { useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import {
  FILTROS_DE_LA_COLA_DEL_MODERADOR,
  listarAportesParaElModerador,
} from '../../shared/nucleo/revision/colaDeRevision.js';
import {
  ETIQUETA_DE_NIVEL_DE_REVISION,
  NIVELES_DE_REVISION_DE_APORTE,
} from '../../shared/puntaje/puntajeDeAportes.js';
import { SugerenciaDeIA } from '../../shared/componentes/foro/SugerenciaDeIA.jsx';
import { GuiaDeCriteriosAdicionales } from '../../shared/componentes/foro/GuiaDeCriteriosAdicionales.jsx';

const NIVELES_EN_ORDEN_DE_BOTONES = [
  NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO,
  NIVELES_DE_REVISION_DE_APORTE.PARCIAL,
  NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA,
];

function describirDecision(resumen) {
  if (resumen.decisionModerador?.decision === 'descartada') {
    return 'Descartaste las decisiones de los co-moderadores: el aporte conserva su puntaje.';
  }
  if (resumen.decisionModerador?.decision === 'evaluada') {
    return `Tu decisión: ${ETIQUETA_DE_NIVEL_DE_REVISION[resumen.decisionModerador.nivel]}.`;
  }
  if (resumen.totalDeVotos > 0) {
    return `Sin tu decisión, rige la mayoría de los co-moderadores: ${ETIQUETA_DE_NIVEL_DE_REVISION[resumen.nivelQueRige] ?? '—'}.`;
  }
  return 'Sin revisión, el aporte cuenta completo.';
}

// Revisión del moderador. Es opcional: lo que no toca, cuenta completo. Su decisión manda sobre la
// de los co-moderadores, y puntúa a los co-moderadores según qué tanto coincidieron con ella.
// Ve cuántos votaron cada nivel, nunca quién votó qué.
export function PanelDeRevisionDelModerador({ estado, presencia, publicar }) {
  const [filtro, setFiltro] = useState(FILTROS_DE_LA_COLA_DEL_MODERADOR.MARCADOS);
  const items = listarAportesParaElModerador(estado, { filtro });
  const hayCoModeradores = (estado.coModeradores?.participantIds.length ?? 0) > 0;

  function decidir(argumentId, decision, nivel = null) {
    publicar(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, { argumentId, decision, nivel });
  }

  return (
    <section className="tarjeta-de-fase">
      <h3>Revisión de aportes</h3>
      <p className="texto-de-ayuda">
        Opcional: lo que no revises cuenta completo.{' '}
        {hayCoModeradores
          ? 'Tu decisión manda sobre la de los co-moderadores y mide qué tanto acertaron.'
          : 'Sin co-moderadores, tu decisión es la única revisión.'}{' '}
        La IA solo sugiere.
      </p>

      <GuiaDeCriteriosAdicionales programa={estado.programa} encabezado="Al decidir, considera además:" />

      <div className="orden-de-hilos">
        <label>
          Mostrar{' '}
          <select value={filtro} onChange={(evento) => setFiltro(evento.target.value)}>
            <option value={FILTROS_DE_LA_COLA_DEL_MODERADOR.MARCADOS}>Marcados por la IA o con discrepancia</option>
            <option value={FILTROS_DE_LA_COLA_DEL_MODERADOR.SIN_DECIDIR}>Los que no he decidido</option>
            <option value={FILTROS_DE_LA_COLA_DEL_MODERADOR.TODOS}>Todos</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <p className="texto-de-ayuda">No hay aportes en esta lista.</p>
      ) : (
        <ul className="lista-de-validaciones-pendientes">
          {items.map(({ aporte, resumen, prioridad }) => (
            <li key={aporte.argumentId}>
              <p>
                <strong>{nombreDeParticipante(presencia, aporte.participantId)}</strong>
                {prioridad && <span className="etiqueta-sin-debatir"> Para mirar</span>}
              </p>
              <blockquote className="cita-de-argumento">{aporte.texto}</blockquote>
              <SugerenciaDeIA sugerencia={aporte.sugerenciaDeIA} />
              {hayCoModeradores && (
                <p className="texto-de-ayuda">
                  Co-moderadores ({resumen.totalDeVotos}): {resumen.votos.cuenta} cuenta · {resumen.votos.parcial} parcial ·{' '}
                  {resumen.votos.noCuenta} no cuenta
                  {resumen.hayDiscrepancia ? ' — no coinciden' : ''}
                </p>
              )}
              <p className="texto-de-ayuda">{describirDecision(resumen)}</p>
              <div className="botonera-de-bid">
                {NIVELES_EN_ORDEN_DE_BOTONES.map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    className={
                      nivel === NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO
                        ? 'boton-exito'
                        : nivel === NIVELES_DE_REVISION_DE_APORTE.PARCIAL
                          ? 'boton-secundario'
                          : 'boton-peligro'
                    }
                    onClick={() => decidir(aporte.argumentId, 'evaluada', nivel)}
                  >
                    {ETIQUETA_DE_NIVEL_DE_REVISION[nivel]}
                  </button>
                ))}
                {hayCoModeradores && resumen.totalDeVotos > 0 && (
                  <button type="button" className="boton-secundario" onClick={() => decidir(aporte.argumentId, 'descartada')}>
                    🚫 Descartar votos
                  </button>
                )}
                {resumen.decisionModerador && (
                  <button type="button" className="boton-secundario" onClick={() => decidir(aporte.argumentId, 'sin_evaluar')}>
                    ↩️ Quitar mi decisión
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
