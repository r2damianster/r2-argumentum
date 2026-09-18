import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { obtenerArgumentosSinValidar, obtenerBidsAbiertos } from '../../shared/estado/seleccionesDerivadas.js';

const ETIQUETA_DE_TIPO = {
  [TIPOS_DE_RELACION.NUEVO]: 'Argumento nuevo',
  [TIPOS_DE_RELACION.CONTRAARGUMENTO]: 'Contraargumento',
  [TIPOS_DE_RELACION.REFUERZO]: 'Refuerzo',
  [TIPOS_DE_RELACION.DILEMA]: 'Dilema',
  [TIPOS_DE_RELACION.PREGUNTA]: 'Pregunta',
  [TIPOS_DE_RELACION.CONCESION]: 'Concesión',
};

function FilaDeValidacion({ argumento, participantId, publicar }) {
  const [tipoFinal, setTipoFinal] = useState(argumento.tipoDeclarado);
  const [nota, setNota] = useState('');
  const [faltaMarcada, setFaltaMarcada] = useState(false);

  function confirmar() {
    publicar(EVENTOS.ARGUMENTO_VALIDADO, {
      argumentId: argumento.argumentId,
      coModeradorId: participantId,
      tipoFinal,
      puntajeAsignado: null,
      nota,
      faltaMarcada,
    });
  }

  return (
    <li>
      <p>{argumento.texto}</p>
      {argumento.viaCoModerador && <p className="texto-de-ayuda">⚠️ Escaló tras agotar intentos con Groq</p>}
      <label>
        Tipo confirmado
        <select value={tipoFinal} onChange={(evento) => setTipoFinal(evento.target.value)}>
          {Object.entries(ETIQUETA_DE_TIPO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nota (opcional, obligatoria si marcás falta)
        <input value={nota} onChange={(evento) => setNota(evento.target.value)} />
      </label>
      <label className="casilla-de-falta">
        <input type="checkbox" checked={faltaMarcada} onChange={(evento) => setFaltaMarcada(evento.target.checked)} />
        Marcar falta
      </label>
      <button type="button" onClick={confirmar}>
        Confirmar validación
      </button>
    </li>
  );
}

export function PanelDeCoModerador({ estado, participantId, publicar }) {
  const argumentosSinValidar = obtenerArgumentosSinValidar(estado);
  const bidsAbiertos = obtenerBidsAbiertos(estado);

  function votar(bidId, voto) {
    publicar(EVENTOS.BID_VOTO_COMODERADOR, { bidId, coModeradorId: participantId, voto });
  }

  return (
    <section className="tarjeta-de-co-moderador">
      <h3>Panel de co-moderador</h3>

      {bidsAbiertos.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Evalúa el argumento, no la postura — tu voto es anónimo, nadie ve quién votó qué (ni el moderador).
          </p>
          <p className="texto-de-ayuda">Bids abiertos — votá aprobar/rechazar</p>
          <ul className="lista-de-bids-pendientes">
            {bidsAbiertos.map((bid) => (
              <li key={bid.bidId}>
                <p>
                  {bid.tipoDeBid}: "{bid.texto.slice(0, 60)}…"
                </p>
                <div className="botonera-de-bid">
                  <button type="button" onClick={() => votar(bid.bidId, 'aprueba')}>
                    Aprueba
                  </button>
                  <button type="button" className="boton-cambiar-programa" onClick={() => votar(bid.bidId, 'rechaza')}>
                    Rechaza
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {argumentosSinValidar.length > 0 && (
        <div>
          <p className="texto-de-ayuda">
            Confirma si el tipo es correcto y marca falta solo si corresponde — no evalúes si estás de acuerdo
            con la postura.
          </p>
          <p className="texto-de-ayuda">Argumentos por validar</p>
          <ul className="lista-de-validaciones-pendientes">
            {argumentosSinValidar.map((argumento) => (
              <FilaDeValidacion
                key={argumento.argumentId}
                argumento={argumento}
                participantId={participantId}
                publicar={publicar}
              />
            ))}
          </ul>
        </div>
      )}

      {argumentosSinValidar.length === 0 && bidsAbiertos.length === 0 && (
        <p className="texto-de-ayuda">Nada pendiente por ahora.</p>
      )}
    </section>
  );
}
