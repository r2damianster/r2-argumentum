import { TIPOS_DE_FASE } from '../../../shared/eventos/nombresDeEventos.js';
import { useCuentaAtras } from '../../../shared/nucleo/temporizador/useCuentaAtras.js';
import { BarraDeTiempo } from '../../../shared/componentes/foro/BarraDeTiempo.jsx';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';
import { PodioDelControlDeLectura } from '../../../shared/componentes/lectura/PodioDelControlDeLectura.jsx';
import { CompositorDeLaEntrega } from './CompositorDeLaEntrega.jsx';
import { TarjetaDeDevolucion } from './TarjetaDeDevolucion.jsx';
import { PanelDeRevisionEntrePares, ResultadoDeTuRevision } from './PanelDeRevisionEntrePares.jsx';

// La escritura ya terminó si la fase de escritura figura entre las cerradas o hay otra fase en curso.
function laEscrituraYaCerro(estado) {
  return (
    estado.fase.historial.some((fase) => fase.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA) ||
    (estado.fase.actual !== null && estado.fase.actual.tipo !== TIPOS_DE_FASE.CONTROL_DE_LECTURA)
  );
}

// Pantalla del participante en el control de lectura (ver docs/14-control-de-lectura.md): la consigna,
// el cuadro para escribir con su cuenta atrás y, después, la devolución y el podio.
export function VistaDelControlDeLectura({
  estado,
  presencia,
  programa,
  participantId,
  mensajesPrivados = {},
  publicar,
  publicarIntegridad,
  publicarEntregaPrivada,
}) {
  const fase = estado.fase.actual;
  const faseDeEscritura = fase?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA ? fase : null;
  const cuentaAtras = useCuentaAtras(faseDeEscritura);
  const escrituraAbierta = Boolean(faseDeEscritura) && !cuentaAtras.haVencido && !estado.sesion.cerrada;
  const escrituraYaCerro = laEscrituraYaCerro(estado);
  const entrega = estado.lectura?.entregas?.[participantId] ?? null;
  const sesionIniciada = fase !== null || estado.fase.historial.length > 0;
  const { devolucion = null, revisionAsignada = null, resultadoDeRevision = null } = mensajesPrivados;
  const hayRevisionEntrePares = Boolean(programa.revisionDePares?.activa);

  return (
    <div className="vista-del-control-de-lectura">
      {faseDeEscritura && (
        <BarraDeTiempo restanteMs={cuentaAtras.restanteMs} haVencido={cuentaAtras.haVencido} enAvisoFinal={cuentaAtras.enAvisoFinal} />
      )}
      {!faseDeEscritura && sesionIniciada && !estado.sesion.cerrada && !entrega && <BarraDeTiempo escrituraCerrada />}

      {estado.sesion.cerrada ? (
        <>
          <PodioDelControlDeLectura estado={estado} presencia={presencia} participantId={participantId} />
          <ResultadoDeTuRevision resultado={resultadoDeRevision} />
        </>
      ) : (
        <>
          {!entrega && <GuiaDeLaConsigna programa={programa} />}
          {!sesionIniciada ? (
            <p className="texto-de-ayuda">El docente todavía no abre la escritura. Cuando empiece, aquí aparecerá el cuadro para escribir.</p>
          ) : (
            <CompositorDeLaEntrega
              estado={estado}
              programa={programa}
              participantId={participantId}
              escrituraAbierta={escrituraAbierta}
              escrituraYaCerro={escrituraYaCerro}
              publicar={publicar}
              publicarIntegridad={publicarIntegridad}
              publicarEntregaPrivada={publicarEntregaPrivada}
            />
          )}
          {hayRevisionEntrePares && (
            <PanelDeRevisionEntrePares
              estado={estado}
              programa={programa}
              participantId={participantId}
              revisionAsignada={revisionAsignada}
              publicar={publicar}
              publicarEntregaPrivada={publicarEntregaPrivada}
            />
          )}
          {entrega && !entrega.devueltaEn && (
            <p className="texto-de-ayuda">Tu docente está revisando tu texto. Cuando lo termine verás aquí sus comentarios.</p>
          )}
          <TarjetaDeDevolucion
            estado={estado}
            participantId={participantId}
            devolucion={devolucion}
            publicar={publicar}
            publicarEntregaPrivada={publicarEntregaPrivada}
          />
        </>
      )}
    </div>
  );
}
