import { useState } from 'react';
import { EVENTOS, TIPOS_DE_FASE } from '../../../shared/eventos/nombresDeEventos.js';
import { useCuentaAtras } from '../../../shared/nucleo/temporizador/useCuentaAtras.js';
import { ORDENES_DE_HILOS, construirHilos, ordenarHilos } from '../../../shared/nucleo/conciencia/construirHilos.js';
import { BarraDeTiempo } from '../../../shared/componentes/foro/BarraDeTiempo.jsx';
import { FranjaDeMetricas } from '../../../shared/componentes/foro/FranjaDeMetricas.jsx';
import { ListaDeHilos } from '../../../shared/componentes/foro/ListaDeHilos.jsx';
import { GrafoDeArgumentos } from '../../../shared/componentes/GrafoDeArgumentos.jsx';
import { AvisosDelForo } from './AvisosDelForo.jsx';
import { CompositorDeAporte } from './CompositorDeAporte.jsx';
import { PanelDeRevisionDeAportes } from './PanelDeRevisionDeAportes.jsx';

// Pantalla del participante durante el foro escrito (ver docs/13-foro-escrito-y-nucleo-reutilizable.md).
// Quienes son co-moderadores ven la misma lista, pero no publican: leen, ocultan lo que está fuera de
// lugar y (en el hito de revisión) deciden si un aporte cuenta.
export function VistaDelForo({ estado, presencia, programa, participantId, publicar, publicarIntegridad }) {
  const fase = estado.fase.actual;
  const faseConTiempo = fase?.tipo === TIPOS_DE_FASE.FORO_ESCRITO ? fase : null;
  const cuentaAtras = useCuentaAtras(faseConTiempo);
  const escrituraAbierta = Boolean(faseConTiempo) && !cuentaAtras.haVencido && !estado.sesion.cerrada;
  const esCoModerador = estado.participantes[participantId]?.rol === 'co_moderador';

  const [objetivo, setObjetivo] = useState(null);
  const [orden, setOrden] = useState(ORDENES_DE_HILOS.RECIENTES);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  const hilos = ordenarHilos(construirHilos(estado, { incluirOcultos: esCoModerador }), orden);

  function responderA(aporte) {
    setObjetivo(aporte);
    setTimeout(() => document.getElementById('compositor-del-foro')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  function reaccionar(argumentId, tipo) {
    publicar(EVENTOS.REACCION_REGISTRADA, { argumentId, participantId, tipo });
  }

  function ocultar(aporte) {
    publicar(EVENTOS.APORTE_OCULTADO, { argumentId: aporte.argumentId, porId: participantId, motivo: '' });
  }

  function renderAcciones(aporte) {
    if (esCoModerador) {
      return aporte.oculto ? null : (
        <button type="button" onClick={() => ocultar(aporte)}>
          🙈 Ocultar
        </button>
      );
    }
    if (!escrituraAbierta || aporte.participantId === participantId) {
      return null;
    }
    return (
      <button type="button" onClick={() => responderA(aporte)}>
        ↩️ Responder
      </button>
    );
  }

  return (
    <div className="vista-del-foro">
      {faseConTiempo && (
        <BarraDeTiempo
          restanteMs={cuentaAtras.restanteMs}
          haVencido={cuentaAtras.haVencido}
          enAvisoFinal={cuentaAtras.enAvisoFinal}
        />
      )}
      {!faseConTiempo && fase?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING && !estado.sesion.cerrada && (
        <BarraDeTiempo escrituraCerrada />
      )}

      <FranjaDeMetricas estado={estado} />

      {!esCoModerador && (
        <>
          <AvisosDelForo
            estado={estado}
            presencia={presencia}
            programa={programa}
            participantId={participantId}
            escrituraAbierta={escrituraAbierta}
            onResponderA={responderA}
          />
          <CompositorDeAporte
            estado={estado}
            programa={programa}
            presencia={presencia}
            participantId={participantId}
            objetivo={objetivo}
            escrituraAbierta={escrituraAbierta}
            onCancelarRespuesta={() => setObjetivo(null)}
            publicar={publicar}
            publicarIntegridad={publicarIntegridad}
          />
        </>
      )}

      {esCoModerador && !estado.sesion.cerrada && (
        <PanelDeRevisionDeAportes estado={estado} presencia={presencia} participantId={participantId} publicar={publicar} />
      )}

      <div className="orden-de-hilos">
        <label>
          Orden{' '}
          <select value={orden} onChange={(evento) => setOrden(evento.target.value)}>
            <option value={ORDENES_DE_HILOS.RECIENTES}>Lo más reciente primero</option>
            <option value={ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO}>Sin debatir primero</option>
          </select>
        </label>
      </div>

      <ListaDeHilos
        hilos={hilos}
        estado={estado}
        presencia={presencia}
        programa={programa}
        participantId={participantId}
        renderAcciones={renderAcciones}
        onReaccionar={reaccionar}
        verSugerenciasDeIA={esCoModerador}
        mensajeVacio="Todavía no hay posts."
      />

      <button type="button" className="boton-secundario" onClick={() => setMostrarMapa((visible) => !visible)}>
        {mostrarMapa ? 'Ocultar el mapa de argumentos' : '🗺️ Ver el mapa de argumentos'}
      </button>
      {mostrarMapa && <GrafoDeArgumentos estado={estado} programa={programa} presencia={presencia} />}
    </div>
  );
}
