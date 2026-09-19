import { useEffect, useRef, useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { buscarArgumentoParecido } from '../../shared/argumentos/buscarArgumentoParecido.js';
import { nombreDeParticipante, siguientePosicionParaParticipante } from '../../shared/estado/seleccionesDerivadas.js';

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

// El borrador se guarda en el navegador: quien cierra la pestaña por error (o refresca) en medio
// del debate recupera lo que había escrito. Sin esto, si el cierre ocurría con el argumento ya
// aprobado y esperando turno, al volver el sistema seguía diciendo "tu argumento está listo"
// pero el texto ya no existía, y al llegarle la palabra no había nada que defender ni publicar.
function claveDelBorrador(participantId) {
  return `r2-argumentum-borrador:${participantId}`;
}

function leerBorrador(participantId) {
  try {
    return JSON.parse(localStorage.getItem(claveDelBorrador(participantId)) || 'null');
  } catch {
    return null;
  }
}

function guardarBorrador(participantId, borrador) {
  try {
    if (!borrador.texto) {
      localStorage.removeItem(claveDelBorrador(participantId));
    } else {
      localStorage.setItem(claveDelBorrador(participantId), JSON.stringify(borrador));
    }
  } catch {
    // Sin localStorage el borrador simplemente no sobrevive a cerrar la pestaña.
  }
}

// Se escribe DURANTE el debate, mientras otros hablan, y queda esperando turno. Solo quien
// tiene un argumento preparado entra a la ruleta (docs/04) — el turno sirve para defenderlo,
// no para empezar a escribirlo contra reloj.
//
// El borrador vive en el cliente y se revisa con Groq por HTTP: no se publica nada al canal
// hasta que el argumento queda aprobado, así corregirlo no cuesta cuota de Ably.
export function PrepararArgumento({ estado, programa, presencia = [], participantId, publicar }) {
  const [borradorGuardado] = useState(() => leerBorrador(participantId));
  const [tipoDeclarado, setTipoDeclarado] = useState(borradorGuardado?.tipoDeclarado ?? TIPOS_DE_RELACION.NUEVO);
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState(borradorGuardado?.argumentoObjetivoId ?? '');
  const [texto, setTexto] = useState(borradorGuardado?.texto ?? '');
  const [revisando, setRevisando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [avisoDeCampoFaltante, setAvisoDeCampoFaltante] = useState('');
  const [argumentoRepetido, setArgumentoRepetido] = useState(null);

  const requiereObjetivo = TIPOS_QUE_REQUIEREN_OBJETIVO.includes(tipoDeclarado);
  // Se responde a argumentos ajenos: apuntar a uno propio no tiene sentido como réplica.
  const argumentosExistentes = Object.values(estado.argumentos).filter(
    (argumento) => argumento.participantId !== participantId
  );
  const posicionEnRonda = siguientePosicionParaParticipante(estado, participantId);
  const yaTengoUnoListo = Boolean(estado.participantes[participantId]?.argumentoListo);
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;

  async function revisarYPreparar() {
    if (requiereObjetivo && !argumentoObjetivoId) {
      setAvisoDeCampoFaltante('Elige el argumento al que apunta antes de revisar.');
      return;
    }
    if (!texto.trim()) {
      setAvisoDeCampoFaltante('Escribe tu argumento antes de revisar.');
      return;
    }
    setAvisoDeCampoFaltante('');

    // Filtro local, sin gastar una llamada a Groq. Si lo que escribes ya está en el mapa, lo
    // honesto es apoyarlo como refuerzo (o decir algo nuevo), no repetirlo como aporte propio.
    // Un refuerzo apunta a su objetivo y es natural que comparta vocabulario con él, así que ese
    // argumento no cuenta como repetido (si no, el aviso se repetiría después de aceptarlo).
    const argumentosParaComparar = Object.values(estado.argumentos).filter(
      (argumento) =>
        !(tipoDeclarado === TIPOS_DE_RELACION.REFUERZO && argumento.argumentId === argumentoObjetivoId)
    );
    const argumentoParecido = buscarArgumentoParecido(texto, argumentosParaComparar);
    if (argumentoParecido) {
      setArgumentoRepetido(argumentoParecido.argumento);
      setResultado(null);
      return;
    }
    setArgumentoRepetido(null);
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
    const argumentId = generarId('argumento');
    const objetivoElegido = requiereObjetivo ? argumentoObjetivoId : null;
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId,
      ronda: estado.fase.actual?.ronda ?? 1,
      posicionEnRonda,
      tipoDeclarado,
      argumentoObjetivoId: objetivoElegido,
      texto,
      stanceId,
      viaCoModerador: false,
    });
    // El objetivo ya se eligió al preparar el argumento: se publica la arista de una vez, sin
    // esperar una sugerencia de Groq ni que el participante conecte a mano (igual que en un bid
    // aprobado). Sin esto el nodo quedaba suelto en la fila raíz del grafo.
    if (objetivoElegido) {
      publicar(EVENTOS.CONEXION_CREADA, {
        linkId: generarId('conexion'),
        sourceArgumentId: argumentId,
        targetArgumentId: objetivoElegido,
        tipoDeRelacion: tipoDeclarado,
        porParticipanteId: participantId,
      });
    }
    setTexto('');
    setArgumentoObjetivoId('');
    setResultado(null);
  }

  const turnoEnCurso = estado.turnos.turnoEnCurso;
  const tengoLaPalabra = turnoEnCurso?.participantId === participantId && turnoEnCurso?.modo !== 'verbal';

  // Al recibir la palabra se anuncia el texto que se va a defender: el resto de la sala (y la
  // proyección) lo ve destacado un momento mientras empiezas a hablar, y así todos saben de qué
  // argumento se trata. Una sola vez por turno; el argumento se publica al terminar, como antes.
  useEffect(() => {
    guardarBorrador(participantId, { texto, tipoDeclarado, argumentoObjetivoId });
  }, [participantId, texto, tipoDeclarado, argumentoObjetivoId]);

  const turnoYaAnunciadoRef = useRef(null);
  useEffect(() => {
    if (!tengoLaPalabra || !yaTengoUnoListo || !texto.trim() || turnoYaAnunciadoRef.current === turnoEnCurso.turnId) {
      return;
    }
    turnoYaAnunciadoRef.current = turnoEnCurso.turnId;
    publicar(EVENTOS.ARGUMENTO_EN_EXPOSICION, {
      turnId: turnoEnCurso.turnId,
      participantId,
      texto,
      tipoDeclarado,
      stanceId,
      argumentoObjetivoId: requiereObjetivo ? argumentoObjetivoId : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tengoLaPalabra, yaTengoUnoListo, turnoEnCurso?.turnId]);

  if (tengoLaPalabra && yaTengoUnoListo && !texto.trim()) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="mensaje-de-error">
          Tienes la palabra, pero el texto de tu argumento ya no está en este dispositivo (¿abriste la sala desde
          otro navegador o se borró el almacenamiento?). Avísale al moderador para que termine tu turno.
        </p>
      </section>
    );
  }

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
          <select
            value={argumentoObjetivoId}
            onChange={(evento) => {
              setArgumentoObjetivoId(evento.target.value);
              setAvisoDeCampoFaltante('');
            }}
          >
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
          lang="es"
          spellCheck
          autoCapitalize="sentences"
          onChange={(evento) => {
            setTexto(evento.target.value);
            setResultado(null);
            setArgumentoRepetido(null);
            setAvisoDeCampoFaltante('');
          }}
        />
      </label>

      {argumentoRepetido && (
        <div className="aviso-de-validacion">
          <p className="mensaje-de-error">
            Tu argumento se parece mucho al de {nombreDeParticipante(presencia, argumentoRepetido.participantId)}: «
            {argumentoRepetido.texto.slice(0, 90)}…»
          </p>
          <p className="texto-de-ayuda">
            Si quieres apoyarlo, márcalo como refuerzo de ese argumento. Si piensas algo distinto, reescríbelo con
            tus propias palabras.
          </p>
          <button
            type="button"
            className="boton-cambiar-programa"
            onClick={() => {
              setTipoDeclarado(TIPOS_DE_RELACION.REFUERZO);
              setArgumentoObjetivoId(argumentoRepetido.argumentId);
              setArgumentoRepetido(null);
            }}
          >
            Usarlo como refuerzo de ese argumento
          </button>
        </div>
      )}

      {resultado && resultado.decision !== DECISIONES.APROBADO && (
        <div className="aviso-de-validacion">
          <p className="mensaje-de-error">{resultado.mensaje}</p>
          {resultado.sugerencia && <p className="texto-de-ayuda">{resultado.sugerencia}</p>}
        </div>
      )}

      {avisoDeCampoFaltante && <p className="mensaje-de-error">{avisoDeCampoFaltante}</p>}

      <button type="button" disabled={revisando} onClick={revisarYPreparar}>
        {revisando ? 'Revisando…' : 'Revisar y ponerme en la ruleta'}
      </button>
    </section>
  );
}
