import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { elegirPosturaMenosRepresentada } from '../../shared/ingreso/reglasDeIngreso.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ingreso obligatorio con argumento (ver docs/09). El estudiante ya está conectado al canal y
// leyó el Programa, pero todavía NO está en presencia: nadie lo ve hasta que confirma.
//
// Groq se consulta por HTTP directo, sin publicar nada al canal, así que corregir el borrador
// las veces que haga falta no gasta cuota de Ably. Recién al confirmar se publican los eventos.
export function IngresoConArgumento({ estado, programa, participantId, nombre, emoji, publicar }) {
  const posturas = programa.posturas;
  const asignacionEsLibre = programa.asignacionPostura === 'libre';

  // Con asignación aleatoria el Programa quiere que defiendas una postura que no elegiste: se
  // resuelve acá, balanceando bandos contra quienes ya confirmaron su ingreso.
  const [stanceElegido, setStanceElegido] = useState(() =>
    asignacionEsLibre ? '' : elegirPosturaMenosRepresentada(estado, posturas)
  );
  const [texto, setTexto] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [ultimaRespuestaDeGroq, setUltimaRespuestaDeGroq] = useState(null);

  const posturaElegida = posturas.find((postura) => postura.id === stanceElegido);
  const estaAprobado = resultado?.decision === DECISIONES.APROBADO;
  const puedeProponerPostura = resultado?.decision === DECISIONES.POSTURA_NUEVA_PROPUESTA;

  async function revisarConGroq() {
    if (!texto.trim() || !stanceElegido) {
      return;
    }
    setRevisando(true);
    let respuesta;
    try {
      const peticion = await fetch('/api/groq-validar-argumento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ejemplos: programa.ejemplosPorTema, posturas }),
      });
      respuesta = peticion.ok
        ? await peticion.json()
        : { aprobado: false, motivo: 'El validador no respondió, inténtalo de nuevo.' };
    } catch {
      respuesta = { aprobado: false, motivo: 'No se pudo validar (error de conexión).' };
    }

    setUltimaRespuestaDeGroq(respuesta);
    setResultado(
      decidirValidacion({
        resultadoDeGroq: respuesta,
        stanceElegido,
        permitirPosturasNuevas: Boolean(programa.permitirPosturasNuevas),
        posturas,
        permiteCambioDePostura: asignacionEsLibre,
      })
    );
    setRevisando(false);
  }

  // Un solo momento de publicación: el argumento, la postura y la confirmación de ingreso
  // viajan juntos. Antes de esto el canal no sabe que esta persona existe.
  async function confirmarIngreso() {
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
      metodo: asignacionEsLibre ? 'libre' : 'aleatoria',
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
    });
    publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: stanceElegido, argumentId });
    // No hace falta esperar nada más: el participante ya está en presencia desde que se
    // conectó (ver useEstadoDeSesion.js). En cuanto este evento vuelva por el canal, App.jsx
    // deja de mostrar esta pantalla porque `ingresoConfirmado` pasa a true.
  }

  function proponerPosturaNueva() {
    publicar(EVENTOS.POSTURA_PROPUESTA, {
      propuestaId: generarId('propuesta'),
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
              La asignación es al azar a propósito: defender una postura que no elegiste es parte del ejercicio.
            </span>
          </p>
        )}
      </div>

      <div className="paso-de-ingreso">
        <h3>2 · Tu argumento</h3>
        <p className="texto-de-ayuda">
          No alcanza con afirmar algo: tiene que incluir la razón, la evidencia o el ejemplo que lo sostiene.
        </p>
        <textarea
          value={texto}
          rows={5}
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
              <button type="button" className="boton-cambiar-programa" onClick={proponerPosturaNueva}>
                Proponer esta postura al moderador
              </button>
            )}
            {resultado.decision === DECISIONES.POSTURA_DISTINTA && asignacionEsLibre && (
              <button
                type="button"
                className="boton-cambiar-programa"
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

        {estaAprobado && (
          <p className="mensaje-de-exito">Tu argumento está listo. Ya puedes confirmar tu ingreso.</p>
        )}

        {!estaAprobado && (
          <button type="button" disabled={revisando || !texto.trim() || !stanceElegido} onClick={revisarConGroq}>
            {revisando ? 'Revisando…' : 'Revisar mi argumento'}
          </button>
        )}
      </div>

      {estaAprobado && (
        <div className="paso-de-ingreso">
          <h3>3 · Confirmar</h3>
          <button type="submit" disabled={confirmando} onClick={confirmarIngreso}>
            {confirmando ? 'Entrando…' : 'Confirmar mi ingreso al debate'}
          </button>
        </div>
      )}
    </section>
  );
}
