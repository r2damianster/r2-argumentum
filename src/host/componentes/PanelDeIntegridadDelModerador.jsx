import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import { agruparSenalesPorParticipante } from '../../shared/nucleo/integridad/canalPrivado.js';
import { ETIQUETA_DE_GRAVEDAD, ETIQUETA_DE_SENAL } from '../../shared/nucleo/integridad/recolectorDeSenales.js';
import { NIVELES_DE_REVISION_DE_APORTE } from '../../shared/puntaje/puntajeDeAportes.js';

const ETIQUETA_DEL_CONTEXTO = {
  foro: 'en el foro',
  ingreso: 'en su argumento de ingreso',
  preparacion: 'al preparar un argumento',
  contraargumento_de_oyente: 'en un contraargumento de oyente',
};

// Lo que registró la integridad, solo para el moderador (los participantes no pueden leer este
// canal). Cada marca muestra la EVIDENCIA, no una acusación: es una advertencia que tú valoras. En el
// foro puedes decidir que ese aporte no cuente.
export function PanelDeIntegridadDelModerador({ estado, presencia, registros, esForo, publicar }) {
  const grupos = agruparSenalesPorParticipante(registros);

  function noContarElAporte(argumentId) {
    publicar(EVENTOS.REVISION_DECIDIDA_POR_MODERADOR, {
      argumentId,
      decision: 'evaluada',
      nivel: NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA,
    });
  }

  return (
    <section className="tarjeta-de-avisos">
      <h3>🛡️ Integridad (solo tú ves esto)</h3>
      <p className="texto-de-ayuda">
        Son señales, no pruebas: el dictado por voz, el autocorrector y el uso del celular pueden generarlas. Decide tú
        qué hacer con cada una.
      </p>

      {grupos.length === 0 ? (
        <p className="texto-de-ayuda">Todavía no hay señales registradas.</p>
      ) : (
        <ul className="lista-de-avisos">
          {grupos.map((grupo) => (
            <li key={grupo.participantId} className={grupo.gravedadMaxima === 'alta' ? 'aviso-alto' : ''}>
              <strong>
                {nombreDeParticipante(presencia, grupo.participantId)} · gravedad {ETIQUETA_DE_GRAVEDAD[grupo.gravedadMaxima].toLowerCase()} ·{' '}
                {grupo.registros.length} envío(s) con señales
              </strong>
              <ul>
                {grupo.registros.map((registro) => {
                  const aporte = registro.argumentId ? estado.argumentos[registro.argumentId] : null;
                  return (
                    <li key={registro.idDelMensaje}>
                      <p className="texto-de-ayuda">
                        {ETIQUETA_DEL_CONTEXTO[registro.contexto] ?? 'Al escribir'}
                        {registro.advertenciaMostrada ? ' · se le advirtió y envió igual' : ''}
                      </p>
                      <ul>
                        {registro.senales.map((senal, indice) => (
                          <li key={`${senal.tipo}-${indice}`}>
                            {ETIQUETA_DE_SENAL[senal.tipo] ?? senal.tipo} ({ETIQUETA_DE_GRAVEDAD[senal.gravedad]}): {senal.detalle}
                          </li>
                        ))}
                      </ul>
                      {aporte && <blockquote className="cita-de-argumento">{aporte.texto}</blockquote>}
                      {esForo && aporte && !aporte.oculto && (
                        <div className="botonera-de-bid">
                          <button type="button" className="boton-peligro" onClick={() => noContarElAporte(aporte.argumentId)}>
                            Que este aporte no cuente
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
