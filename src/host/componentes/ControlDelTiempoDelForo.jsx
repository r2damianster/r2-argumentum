import { useCuentaAtras } from '../../shared/nucleo/temporizador/useCuentaAtras.js';
import { MINUTOS_DE_UNA_EXTENSION } from '../../shared/nucleo/temporizador/calcularTiempoRestante.js';
import { BarraDeTiempo } from '../../shared/componentes/foro/BarraDeTiempo.jsx';

// Cuenta atrás del foro para el moderador, con la opción de extender el tiempo. La escritura se
// cierra sola al llegar a cero (lo hace el motor); el moderador también puede cerrarla antes con
// «Cerrar fase actual» o sumar minutos si la discusión está viva.
export function ControlDelTiempoDelForo({ fase, motor }) {
  const cuentaAtras = useCuentaAtras(fase);
  return (
    <div className="control-del-tiempo-del-foro">
      <BarraDeTiempo
        restanteMs={cuentaAtras.restanteMs}
        haVencido={cuentaAtras.haVencido}
        enAvisoFinal={cuentaAtras.enAvisoFinal}
      />
      <button type="button" className="boton-secundario" onClick={() => motor.extenderTiempo(MINUTOS_DE_UNA_EXTENSION)}>
        ➕ Extender {MINUTOS_DE_UNA_EXTENSION} minutos
      </button>
      {(fase.extensionesMin ?? 0) > 0 && (
        <p className="texto-de-ayuda">Ya extendiste {fase.extensionesMin} minutos en total.</p>
      )}
    </div>
  );
}
