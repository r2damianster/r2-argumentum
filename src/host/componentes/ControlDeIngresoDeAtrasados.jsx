import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { permiteIngresoDeAtrasados } from '../../shared/ingreso/reglasDeIngreso.js';

// Botón del moderador para admitir o no a quien llega cuando la sesión ya empezó («atrasados»).
// Sirve en todas las actividades: el valor por defecto cambia (foro y control de lectura admiten,
// el debate hablado no) pero la decisión es siempre del moderador y se puede cambiar las veces que haga falta.
// No expulsa a nadie: quien ya confirmó su ingreso sigue dentro aunque se cierre.
export function ControlDeIngresoDeAtrasados({ estado, programa, publicar }) {
  const permitido = permiteIngresoDeAtrasados(estado, programa);

  function alternarIngresoDeAtrasados() {
    publicar(EVENTOS.INGRESO_DE_ATRASADOS_CAMBIADO, { permitido: !permitido });
  }

  return (
    <div className="control-de-atrasados">
      <p className="texto-de-ayuda">
        {permitido
          ? 'Quien llegue con la sesión ya iniciada puede entrar y participar.'
          : 'Quien llegue con la sesión ya iniciada no podrá entrar: solo mirará.'}
      </p>
      <button
        type="button"
        className="boton-cambiar-programa boton-de-atrasados"
        aria-pressed={permitido}
        onClick={alternarIngresoDeAtrasados}
      >
        {permitido ? '🔒 No permitir atrasados' : '🔓 Permitir atrasados'}
      </button>
    </div>
  );
}
