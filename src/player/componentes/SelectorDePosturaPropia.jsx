import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';

export function SelectorDePosturaPropia({ programa, participantId, publicar }) {
  function elegir(posturaId) {
    publicar(EVENTOS.POSTURA_ASIGNADA, { participantId, stanceId: posturaId, metodo: 'libre' });
  }

  return (
    <section className="tarjeta-de-postura-propia">
      <p className="texto-de-ayuda">Elige la postura que vas a defender en este debate:</p>
      <ul className="lista-de-posturas-para-elegir">
        {programa.posturas.map((postura) => (
          <li key={postura.id}>
            <button type="button" onClick={() => elegir(postura.id)} style={{ borderColor: postura.color }}>
              <span style={{ color: postura.color }}>{postura.etiqueta}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
