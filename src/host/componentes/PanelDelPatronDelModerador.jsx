import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import { MODOS_DEL_PATRON } from '../../shared/nucleo/patronesDeEscritura/patronDeArgumento.js';

// Qué partes del patrón de escritura detectó la IA en cada argumento. Solo lo ve el moderador (canal privado).
// Es una sugerencia, no una nota: ayuda a decidir y no suma ni resta puntos.
export function PanelDelPatronDelModerador({ estado, presencia, sugerencias, modo, nombreDelPatron }) {
  const esEvaluacion = modo === MODOS_DEL_PATRON.SIN_RETROALIMENTACION;
  const ordenadas = [...sugerencias].sort((una, otra) => otra.enviadoEn - una.enviadoEn);

  return (
    <section className="tarjeta-de-avisos">
      <h3>🧩 Patrón de escritura: {nombreDelPatron} (solo tú ves esto)</h3>
      <p className="texto-de-ayuda">
        {esEvaluacion
          ? 'Modo evaluación: las personas no reciben sugerencias sobre el patrón. '
          : 'Modo práctica: cada persona recibe además su propia sugerencia. '}
        La IA solo sugiere qué partes reconoció; decide tú. No suma ni resta puntos.
      </p>
      {ordenadas.length === 0 ? (
        <p className="texto-de-ayuda">Todavía no hay argumentos revisados con el patrón.</p>
      ) : (
        <ul className="lista-de-avisos">
          {ordenadas.map((sugerencia) => {
            const argumento = estado.argumentos[sugerencia.argumentId];
            const total = sugerencia.partesPresentes.length + sugerencia.partesFaltantes.length;
            return (
              <li key={sugerencia.idDelMensaje}>
                <strong>
                  {nombreDeParticipante(presencia, sugerencia.participantId)} · {sugerencia.partesPresentes.length} de {total} partes
                </strong>
                {argumento && (
                  <p className="texto-de-ayuda">
                    «{argumento.texto.slice(0, 120)}
                    {argumento.texto.length > 120 ? '…' : ''}»
                  </p>
                )}
                <p>
                  ✅ {sugerencia.partesPresentes.join(', ') || '—'}
                  {sugerencia.partesFaltantes.length > 0 && <> · ➖ Falta: {sugerencia.partesFaltantes.join(', ')}</>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
