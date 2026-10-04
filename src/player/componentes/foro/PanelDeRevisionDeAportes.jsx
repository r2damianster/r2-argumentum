import { useState } from 'react';
import { EVENTOS } from '../../../shared/eventos/nombresDeEventos.js';
import { nombreDeParticipante } from '../../../shared/estado/seleccionesDerivadas.js';
import {
  listarAportesParaRevisar,
  listarAportesYaRevisados,
} from '../../../shared/nucleo/revision/colaDeRevision.js';
import {
  ETIQUETA_DE_NIVEL_DE_REVISION,
  NIVELES_DE_REVISION_DE_APORTE,
} from '../../../shared/puntaje/puntajeDeAportes.js';
import { SugerenciaDeIA } from '../../../shared/componentes/foro/SugerenciaDeIA.jsx';

const NIVELES_EN_ORDEN_DE_BOTONES = [
  NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO,
  NIVELES_DE_REVISION_DE_APORTE.PARCIAL,
  NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA,
];

const CLASE_DEL_BOTON_POR_NIVEL = {
  [NIVELES_DE_REVISION_DE_APORTE.CUENTA_COMPLETO]: 'boton-exito',
  [NIVELES_DE_REVISION_DE_APORTE.PARCIAL]: 'boton-secundario',
  [NIVELES_DE_REVISION_DE_APORTE.NO_CUENTA]: 'boton-peligro',
};

function BotonesDeNivel({ nivelActual, onElegir }) {
  return (
    <div className="botonera-de-bid">
      {NIVELES_EN_ORDEN_DE_BOTONES.map((nivel) => (
        <button
          key={nivel}
          type="button"
          className={CLASE_DEL_BOTON_POR_NIVEL[nivel]}
          aria-pressed={nivelActual === nivel}
          onClick={() => onElegir(nivel)}
        >
          {nivelActual === nivel ? '✔ ' : ''}
          {ETIQUETA_DE_NIVEL_DE_REVISION[nivel]}
        </button>
      ))}
    </div>
  );
}

// Cola de revisión del co-moderador durante el foro. Decide si cada aporte cuenta, cuenta parcial o no
// cuenta; la IA solo sugiere y el moderador tiene la última palabra. Por defecto ve los aportes que
// le tocan (cada uno se reparte entre 2 co-moderadores) y puede pedir ver los demás.
export function PanelDeRevisionDeAportes({ estado, presencia, participantId, publicar }) {
  const [verTambienLosDeOtros, setVerTambienLosDeOtros] = useState(false);
  const [verRevisados, setVerRevisados] = useState(false);

  const porRevisar = listarAportesParaRevisar(estado, { revisorId: participantId, soloLosMios: !verTambienLosDeOtros });
  const yaRevisados = listarAportesYaRevisados(estado, { revisorId: participantId });

  function decidir(argumentId, nivel) {
    publicar(EVENTOS.REVISION_REGISTRADA, { argumentId, revisorId: participantId, nivel });
  }

  return (
    <section className="tarjeta-de-co-moderador">
      <h3>Revisión de aportes</h3>
      <p className="texto-de-ayuda">
        Decide si cada aporte <strong>cuenta</strong>, <strong>cuenta parcial</strong> o <strong>no cuenta</strong>. Juzga
        la estructura (afirmación y razón), no si estás de acuerdo con la postura. La IA solo sugiere. Tu puntaje depende
        de cuánto revisas y de qué tanto coincide tu criterio con el del grupo y el del moderador.
      </p>

      {porRevisar.length === 0 ? (
        <p className="texto-de-ayuda">No tienes aportes pendientes por ahora.</p>
      ) : (
        <ul className="lista-de-validaciones-pendientes">
          {porRevisar.map(({ aporte, asignadoAMi }) => (
            <li key={aporte.argumentId}>
              <p>
                <strong>{nombreDeParticipante(presencia, aporte.participantId)}</strong>
                {!asignadoAMi && <span className="texto-de-ayuda"> · no te tocaba, pero puedes revisarlo</span>}
              </p>
              <blockquote className="cita-de-argumento">{aporte.texto}</blockquote>
              <SugerenciaDeIA sugerencia={aporte.sugerenciaDeIA} />
              <BotonesDeNivel nivelActual={null} onElegir={(nivel) => decidir(aporte.argumentId, nivel)} />
            </li>
          ))}
        </ul>
      )}

      <div className="botonera-de-bid">
        <button type="button" className="boton-secundario" onClick={() => setVerTambienLosDeOtros((ver) => !ver)}>
          {verTambienLosDeOtros ? 'Ver solo los que me tocan' : 'Ver también los que no me tocan'}
        </button>
        {yaRevisados.length > 0 && (
          <button type="button" className="boton-secundario" onClick={() => setVerRevisados((ver) => !ver)}>
            {verRevisados ? 'Ocultar lo revisado' : `Lo que ya revisé (${yaRevisados.length})`}
          </button>
        )}
      </div>

      {verRevisados && (
        <ul className="lista-de-validaciones-pendientes">
          {yaRevisados.map(({ aporte, miNivel }) => (
            <li key={aporte.argumentId}>
              <p>
                <strong>{nombreDeParticipante(presencia, aporte.participantId)}</strong>
              </p>
              <blockquote className="cita-de-argumento">{aporte.texto}</blockquote>
              <p className="texto-de-ayuda">Tu decisión: {ETIQUETA_DE_NIVEL_DE_REVISION[miNivel]}. Puedes cambiarla.</p>
              <BotonesDeNivel nivelActual={miNivel} onElegir={(nivel) => decidir(aporte.argumentId, nivel)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
