import { TIPOS_DE_FASE } from '../../../shared/eventos/nombresDeEventos.js';
import { contarAvanceDeLasEntregas } from '../../../shared/nucleo/entregas/estadoPublicoDeEntregas.js';
import { useCuentaAtras } from '../../../shared/nucleo/temporizador/useCuentaAtras.js';
import { BarraDeTiempo } from '../../../shared/componentes/foro/BarraDeTiempo.jsx';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';
import { PodioDelControlDeLectura } from '../../../shared/componentes/lectura/PodioDelControlDeLectura.jsx';

// Lo que la clase ve proyectado en el control de lectura: la consigna y la estructura, el tiempo y cuántas
// personas ya entregaron. Sin nombres, sin textos, sin notas y sin ningún control del docente
// (docs/14-control-de-lectura.md). Al final, el podio.
export function ProyeccionDelControlDeLectura({ estado, programa, presencia }) {
  const fase = estado.fase.actual;
  const faseConTiempo =
    fase?.tipo === TIPOS_DE_FASE.CONTROL_DE_LECTURA || fase?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES ? fase : null;
  const cuentaAtras = useCuentaAtras(faseConTiempo);
  const avance = contarAvanceDeLasEntregas(estado);
  const hayRevisionEntrePares = Boolean(programa.revisionDePares?.activa);
  const sesionIniciada = fase !== null || estado.fase.historial.length > 0;

  return (
    <div className="proyeccion-del-control-de-lectura">
      <GuiaDeLaConsigna programa={programa} />

      {faseConTiempo && (
        <BarraDeTiempo restanteMs={cuentaAtras.restanteMs} haVencido={cuentaAtras.haVencido} enAvisoFinal={cuentaAtras.enAvisoFinal} />
      )}
      {faseConTiempo?.tipo === TIPOS_DE_FASE.REVISION_DE_PARES && <p className="texto-de-ayuda">🔍 Revisión entre pares en curso.</p>}

      {sesionIniciada && (
        <ul className="marcador-de-avance">
          <li>
            <strong>{avance.participantes}</strong>
            En la sala
          </li>
          <li>
            <strong>{avance.entregaron}</strong>
            Entregaron
          </li>
          <li>
            <strong>{avance.escribiendo}</strong>
            Faltan
          </li>
          {hayRevisionEntrePares && (
            <li>
              <strong>{avance.revisionesEnviadas}</strong>
              Revisiones
            </li>
          )}
          <li>
            <strong>{avance.devueltas}</strong>
            Devueltas
          </li>
          <li>
            <strong>{avance.confirmadas}</strong>
            Confirmadas
          </li>
        </ul>
      )}

      {!sesionIniciada && <p className="texto-de-ayuda">Estamos por empezar. {avance.participantes} persona(s) en la sala.</p>}

      {estado.sesion.cerrada && <PodioDelControlDeLectura estado={estado} presencia={presencia} />}
    </div>
  );
}
