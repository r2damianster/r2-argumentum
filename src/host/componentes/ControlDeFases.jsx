import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';

const ETIQUETA_DE_FASE = {
  [TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS]: 'Escritura de argumentos',
  [TIPOS_DE_FASE.CONEXION_SUGERIDA]: 'Conexión sugerida por Groq',
  [TIPOS_DE_FASE.CONEXION_LIBRE]: 'Conexión libre',
  [TIPOS_DE_FASE.CIERRE_Y_RANKING]: 'Cierre y ranking',
};

export function ControlDeFases({ estado, motor }) {
  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;
  const faseActual = estado.fase.actual;

  if (!sesionIniciada) {
    return (
      <section className="tarjeta-de-fase">
        <p className="texto-de-ayuda">La sesión todavía no empezó.</p>
        <button type="button" onClick={motor.iniciarSesion}>
          Iniciar sesión
        </button>
      </section>
    );
  }

  if (!faseActual) {
    return (
      <section className="tarjeta-de-fase">
        <p className="texto-de-ayuda">Sin fase activa.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-fase">
      <p className="texto-de-ayuda">Fase activa</p>
      <h3>
        {ETIQUETA_DE_FASE[faseActual.tipo] || faseActual.tipo}
        {faseActual.ronda ? ` · Ronda ${faseActual.ronda}` : ''}
      </h3>
      {faseActual.tipo !== TIPOS_DE_FASE.CIERRE_Y_RANKING && (
        <button type="button" onClick={motor.cerrarFaseActual}>
          Cerrar fase actual
        </button>
      )}
    </section>
  );
}
