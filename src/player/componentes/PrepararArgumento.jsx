import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { siguientePosicionParaParticipante } from '../../shared/estado/seleccionesDerivadas.js';

const TIPOS_QUE_REQUIEREN_OBJETIVO = [
  TIPOS_DE_RELACION.CONTRAARGUMENTO,
  TIPOS_DE_RELACION.REFUERZO,
  TIPOS_DE_RELACION.DILEMA,
  TIPOS_DE_RELACION.CONEXION,
];

const ETIQUETA_DE_TIPO = {
  [TIPOS_DE_RELACION.NUEVO]: 'Argumento nuevo',
  [TIPOS_DE_RELACION.CONTRAARGUMENTO]: 'Contraargumento',
  [TIPOS_DE_RELACION.REFUERZO]: 'Refuerzo',
  [TIPOS_DE_RELACION.DILEMA]: 'Dilema',
  [TIPOS_DE_RELACION.PREGUNTA]: 'Pregunta',
  [TIPOS_DE_RELACION.CONCESION]: 'Concesión',
};

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Se escribe DURANTE el debate, mientras otros hablan, y queda esperando turno. Solo quien
// tiene un argumento preparado entra a la ruleta (docs/04) — el turno sirve para defenderlo,
// no para empezar a escribirlo contra reloj.
//
// El borrador vive en el cliente y se revisa con Groq por HTTP: no se publica nada al canal
// hasta que el argumento queda aprobado, así corregirlo no cuesta cuota de Ably.
export function PrepararArgumento({ estado, programa, participantId, publicar }) {
  const [tipoDeclarado, setTipoDeclarado] = useState(TIPOS_DE_RELACION.NUEVO);
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState('');
  const [texto, setTexto] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const requiereObjetivo = TIPOS_QUE_REQUIEREN_OBJETIVO.includes(tipoDeclarado);
  const argumentosExistentes = Object.values(estado.argumentos);
  const posicionEnRonda = siguientePosicionParaParticipante(estado, participantId);
  const yaTengoUnoListo = Boolean(estado.participantes[participantId]?.argumentoListo);
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;

  async function revisarYPreparar() {
    if (!texto.trim() || (requiereObjetivo && !argumentoObjetivoId)) {
      return;
    }
    setRevisando(true);

    let respuesta;
    try {
      const peticion = await fetch('/api/groq-validar-argumento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ejemplos: programa.ejemplosPorTema, posturas: programa.posturas }),
      });
      respuesta = peticion.ok
        ? await peticion.json()
        : { aprobado: false, motivo: 'El validador no respondió, inténtalo de nuevo.' };
    } catch {
      respuesta = { aprobado: false, motivo: 'No se pudo validar (error de conexión).' };
    }

    const decision = decidirValidacion({
      resultadoDeGroq: respuesta,
      stanceElegido: stanceId,
      permitirPosturasNuevas: Boolean(programa.permitirPosturasNuevas),
      posturas: programa.posturas,
      permiteCambioDePostura: programa.asignacionPostura === 'libre',
    });
    setResultado(decision);

    if (decision.decision === DECISIONES.APROBADO) {
      // Solo se anuncia que hay un argumento listo; el texto se publica al exponerlo.
      publicar(EVENTOS.ARGUMENTO_LISTO, { participantId, listoEn: Date.now() });
    }
    setRevisando(false);
  }

  // Al llegar el turno, el texto ya revisado se publica tal cual: no se vuelve a validar.
  function exponerArgumento(turnId) {
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId: generarId('argumento'),
      participantId,
      turnId,
      ronda: estado.fase.actual?.ronda ?? 1,
      posicionEnRonda,
      tipoDeclarado,
      argumentoObjetivoId: requiereObjetivo ? argumentoObjetivoId : null,
      texto,
      stanceId,
      viaCoModerador: false,
    });
    setTexto('');
    setResultado(null);
  }

  const turnoEnCurso = estado.turnos.turnoEnCurso;
  const tengoLaPalabra = turnoEnCurso?.participantId === participantId && turnoEnCurso?.modo !== 'verbal';

  if (tengoLaPalabra && yaTengoUnoListo) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="texto-de-ayuda">
          Tienes la palabra. Defiende en voz alta el argumento que preparaste y, cuando termines, publícalo para
          que quede en el mapa.
        </p>
        <blockquote className="cita-de-argumento">{texto}</blockquote>
        <button type="submit" onClick={() => exponerArgumento(turnoEnCurso.turnId)}>
          Ya lo expuse, publicarlo en el mapa
        </button>
      </section>
    );
  }

  if (yaTengoUnoListo) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="mensaje-de-exito">✅ Tu argumento está listo y esperando turno.</p>
        <blockquote className="cita-de-argumento">{texto}</blockquote>
        <p className="texto-de-ayuda">
          Entraste a la ruleta: en cualquier momento te pueden dar la palabra para defenderlo.
        </p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-formulario-de-argumento">
      <p className="texto-de-ayuda">
        Prepara tu próximo argumento mientras escuchas a los demás. Cuando quede aprobado entras a la ruleta, y
        el turno será para defenderlo en voz alta. Sin argumento preparado no se te ofrece la palabra.
      </p>
      <p className="texto-de-ayuda">Sería tu posición {posicionEnRonda}</p>

      <label>
        Tipo
        <select value={tipoDeclarado} onChange={(evento) => setTipoDeclarado(evento.target.value)}>
          {Object.entries(ETIQUETA_DE_TIPO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      {requiereObjetivo && (
        <label>
          Argumento al que apunta
          <select value={argumentoObjetivoId} onChange={(evento) => setArgumentoObjetivoId(evento.target.value)}>
            <option value="">Elige uno…</option>
            {argumentosExistentes.map((argumento) => (
              <option key={argumento.argumentId} value={argumento.argumentId}>
                {argumento.texto.slice(0, 50)}…
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Tu argumento
        <textarea
          value={texto}
          rows={4}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setResultado(null);
          }}
        />
      </label>

      {resultado && resultado.decision !== DECISIONES.APROBADO && (
        <div className="aviso-de-validacion">
          <p className="mensaje-de-error">{resultado.mensaje}</p>
          {resultado.sugerencia && <p className="texto-de-ayuda">{resultado.sugerencia}</p>}
        </div>
      )}

      <button type="button" disabled={revisando || !texto.trim()} onClick={revisarYPreparar}>
        {revisando ? 'Revisando…' : 'Revisar y ponerme en la ruleta'}
      </button>
    </section>
  );
}
