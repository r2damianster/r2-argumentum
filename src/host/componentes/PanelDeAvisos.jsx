import { calcularAvisosParaElModerador, GRAVEDAD } from '../../shared/instrucciones/calcularAvisos.js';

// Avisos automáticos para que el docente no tenga que vigilar cinco paneles a la vez: quién no
// preparó argumento, quién no ha hablado todavía, qué queda sin revisar.
export function PanelDeAvisos({ estado, presencia }) {
  const avisos = calcularAvisosParaElModerador(estado, presencia);

  if (avisos.length === 0) {
    return null;
  }

  return (
    <section className="tarjeta-de-avisos">
      <h3>Atención</h3>
      <ul className="lista-de-avisos">
        {avisos.map((aviso) => (
          <li key={aviso.id} className={aviso.gravedad === GRAVEDAD.ALTA ? 'aviso-alto' : ''}>
            <strong>{aviso.texto}</strong>
            <p className="texto-de-ayuda">{aviso.detalle}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
