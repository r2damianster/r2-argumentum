import { useState } from 'react';
import { ETIQUETA_DE_SENAL } from '../../../shared/nucleo/integridad/recolectorDeSenales.js';
import { ETIQUETA_DE_LA_BANDA, ORIGENES_DE_SIMILITUD } from '../../../shared/nucleo/integridad/similitudDeTextos.js';
import {
  ACCIONES_SOBRE_UNA_MARCA,
  DESCUENTO_MAXIMO,
  hayAlgoQueRevisar,
} from '../../../shared/nucleo/entregas/integridadDeLasEntregas.js';

const TEXTO_DEL_ORIGEN = {
  [ORIGENES_DE_SIMILITUD.OTRA_ENTREGA]: 'otra entrega de la sala',
  [ORIGENES_DE_SIMILITUD.TEXTO_DE_REFERENCIA]: 'el texto de la lectura',
  [ORIGENES_DE_SIMILITUD.EJEMPLO]: 'un ejemplo del Programa',
};

const ETIQUETA_DE_LA_ACCION = {
  [ACCIONES_SOBRE_UNA_MARCA.DESCARTADA]: 'Descartar la marca (no pasó nada)',
  [ACCIONES_SOBRE_UNA_MARCA.OBSERVADA]: 'Dejar una observación (no cambia la nota)',
  [ACCIONES_SOBRE_UNA_MARCA.DESCUENTO]: 'Aplicar un descuento a la nota',
};

// Las advertencias de integridad de una entrega, para el docente (docs/14-control-de-lectura.md). Son
// advertencias con sus datos a la vista, no pruebas: decide él qué hacer, y el descuento es manual, con
// motivo. Nunca hay sanción automática ni nulidad.
export function MarcasDeIntegridadDeUnaEntrega({ integridad, decision, guardando, alDecidir }) {
  const [accion, setAccion] = useState(decision?.accion ?? ACCIONES_SOBRE_UNA_MARCA.DESCARTADA);
  const [observacion, setObservacion] = useState(decision?.observacion ?? '');
  const [descuento, setDescuento] = useState(decision?.descuento ?? 0);

  if (!hayAlgoQueRevisar(integridad) && !decision) {
    return null;
  }

  const { similitud, senales } = integridad;
  const descuentoValido = accion !== ACCIONES_SOBRE_UNA_MARCA.DESCUENTO || (Number(descuento) > 0 && observacion.trim().length > 0);

  return (
    <div className={`marcas-de-integridad marcas-de-integridad--${integridad.banda}`}>
      <p>
        <strong>🛡️ Integridad: {ETIQUETA_DE_LA_BANDA[integridad.banda]}</strong>{' '}
        <span className="texto-de-ayuda">· es una advertencia, no una prueba. Decides tú.</span>
      </p>

      {similitud && similitud.porcentaje > 0 && (
        <div>
          <p>
            Parecido: <strong>{similitud.porcentaje} %</strong> de este texto coincide con {TEXTO_DEL_ORIGEN[similitud.origen]}
            {similitud.origen === ORIGENES_DE_SIMILITUD.OTRA_ENTREGA ? ` (${similitud.conQuien})` : ''}.
          </p>
          {similitud.fragmentos.length > 0 && (
            <ul className="fragmentos-coincidentes">
              {similitud.fragmentos.map((fragmento) => (
                <li key={fragmento}>«{fragmento}»</li>
              ))}
            </ul>
          )}
          {similitud.coincidencias.length > 1 && (
            <p className="texto-de-ayuda">
              También coincide con: {similitud.coincidencias.slice(1).map((coincidencia) => `${coincidencia.conQuien} (${coincidencia.porcentaje} %)`).join(', ')}.
            </p>
          )}
        </div>
      )}

      {senales.length > 0 && (
        <ul className="senales-de-redaccion">
          {senales.map((senal, indice) => (
            <li key={`${senal.tipo}-${indice}`}>
              {ETIQUETA_DE_SENAL[senal.tipo] ?? senal.tipo} ({senal.gravedad}): {senal.detalle}
            </li>
          ))}
        </ul>
      )}
      {senales.length > 0 && (
        <p className="texto-de-ayuda">
          El dictado por voz, el autocorrector y escribir desde el celular pueden generar señales. Conversa con la persona antes de actuar.
        </p>
      )}

      <fieldset className="decision-de-integridad">
        <legend>¿Qué decides?</legend>
        {Object.values(ACCIONES_SOBRE_UNA_MARCA).map((valor) => (
          <label key={valor}>
            <input type="radio" name="accion-de-integridad" checked={accion === valor} onChange={() => setAccion(valor)} />
            {ETIQUETA_DE_LA_ACCION[valor]}
          </label>
        ))}
        {accion !== ACCIONES_SOBRE_UNA_MARCA.DESCARTADA && (
          <label>
            {accion === ACCIONES_SOBRE_UNA_MARCA.DESCUENTO ? 'Motivo del descuento (obligatorio)' : 'Observación'}
            <textarea rows={2} value={observacion} onChange={(evento) => setObservacion(evento.target.value)} />
          </label>
        )}
        {accion === ACCIONES_SOBRE_UNA_MARCA.DESCUENTO && (
          <label>
            Puntos a descontar (0 a {DESCUENTO_MAXIMO})
            <input
              type="number"
              min="0"
              max={DESCUENTO_MAXIMO}
              step="0.5"
              value={descuento}
              onChange={(evento) => setDescuento(evento.target.value)}
            />
          </label>
        )}
        <div className="botonera-de-bid">
          <button
            type="button"
            className="boton-secundario"
            disabled={guardando || !descuentoValido}
            onClick={() => alDecidir({ accion, observacion, descuento: Number(descuento) || 0 })}
          >
            Guardar decisión
          </button>
        </div>
        {decision && <p className="texto-de-ayuda">Decisión guardada: {ETIQUETA_DE_LA_ACCION[decision.accion]}.</p>}
      </fieldset>
    </div>
  );
}
