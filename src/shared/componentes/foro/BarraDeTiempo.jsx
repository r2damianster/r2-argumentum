import { formatearCuentaAtras } from '../../nucleo/temporizador/calcularTiempoRestante.js';

// Cuenta atrás del foro. Cambia de aspecto en los últimos 2 minutos y al agotarse el tiempo.
export function BarraDeTiempo({ restanteMs, haVencido, enAvisoFinal, escrituraCerrada = false }) {
  if (escrituraCerrada || haVencido) {
    return (
      <p className="barra-de-tiempo barra-de-tiempo--agotado" role="timer">
        ⏹️ Se acabó el tiempo de escritura
      </p>
    );
  }
  if (restanteMs === null || restanteMs === undefined) {
    return null;
  }
  return (
    <p className={`barra-de-tiempo ${enAvisoFinal ? 'barra-de-tiempo--final' : ''}`} role="timer">
      ⏱️ {formatearCuentaAtras(restanteMs)} {enAvisoFinal && <span>· últimos 2 minutos</span>}
    </p>
  );
}
