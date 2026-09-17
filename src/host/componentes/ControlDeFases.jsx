import { useState } from 'react';
import { TIPOS_DE_FASE, EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

const ETIQUETA_DE_FASE = {
  [TIPOS_DE_FASE.APERTURA_SIMULTANEA]: 'Apertura simultánea (todos escriben)',
  [TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS]: 'Escritura de argumentos',
  [TIPOS_DE_FASE.CONEXION_SUGERIDA]: 'Conexión sugerida por Groq',
  [TIPOS_DE_FASE.CONEXION_LIBRE]: 'Conexión libre',
  [TIPOS_DE_FASE.CIERRE_Y_RANKING]: 'Cierre y ranking',
};

export function ControlDeFases({ estado, motor, programa, publicar }) {
  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;
  const faseActual = estado.fase.actual;
  const [posturasSeleccionadas, setPosturasSeleccionadas] = useState(
    () => new Set(programa.posturas.map((postura) => postura.id))
  );

  function alternarPostura(posturaId) {
    setPosturasSeleccionadas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(posturaId)) {
        siguientes.delete(posturaId);
      } else {
        siguientes.add(posturaId);
      }
      return siguientes;
    });
  }

  function confirmarEIniciarSesion() {
    const posturasElegidas = programa.posturas.filter((postura) => posturasSeleccionadas.has(postura.id));
    if (posturasElegidas.length < 2) {
      return;
    }
    // Republica el Programa con solo las posturas elegidas — así el resto de la UI
    // (grafo, ranking, chips) ya no vuelve a ver las que el moderador destildó.
    publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa: { ...programa, posturas: posturasElegidas } });
    motor.iniciarSesion(posturasElegidas);
  }

  if (!sesionIniciada) {
    const hayQueElegir = programa.posturas.length > 2;
    return (
      <section className="tarjeta-de-fase">
        {hayQueElegir && (
          <div className="selector-de-posturas">
            <p className="texto-de-ayuda">
              Este Programa tiene {programa.posturas.length} posturas — elegí cuáles se debaten hoy (mínimo 2,
              todas tildadas por defecto):
            </p>
            <ul className="lista-de-posturas-seleccionables">
              {programa.posturas.map((postura) => (
                <li key={postura.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={posturasSeleccionadas.has(postura.id)}
                      onChange={() => alternarPostura(postura.id)}
                    />
                    <span style={{ color: postura.color }}>{postura.etiqueta}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" disabled={posturasSeleccionadas.size < 2} onClick={confirmarEIniciarSesion}>
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
