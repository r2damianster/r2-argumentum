import { IDIOMAS_DEL_DEBATE, resolverIdiomaDelDebate } from '../../../shared/programa/idiomaDelDebate.js';
import {
  describirLaEstructuraPedida,
} from '../../../shared/nucleo/escritura/estructurasDeEscritura.js';
import {
  ETIQUETA_DEL_NIVEL_DE_INTEGRIDAD,
  resolverNivelDeIntegridad,
} from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { resolverRubricaDelPrograma } from '../../../shared/nucleo/rubrica/rubrica.js';
import {
  resolverDuracionDeLaEscrituraMin,
  resolverVentanaDeConfirmacionMin,
} from '../../../actividades/controlDeLectura/programaDeLectura.js';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';

// La sala de espera del control de lectura: la consigna y lo que quedó configurado, más quiénes ya
// entraron. No hay marcador ni posturas.
export function ResumenDeConfiguracionDeLectura({ estado, presencia, programa, onModificarConfiguracion }) {
  const idioma = resolverIdiomaDelDebate(programa);
  const confirmados = Object.values(estado.participantes).filter((participante) => participante.ingresoConfirmado);
  const nombreDe = (participantId) => {
    const presente = presencia.find((candidato) => candidato.participantId === participantId);
    return `${presente?.emoji ?? ''} ${presente?.nombre ?? participantId}`.trim();
  };

  return (
    <>
      <GuiaDeLaConsigna programa={programa} />

      <div className="tarjeta-resumen-configuracion">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <p className="texto-de-ayuda" style={{ fontWeight: 'bold', margin: 0 }}>
            ⚙️ Configuración activa
          </p>
          {onModificarConfiguracion && (
            <button type="button" className="boton-cambiar-programa" onClick={onModificarConfiguracion}>
              ✏️ Modificar configuración
            </button>
          )}
        </div>
        <ul className="texto-de-ayuda">
          <li>
            <strong>Escritura:</strong> {resolverDuracionDeLaEscrituraMin(programa)} minutos
          </li>
          <li>
            <strong>Estructura:</strong> {describirLaEstructuraPedida(programa, idioma)}
          </li>
          <li>
            <strong>Idioma:</strong> {(IDIOMAS_DEL_DEBATE[idioma] ?? IDIOMAS_DEL_DEBATE.es).etiqueta}
          </li>
          <li>
            <strong>Rúbrica:</strong> {resolverRubricaDelPrograma(programa).length} criterios
          </li>
          <li>
            <strong>Revisión entre pares:</strong>{' '}
            {programa.revisionDePares?.activa
              ? `${programa.revisionDePares.revisionesPorPersona} texto(s) por persona, ${programa.revisionDePares.duracionMin} minutos`
              : 'no'}
          </li>
          <li>
            <strong>Ventana de confirmación:</strong> {resolverVentanaDeConfirmacionMin(programa)} minutos
          </li>
          <li>
            <strong>Integridad:</strong> {ETIQUETA_DEL_NIVEL_DE_INTEGRIDAD[resolverNivelDeIntegridad(programa)]}
          </li>
        </ul>
      </div>

      <section className="tarjeta-de-participantes">
        <p className="texto-de-ayuda">En la sala ({confirmados.length} ya entraron)</p>
        <ul className="lista-de-participantes">
          {confirmados.map((participante) => (
            <li key={participante.participantId}>
              <span className="nombre-de-participante">{nombreDe(participante.participantId)}</span>
            </li>
          ))}
        </ul>
        {confirmados.length === 0 && <p className="texto-de-ayuda">Todavía nadie confirmó su ingreso.</p>}
      </section>
    </>
  );
}
