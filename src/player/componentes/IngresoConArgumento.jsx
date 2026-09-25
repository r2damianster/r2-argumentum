import { useEffect, useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { elegirPosturaMenosRepresentada, verificarCupoDePostura } from '../../shared/ingreso/reglasDeIngreso.js';
import { buscarArgumentoParecido } from '../../shared/argumentos/buscarArgumentoParecido.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ingreso obligatorio con argumento (ver docs/09). El estudiante ya está conectado al canal y
// leyó el Programa, pero todavía NO está en presencia: nadie lo ve hasta que confirma.
//
// Groq se consulta por HTTP directo, sin publicar nada al canal, así que corregir el borrador
// las veces que haga falta no gasta cuota de Ably. Recién al confirmar se publican los eventos.
export function IngresoConArgumento({ estado, programa, presencia, participantId, nombre, emoji, publicar }) {
  const posturas = programa.posturas;
  const modoAsignacion = programa.asignacionPostura ?? 'aleatoria';
  const asignacionEsLibre = modoAsignacion === 'libre';
  const asignacionPorArgumento = modoAsignacion === 'por_argumento';
  // Quiénes están en la sala ahora mismo: con eso el reparto de posturas se hace por turnos
  // entre los presentes en vez de sortear cada cliente por su cuenta (ver reglasDeIngreso).
  const participantesEnLaSala = (presencia ?? [])
    .filter((presente) => presente.conectado !== false)
    .map((presente) => presente.participantId);

  // Con asignación aleatoria el Programa quiere que defiendas una postura que no elegiste: se
  // resuelve aquí, balanceando bandos contra quienes ya confirmaron su ingreso.
  const [stanceElegido, setStanceElegido] = useState(() =>
    asignacionEsLibre || asignacionPorArgumento
      ? ''
      : elegirPosturaMenosRepresentada(estado, posturas, { participantId, participantesEnLaSala })
  );
  const [texto, setTexto] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [ultimaRespuestaDeGroq, setUltimaRespuestaDeGroq] = useState(null);
  // La propuesta de postura nueva que este participante le mandó al moderador, con el texto que
  // la motivó, para poder reaccionar cuando el moderador responde.
  const [propuestaEnviada, setPropuestaEnviada] = useState(null);

  // Mientras no hayas escrito nada, la postura asignada se recalcula con la sala al día: los
  // primeros en abrir la pantalla la veían vacía y todos sorteaban contra el mismo conteo en
  // cero. En cuanto empiezas a escribir queda fija, para no cambiarte el pie a mitad de frase.
  useEffect(() => {
    if (asignacionEsLibre || asignacionPorArgumento || texto.trim() !== '') {
      return;
    }
    const posturaAlDia = elegirPosturaMenosRepresentada(estado, posturas, {
      participantId,
      participantesEnLaSala,
    });
    if (posturaAlDia && posturaAlDia !== stanceElegido) {
      setStanceElegido(posturaAlDia);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignacionEsLibre, asignacionPorArgumento, texto, estado.participantes, posturas, participantesEnLaSala.join(',')]);

  // Respuesta del moderador a la postura propuesta. Sin esto la pantalla se quedaba en "espera
  // su respuesta" para siempre y, aunque la postura se sumaba a la lista, nunca se le asignaba a
  // quien la propuso (reporte de prueba en vivo).
  const propuestaDelEstado = propuestaEnviada ? estado.posturasPropuestas?.[propuestaEnviada.propuestaId] : null;
  const decisionDelModerador = propuestaDelEstado?.decision ?? null;

  useEffect(() => {
    if (decisionDelModerador === 'aceptada' && propuestaDelEstado?.stanceId) {
      setStanceElegido(propuestaDelEstado.stanceId);
      // Su argumento ya había pasado la revisión de forma: solo faltaba la postura. Si lo
      // editó mientras esperaba, tiene que volver a revisarlo.
      setResultado(
        texto === propuestaEnviada.texto ? { decision: DECISIONES.APROBADO, mensaje: '', sugerencia: '' } : null
      );
    } else if (decisionDelModerador === 'rechazada') {
      setResultado({
        decision: 'propuesta_rechazada',
        mensaje: 'El moderador no aceptó la postura que propusiste.',
        sugerencia: 'Reescribe tu argumento defendiendo una de las posturas que ya existen.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionDelModerador]);

  const posturaElegida = posturas.find((postura) => postura.id === stanceElegido);
  const estaAprobado = resultado?.decision === DECISIONES.APROBADO && Boolean(stanceElegido);
  const puedeProponerPostura = resultado?.decision === DECISIONES.POSTURA_NUEVA_PROPUESTA;

  async function revisarConGroq() {
    if (!texto.trim() || (!stanceElegido && !asignacionPorArgumento)) {
      return;
    }
    // Filtro local, sin gastar una llamada a Groq: repetir casi lo mismo que otro estudiante ya
    // dejó en el mapa no aporta al debate ni debería puntuar como un aporte propio.
    const argumentosAjenos = Object.values(estado.argumentos).filter(
      (argumento) => argumento.participantId !== participantId
    );
    const argumentoParecido = buscarArgumentoParecido(texto, argumentosAjenos);
    if (argumentoParecido) {
      setResultado({
        decision: 'argumento_repetido',
        mensaje: `Tu argumento se parece mucho al de ${nombreDeParticipante(
          presencia ?? [],
          argumentoParecido.argumento.participantId
        )}: «${argumentoParecido.argumento.texto.slice(0, 90)}…»`,
        sugerencia: 'Escríbelo con tus propias palabras: qué piensas tú y qué razón o ejemplo lo sostiene.',
      });
      return;
    }
    setRevisando(true);
    let respuesta;
    try {
      const peticion = await fetch('/api/groq-validar-argumento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ejemplos: programa.ejemplosPorTema, posturas, idioma: resolverIdiomaDelDebate(programa) }),
      });
      respuesta = peticion.ok
        ? await peticion.json()
        : { aprobado: false, motivo: 'El validador no respondió, inténtalo de nuevo.' };
    } catch {
      respuesta = { aprobado: false, motivo: 'No se pudo validar (error de conexión).' };
    }

    setUltimaRespuestaDeGroq(respuesta);
    const decisionCalculada = decidirValidacion({
      resultadoDeGroq: respuesta,
      stanceElegido,
      permitirPosturasNuevas: Boolean(programa.permitirPosturasNuevas),
      posturas,
      permiteCambioDePostura: asignacionEsLibre,
      asignacionPostura: modoAsignacion,
    });

    setResultado(decisionCalculada);
    if (decisionCalculada.decision === DECISIONES.APROBADO && decisionCalculada.posturaDetectada) {
      setStanceElegido(decisionCalculada.posturaDetectada);
    }
    setRevisando(false);
  }

  // Un solo momento de publicación: el argumento, la postura y la confirmación de ingreso
  // viajan juntos. Antes de esto el canal no sabe que esta persona existe.
  async function confirmarIngreso() {
    // Solo con asignación aleatoria el reparto tiene que ser equitativo: si mientras escribías
    // otras personas llenaron tu postura, te toca otra y hay que ajustar el argumento.
    if (modoAsignacion === 'aleatoria') {
      const cupo = verificarCupoDePostura(estado, posturas, stanceElegido, { participantId, participantesEnLaSala });
      if (!cupo.permitida) {
        const posturaNueva = posturas.find((postura) => postura.id === cupo.posturaSugerida);
        setStanceElegido(cupo.posturaSugerida);
        setResultado({
          decision: 'cupo_de_postura_lleno',
          mensaje: `Mientras escribías, otras personas confirmaron esa postura y los bandos quedaron desparejos. Para que el debate sea diverso, ahora te toca defender «${posturaNueva?.etiqueta}».`,
          sugerencia: 'Ajusta tu argumento a esa postura y vuelve a revisarlo.',
        });
        return;
      }
    }
    setConfirmando(true);
    const argumentId = generarId('argumento');
    const attemptId = generarId('intento');

    publicar(EVENTOS.ARGUMENTO_INTENTO, {
      attemptId,
      participantId,
      turnId: `ingreso-${participantId}`,
      ronda: 1,
      numeroDeIntento: 1,
      texto,
    });
    publicar(EVENTOS.ARGUMENTO_RESULTADO_VALIDACION, {
      attemptId,
      aprobado: true,
      motivo: ultimaRespuestaDeGroq?.motivo ?? '',
      sugerenciaDeCorreccion: '',
    });
    publicar(EVENTOS.POSTURA_ASIGNADA, {
      participantId,
      stanceId: stanceElegido,
      metodo: modoAsignacion,
    });
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId: `ingreso-${participantId}`,
      ronda: 1,
      posicionEnRonda: 1,
      tipoDeclarado: TIPOS_DE_RELACION.NUEVO,
      argumentoObjetivoId: null,
      texto,
      stanceId: stanceElegido,
      viaCoModerador: false,
      // El argumento de ingreso es el boleto de entrada, no una intervención en el debate: se
      // escribe antes de que empiece y nadie lo escuchó. Sin esta marca el reducer lo contaba
      // como "ya tomó la palabra" y el turno hablado de respaldo no se le ofrecía nunca a
      // nadie (ver reducirEventos.js y participantesSinIntervenir en reglasDeIngreso.js).
      esArgumentoDeIngreso: true,
      pendienteDeExposicion: true,
    });
    // No hace falta esperar nada más: el participante ya está en presencia desde que se
    // conectó (ver useEstadoDeSesion.js). En cuanto este evento vuelva por el canal, App.jsx
    // deja de mostrar esta pantalla porque `ingresoConfirmado` pasa a true.
    publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: stanceElegido, argumentId, nombre, emoji });
  }

  function proponerPosturaNueva() {
    const propuestaId = generarId('propuesta');
    setPropuestaEnviada({ propuestaId, texto });
    publicar(EVENTOS.POSTURA_PROPUESTA, {
      propuestaId,
      participantId,
      nombre,
      emoji,
      etiquetaPropuesta: resultado.posturaSugerida,
      textoDelArgumento: texto,
    });
    setResultado({
      decision: 'propuesta_enviada',
      mensaje: 'Tu propuesta llegó al moderador. Espera su respuesta, o reescribe tu argumento mientras tanto.',
      sugerencia: '',
    });
  }

  return (
    <section className="tarjeta-de-ingreso">
      <h2>Para entrar al debate</h2>
      <p className="texto-de-ayuda">
        Necesitas una postura y un argumento que la defienda. Hasta que lo confirmes, nadie te ve en la sala.
      </p>

      {!asignacionPorArgumento && (
        <div className="paso-de-ingreso">
          <h3>1 · Tu postura</h3>
          {asignacionEsLibre ? (
            <ul className="lista-de-posturas-para-elegir">
              {posturas.map((postura) => (
                <li key={postura.id}>
                  <button
                    type="button"
                    style={{ borderColor: stanceElegido === postura.id ? postura.color : undefined }}
                    onClick={() => setStanceElegido(postura.id)}
                  >
                    {postura.etiqueta}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Te toca defender: <strong style={{ color: posturaElegida?.color }}>{posturaElegida?.etiqueta}</strong>
              <br />
              <span className="texto-de-ayuda">
                La asignación es al azar a propósito: defender una postura que no elegiste es parte del ejercicio (modo Rolplay).
              </span>
            </p>
          )}
        </div>
      )}

      <div className="paso-de-ingreso">
        <h3>{asignacionPorArgumento ? '1 · Tu postura y argumento' : '2 · Tu argumento'}</h3>
        <p className="texto-de-ayuda">
          {asignacionPorArgumento
            ? 'Escribe libremente tu postura y la razón que la sostiene. Groq analizará tu argumento para ubicarte en el bando correspondiente.'
            : 'No alcanza con afirmar algo: tiene que incluir la razón, la evidencia o el ejemplo que lo sostiene.'}
        </p>
        <textarea
          value={texto}
          rows={5}
          spellCheck
          autoCapitalize="sentences"
          onChange={(evento) => {
            setTexto(evento.target.value);
            setResultado(null);
          }}
          placeholder="Ej. Los países con X lograron Y, porque…"
        />

        {resultado && resultado.decision !== DECISIONES.APROBADO && (
          <div className="aviso-de-validacion">
            <p className="mensaje-de-error">{resultado.mensaje}</p>
            {resultado.sugerencia && <p className="texto-de-ayuda">{resultado.sugerencia}</p>}
            {puedeProponerPostura && (
              <button type="button" className="boton-secundario" onClick={proponerPosturaNueva}>
                Proponer esta postura al moderador
              </button>
            )}
            {resultado.decision === DECISIONES.POSTURA_DISTINTA && asignacionEsLibre && (
              <button
                type="button"
                className="boton-secundario"
                onClick={() => {
                  setStanceElegido(resultado.posturaDetectada);
                  setResultado(null);
                }}
              >
                Cambiarme a esa postura
              </button>
            )}
          </div>
        )}

        {decisionDelModerador === 'aceptada' && posturaElegida && (
          <p className="mensaje-de-exito">
            El moderador aceptó tu postura «{posturaElegida.etiqueta}» y ya quedó asignada.
          </p>
        )}

        {estaAprobado && (
          <div className="mensaje-de-exito">
            <p>
              {resultado?.mensaje || 'Tu argumento está listo.'}
              {posturaElegida && (
                <>
                  <br />
                  <span>
                    Postura asignada: <strong style={{ color: posturaElegida.color }}>{posturaElegida.etiqueta}</strong>
                  </span>
                </>
              )}
            </p>
            <p className="texto-de-ayuda">Ya puedes confirmar tu ingreso al debate.</p>
          </div>
        )}

        {!estaAprobado && (
          <button
            type="button"
            className="boton-primario"
            disabled={revisando || !texto.trim() || (!stanceElegido && !asignacionPorArgumento)}
            onClick={revisarConGroq}
          >
            {revisando ? 'Revisando…' : 'Revisar mi argumento'}
          </button>
        )}
      </div>

      {estaAprobado && (
        <div className="paso-de-ingreso">
          <h3>{asignacionPorArgumento ? '2 · Confirmar' : '3 · Confirmar'}</h3>
          <button type="submit" className="boton-exito" disabled={confirmando} onClick={confirmarIngreso}>
            {confirmando ? 'Entrando…' : 'Confirmar mi ingreso al debate'}
          </button>
        </div>
      )}
    </section>
  );
}
