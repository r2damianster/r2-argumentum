import { nombreDeParticipante } from '../../estado/seleccionesDerivadas.js';

const MEDALLA_POR_LUGAR = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Los primeros lugares del control de lectura. Nunca muestra notas: solo quién ocupa cada lugar. Un
// empate exacto comparte lugar.
export function PodioDelControlDeLectura({ estado, presencia, participantId = null }) {
  const lugares = estado.lectura?.podio;
  if (!lugares) {
    return null;
  }

  const estoyEnElPodio = lugares.some((lugar) => lugar.participantIds.includes(participantId));

  return (
    <section className="podio-del-control-de-lectura">
      <h3>🏆 Podio</h3>
      {lugares.length === 0 ? (
        <p className="texto-de-ayuda">Esta vez no hubo calificaciones para armar el podio.</p>
      ) : (
        <ol className="lugares-del-podio">
          {lugares.map((lugar) => (
            <li key={lugar.lugar}>
              <span className="medalla-de-posicion">{MEDALLA_POR_LUGAR[lugar.lugar] ?? `${lugar.lugar}.º`}</span>
              <span>
                {lugar.participantIds.map((id) => {
                  return (
                    <span key={id} className={id === participantId ? 'nombre-en-el-podio nombre-en-el-podio--propio' : 'nombre-en-el-podio'}>
                      {nombreDeParticipante(presencia, id)}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
      {participantId && !estoyEnElPodio && lugares.length > 0 && (
        <p className="texto-de-ayuda">Gracias por participar. La nota es una conversación con tu docente: revisa los comentarios que recibiste.</p>
      )}
    </section>
  );
}
