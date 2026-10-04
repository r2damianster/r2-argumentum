import { useState } from 'react';
import { etiquetaDelNivel } from '../../../shared/nucleo/rubrica/rubrica.js';
import { DECISIONES_SOBRE_UNA_REVISION } from '../../../shared/nucleo/entregas/revisionesEntrePares.js';

const ETIQUETA_DE_LA_DECISION = {
  [DECISIONES_SOBRE_UNA_REVISION.PENDIENTE]: 'Pendiente de tu decisión',
  [DECISIONES_SOBRE_UNA_REVISION.APROBADA]: 'Aprobada: llega al autor',
  [DECISIONES_SOBRE_UNA_REVISION.DESCARTADA]: 'Descartada: no llega al autor y no suma puntos',
};

function RevisionDeUnPar({ revision, rubrica, guardando, alModerar, numero }) {
  const inicial = revision.paraElAutor ?? { comentariosPorCriterio: revision.comentariosPorCriterio, comentarioGeneral: revision.comentarioGeneral };
  const [comentarios, setComentarios] = useState(inicial.comentariosPorCriterio);
  const [comentarioGeneral, setComentarioGeneral] = useState(inicial.comentarioGeneral);

  function decidir(estado) {
    alModerar(revision.revisorId, { estado, comentariosPorCriterio: comentarios, comentarioGeneral });
  }

  return (
    <li className="revision-de-un-par">
      <p>
        <strong>Revisión de un compañero {numero}</strong> <span className="texto-de-ayuda">· {ETIQUETA_DE_LA_DECISION[revision.decision]}</span>
      </p>
      <ul className="niveles-sugeridos">
        {rubrica.map((criterio) => (
          <li key={criterio.id}>
            {criterio.nombre}: <strong>{revision.niveles[criterio.id] ? etiquetaDelNivel(revision.niveles[criterio.id]) : '—'}</strong>
          </li>
        ))}
      </ul>
      <p className="texto-de-ayuda">Lo que llegará al autor (puedes editarlo; los niveles no llegan):</p>
      {rubrica.map((criterio) => (
        <label key={criterio.id}>
          {criterio.nombre}
          <textarea
            rows={2}
            value={comentarios[criterio.id] ?? ''}
            onChange={(evento) => setComentarios((actuales) => ({ ...actuales, [criterio.id]: evento.target.value }))}
          />
        </label>
      ))}
      <label>
        Comentario general
        <textarea rows={2} value={comentarioGeneral} onChange={(evento) => setComentarioGeneral(evento.target.value)} />
      </label>
      <div className="botonera-de-bid">
        <button type="button" className="boton-exito" disabled={guardando} onClick={() => decidir('aprobada')}>
          {revision.decision === DECISIONES_SOBRE_UNA_REVISION.APROBADA ? 'Guardar cambios' : 'Aprobar'}
        </button>
        {revision.decision !== DECISIONES_SOBRE_UNA_REVISION.DESCARTADA && (
          <button type="button" className="boton-peligro" disabled={guardando} onClick={() => decidir('descartada')}>
            Descartar
          </button>
        )}
      </div>
    </li>
  );
}

// Las revisiones que un compañero hizo del texto que el docente tiene abierto. El docente decide qué
// llega al autor: nada pasa sin su aprobación (docs/14-control-de-lectura.md).
export function RevisionesDeParesDeUnaEntrega({ revisiones, rubrica, guardando, alModerar }) {
  if (revisiones.length === 0) {
    return null;
  }
  return (
    <div className="revisiones-de-pares-de-la-entrega">
      <h4>Revisiones de compañeros ({revisiones.length})</h4>
      <ul className="lista-de-revisiones-de-pares">
        {revisiones.map((revision, indice) => (
          <RevisionDeUnPar
            key={revision.revisorId}
            numero={indice + 1}
            revision={revision}
            rubrica={rubrica}
            guardando={guardando}
            alModerar={alModerar}
          />
        ))}
      </ul>
    </div>
  );
}
