import { useState } from 'react';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { ORDENES_DE_HILOS, construirHilos, ordenarHilos } from '../../shared/nucleo/conciencia/construirHilos.js';
import { resumirReaccionesDelForo, ETIQUETA_DE_REACCION } from '../../shared/nucleo/reacciones/contarReacciones.js';
import { FranjaDeMetricas } from '../../shared/componentes/foro/FranjaDeMetricas.jsx';
import { ListaDeHilos } from '../../shared/componentes/foro/ListaDeHilos.jsx';

// Vista del moderador durante el foro: cómo va la participación, las reacciones (incluido el
// convencimiento cruzado, que solo ve el moderador) y todos los hilos, con la posibilidad de
// ocultar un aporte fuera de lugar y de restaurarlo. Ocultar no borra nada: el aporte sigue en el
// log y no puntúa.
export function PanelDelForoParaElModerador({ estado, presencia, programa, publicar }) {
  const [orden, setOrden] = useState(ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO);

  const hilos = ordenarHilos(construirHilos(estado, { incluirOcultos: true }), orden);
  const resumen = resumirReaccionesDelForo(estado);

  function ocultar(aporte) {
    publicar(EVENTOS.APORTE_OCULTADO, { argumentId: aporte.argumentId, porId: 'host', motivo: '' });
  }

  function restaurar(aporte) {
    publicar(EVENTOS.APORTE_RESTAURADO, { argumentId: aporte.argumentId, porId: 'host' });
  }

  function renderAcciones(aporte) {
    return aporte.oculto ? (
      <button type="button" onClick={() => restaurar(aporte)}>
        👁️ Restaurar
      </button>
    ) : (
      <button type="button" onClick={() => ocultar(aporte)}>
        🙈 Ocultar
      </button>
    );
  }

  return (
    <section className="tarjeta-de-fase">
      <h3>Foro en vivo</h3>
      <FranjaDeMetricas estado={estado} />

      <p className="texto-de-ayuda">
        Reacciones:{' '}
        {Object.entries(resumen.totalPorTipo)
          .map(([tipo, cantidad]) => `${ETIQUETA_DE_REACCION[tipo]} ${cantidad}`)
          .join(' · ')}
        {' · '}
        <strong>Convencimiento cruzado: {resumen.convencimientoCruzado}</strong>
      </p>
      <p className="texto-de-ayuda">
        El convencimiento cruzado cuenta los «me convenció» de quienes defienden la postura contraria. Solo lo ves tú y
        no da puntos.
      </p>

      <div className="orden-de-hilos">
        <label>
          Orden{' '}
          <select value={orden} onChange={(evento) => setOrden(evento.target.value)}>
            <option value={ORDENES_DE_HILOS.SIN_DEBATIR_PRIMERO}>Sin debatir primero</option>
            <option value={ORDENES_DE_HILOS.RECIENTES}>Lo más reciente primero</option>
          </select>
        </label>
      </div>

      <ListaDeHilos
        hilos={hilos}
        estado={estado}
        presencia={presencia}
        programa={programa}
        renderAcciones={renderAcciones}
        verSugerenciasDeIA
        mensajeVacio="Todavía no hay posts."
      />
    </section>
  );
}
