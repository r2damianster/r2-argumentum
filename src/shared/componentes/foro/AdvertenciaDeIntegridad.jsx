import { ETIQUETA_DE_GRAVEDAD, ETIQUETA_DE_SENAL } from '../../nucleo/integridad/recolectorDeSenales.js';
import { avisoDeIntegridadAlIngresar } from '../../nucleo/integridad/nivelesDeIntegridad.js';

// Lo que ve quien escribe cuando se detectaron señales de integridad, ANTES de enviar: «el moderador
// verá esta marca» (los compañeros no). Puede enviar igual o reescribir con sus palabras.
export function AdvertenciaDeIntegridad({ resumen, onEnviarIgual, onReescribir }) {
  return (
    <div className="aviso-de-validacion aviso-de-integridad" role="alert">
      <p className="mensaje-de-error">
        <strong>Se detectaron señales en tu texto.</strong> El moderador verá esta marca (tus compañeros no).
      </p>
      <ul>
        {resumen.senales.map((senal, indice) => (
          <li key={`${senal.tipo}-${indice}`}>
            {ETIQUETA_DE_SENAL[senal.tipo] ?? senal.tipo} ({ETIQUETA_DE_GRAVEDAD[senal.gravedad]}): {senal.detalle}
          </li>
        ))}
      </ul>
      <p className="texto-de-ayuda">
        Es una advertencia, no una sanción automática. Si lo escribiste tú, puedes enviarlo igual; si no, mejor
        reescríbelo con tus propias palabras.
      </p>
      <div className="botonera-de-bid">
        <button type="button" className="boton-secundario" onClick={onEnviarIgual}>
          Enviar igual
        </button>
        <button type="button" className="boton-primario" onClick={onReescribir}>
          ✏️ Reescribir
        </button>
      </div>
    </div>
  );
}

// Aviso permanente (y corto) de que hay integridad activa: registrar señales sin avisar sería injusto.
export function AvisoDeIntegridad({ nivel }) {
  const texto = avisoDeIntegridadAlIngresar(nivel);
  if (!texto) {
    return null;
  }
  return <p className="texto-de-ayuda aviso-de-integridad-general">🛡️ {texto}</p>;
}
