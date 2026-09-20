import { useEffect, useRef, useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { buscarArgumentoParecido } from '../../shared/argumentos/buscarArgumentoParecido.js';
import { nombreDeParticipante, siguientePosicionParaParticipante } from '../../shared/estado/seleccionesDerivadas.js';
import {
  calcularPenalidadPorRechazoDeTurno,
  resolverParametrosDePuntaje,
} from '../../shared/puntaje/formulaDePuntaje.js';

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
// hasta que el argumento queda aprobado, así corregirlo no cuesta cuota de Ably. Al aprobarse SÍ se
// publica: el argumento entra al mapa y puntúa desde ese momento; el turno solo sirve para
// exponerlo en voz alta (los co-moderadores califican esa exposición, ver docs/04).
export function PrepararArgumento({ estado, programa, presencia = [], participantId, publicar }) {
  const [borradorGuardado] = useState(() => leerBorrador(participantId));
  const [tipoDeclarado, setTipoDeclarado] = useState(borradorGuardado?.tipoDeclarado ?? TIPOS_DE_RELACION.NUEVO);
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState(borradorGuardado?.argumentoObjetivoId ?? '');
  const [texto, setTexto] = useState(borradorGuardado?.texto ?? '');
  const [revisando, setRevisando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [avisoDeCampoFaltante, setAvisoDeCampoFaltante] = useState('');
  const [argumentoRepetido, setArgumentoRepetido] = useState(null);
  // Entre publicar el argumento aprobado y que el canal lo devuelva pasa un instante en el que el
  // botón seguiría activo: sin esto, un doble clic publicaba el mismo argumento dos veces.
  const [publicando, setPublicando] = useState(false);

  const requiereObjetivo = TIPOS_QUE_REQUIEREN_OBJETIVO.includes(tipoDeclarado);
  // Se responde a argumentos ajenos: apuntar a uno propio no tiene sentido como réplica.
  const argumentosExistentes = Object.values(estado.argumentos).filter(
    (argumento) => argumento.participantId !== participantId
  );
  const posicionEnRonda = siguientePosicionParaParticipante(estado, participantId);
  const yaTengoUnoListo = Boolean(estado.participantes[participantId]?.argumentoListo);
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;
  // El argumento aprobado vive en el canal, no en este dispositivo: así sigue ahí aunque se cierre
  // la pestaña o se abra la sala desde otro navegador.
  const argumentoPendiente = estado.argumentos[estado.participantes[participantId]?.argumentoPendienteId] ?? null;
  const parametrosDePuntaje = resolverParametrosDePuntaje(estado.programa ?? programa);
  const yaCompleteTodasMisPosiciones = posicionEnRonda > parametrosDePuntaje.valoresBasePosicion.length;
  const penalidadPorRechazar = Math.abs(calcularPenalidadPorRechazoDeTurno(parametrosDePuntaje));

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
    // Tampoco se compara contra los argumentos propios: solo importa no repetir lo de otras
    // personas, y el botón de refuerzo solo puede apuntar a argumentos ajenos.
    const argumentosParaComparar = argumentosExistentes.filter(
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
        body: JSON.stringify({
          texto,
          ejemplos: programa.ejemplosPorTema,
          posturas: programa.posturas,
          idioma: resolverIdiomaDelDebate(programa),
        }),
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
      publicarArgumentoAprobado();
    }
    setRevisando(false);
  }

  // El argumento aprobado entra al mapa y puntúa desde ya (`pendienteDeExposicion`: falta
  // exponerlo). Si tiene objetivo, la arista se publica de una vez, sin esperar una sugerencia de
  // Groq ni que la persona conecte a mano (igual que en un bid aprobado): sin ella el nodo quedaba
  // suelto en la fila raíz del grafo.
  function publicarArgumentoAprobado() {
    const argumentId = generarId('argumento');
    const objetivoElegido = requiereObjetivo ? argumentoObjetivoId : null;
    setPublicando(true);
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId: null,
      ronda: estado.fase.actual?.ronda ?? 1,
      posicionEnRonda,
      tipoDeclarado,
      argumentoObjetivoId: objetivoElegido,
      texto,
      stanceId,
      viaCoModerador: false,
      pendienteDeExposicion: true,
    });
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
    setTipoDeclarado(TIPOS_DE_RELACION.NUEVO);
    setResultado(null);
  }

  // Al terminar de exponerlo en voz alta, el argumento (que ya estaba en el mapa) queda como
  // expuesto: libera el turno y abre la calificación de los co-moderadores.
  function terminarExposicion(turnId) {
    publicar(EVENTOS.EXPOSICION_TERMINADA, { turnId, participantId, argumentId: argumentoPendiente.argumentId });
    setPublicando(false);
  }

  const turnoEnCurso = estado.turnos.turnoEnCurso;
  const tengoLaPalabra = turnoEnCurso?.participantId === participantId && turnoEnCurso?.modo !== 'verbal';

  useEffect(() => {
    guardarBorrador(participantId, { texto, tipoDeclarado, argumentoObjetivoId });
  }, [participantId, texto, tipoDeclarado, argumentoObjetivoId]);

  // Al recibir la palabra se anuncia el texto que se va a defender: el resto de la sala (y la
  // proyección) lo ve destacado un momento mientras empiezas a hablar, y así todos saben de qué
  // argumento se trata. Una sola vez por turno. El anuncio también abre la exposición para que
  // los co-moderadores puedan calificarla mientras hablas.
  const turnoYaAnunciadoRef = useRef(null);
  useEffect(() => {
    if (!tengoLaPalabra || !argumentoPendiente || turnoYaAnunciadoRef.current === turnoEnCurso.turnId) {
      return;
    }
    turnoYaAnunciadoRef.current = turnoEnCurso.turnId;
    publicar(EVENTOS.ARGUMENTO_EN_EXPOSICION, {
      turnId: turnoEnCurso.turnId,
      participantId,
      argumentId: argumentoPendiente.argumentId,
      texto: argumentoPendiente.texto,
      tipoDeclarado: argumentoPendiente.tipoDeclarado,
      stanceId: argumentoPendiente.stanceId ?? stanceId,
      argumentoObjetivoId: argumentoPendiente.argumentoObjetivoId ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tengoLaPalabra, argumentoPendiente?.argumentId, turnoEnCurso?.turnId]);

  if (tengoLaPalabra && argumentoPendiente) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="texto-de-ayuda">
          Tienes la palabra. Defiende en voz alta tu argumento, que ya está en el mapa; los co-moderadores
          califican cómo lo expones. Cuando termines, pulsa el botón.
        </p>
        <blockquote className="cita-de-argumento">{argumentoPendiente.texto}</blockquote>
        <button type="button" onClick={() => terminarExposicion(turnoEnCurso.turnId)}>
          Ya lo expuse
        </button>
      </section>
    );
  }

  if (yaTengoUnoListo) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="mensaje-de-exito">✅ Tu argumento ya está en el mapa y suma puntos.</p>
        {argumentoPendiente && <blockquote className="cita-de-argumento">{argumentoPendiente.texto}</blockquote>}
        <p className="texto-de-ayuda">
          Entraste a la ruleta: en cualquier momento te pueden dar la palabra para exponerlo en voz alta.
          Rechazar ese turno te resta {penalidadPorRechazar} puntos de los que ya ganaste; exponerlo bien puede
          sumarte más.
        </p>
      </section>
    );
  }

  if (yaCompleteTodasMisPosiciones) {
    return (
      <section className="tarjeta-de-formulario-de-argumento">
        <p className="mensaje-de-exito">
          ✅ Ya publicaste todos tus argumentos ({parametrosDePuntaje.valoresBasePosicion.length}). Escucha a los
          demás y conecta lo tuyo con el mapa.
        </p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-formulario-de-argumento">
      <p className="texto-de-ayuda">
        Prepara tu próximo argumento mientras escuchas a los demás. Cuando quede aprobado se publica en el mapa,
        suma puntos y entras a la ruleta: el turno será para exponerlo en voz alta. Sin argumento preparado no se
        te ofrece la palabra.
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

      <button type="button" disabled={revisando || publicando} onClick={revisarYPreparar}>
        {revisando ? 'Revisando…' : 'Revisar y publicar en el mapa'}
      </button>
    </section>
  );
}
