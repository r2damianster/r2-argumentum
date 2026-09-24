import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { decidirValidacion, DECISIONES } from '../../shared/argumentos/decidirValidacion.js';
import { buscarArgumentoParecido } from '../../shared/argumentos/buscarArgumentoParecido.js';
import { resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';
import { nombreDeParticipante } from '../../shared/estado/seleccionesDerivadas.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FormularioDeContraargumentoParaOyentes({
  estado,
  programa,
  presencia,
  participantId,
  nombre,
  emoji,
  publicar,
}) {
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState('');
  const [texto, setTexto] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [ultimaRespuestaDeGroq, setUltimaRespuestaDeGroq] = useState(null);
  // Texto exacto que Groq revisó: solo ese texto se puede publicar como aprobado.
  const [textoRevisado, setTextoRevisado] = useState('');
  // Un contraargumento suele defender la postura contraria a la del argumento que rebate, así que
  // no se hereda la del objetivo: la persona elige desde qué postura contraargumenta.
  const [posturaElegidaId, setPosturaElegidaId] = useState('');

  const argumentosPosibles = Object.values(estado.argumentos ?? {});
  const argumentoObjetivoSeleccionado = estado.argumentos?.[argumentoObjetivoId];

  async function revisarConGroq() {
    if (!texto.trim() || !argumentoObjetivoId) {
      return;
    }
    const argumentosAjenos = argumentosPosibles.filter(
      (arg) => arg.participantId !== participantId
    );
    const parecido = buscarArgumentoParecido(texto, argumentosAjenos);
    if (parecido) {
      setResultado({
        decision: 'argumento_repetido',
        mensaje: `Tu contraargumento se parece mucho al de ${nombreDeParticipante(
          presencia ?? [],
          parecido.argumento.participantId
        )}: «${parecido.argumento.texto.slice(0, 90)}…»`,
        sugerencia: 'Escríbelo con tus propias palabras: expresa la refutación con tus propias razones.',
      });
      return;
    }

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

    setUltimaRespuestaDeGroq(respuesta);
    setTextoRevisado(texto);
    const decisionCalculada = decidirValidacion({
      resultadoDeGroq: respuesta,
      stanceElegido: posturaElegidaId,
      permitirPosturasNuevas: false,
      posturas: programa.posturas,
      permiteCambioDePostura: false,
      asignacionPostura: 'libre',
    });

    setResultado(decisionCalculada);
    setRevisando(false);
  }

  function enviarContraargumento() {
    if (!argumentoObjetivoId || !texto.trim() || !posturaElegidaId || texto !== textoRevisado) {
      return;
    }
    setEnviando(true);
    const argumentId = generarId('argumento');
    const attemptId = generarId('intento');
    const stanceId = posturaElegidaId;

    publicar(EVENTOS.ARGUMENTO_INTENTO, {
      attemptId,
      participantId,
      turnId: `oyente-${participantId}`,
      ronda: estado.fase.actual?.ronda ?? 1,
      numeroDeIntento: 1,
      texto,
    });
    publicar(EVENTOS.ARGUMENTO_RESULTADO_VALIDACION, {
      attemptId,
      aprobado: true,
      motivo: ultimaRespuestaDeGroq?.motivo ?? '',
      sugerenciaDeCorreccion: '',
    });
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId: `oyente-${participantId}`,
      ronda: estado.fase.actual?.ronda ?? 1,
      posicionEnRonda: 1,
      tipoDeclarado: TIPOS_DE_RELACION.CONTRAARGUMENTO,
      argumentoObjetivoId,
      texto,
      stanceId,
      viaCoModerador: false,
    });
    publicar(EVENTOS.CONEXION_CREADA, {
      linkId: generarId('conexion'),
      sourceArgumentId: argumentId,
      targetArgumentId: argumentoObjetivoId,
      tipoDeRelacion: TIPOS_DE_RELACION.CONTRAARGUMENTO,
      porParticipanteId: participantId,
    });
    publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId, argumentId, nombre, emoji });

    setTexto('');
    setArgumentoObjetivoId('');
    setPosturaElegidaId('');
    setTextoRevisado('');
    setResultado(null);
    setEnviando(false);
  }

  return (
    <section className="tarjeta-de-ingreso">
      <div className="aviso-de-conexion aviso-de-conexion-incompleta">
        <p style={{ margin: 0 }}>
          <strong>⚠️ No pudiste ingresar tu argumento inicial a tiempo.</strong>
          <br />
          Se agotó el plazo de la primera fase y perdiste la oportunidad de ingresar un argumento principal.
          Sin embargo, como estás conectado como oyente, tienes la oportunidad de proponer un <strong>contraargumento</strong> para participar en el debate.
        </p>
      </div>

      <h3>Formular un contraargumento como oyente</h3>
      <p className="texto-de-ayuda">
        Elige a cuál argumento expuesto deseas responder con un contraargumento válido.
      </p>

      {argumentosPosibles.length === 0 ? (
        <p className="texto-de-ayuda">Aún no hay argumentos en el debate a los cuales responder.</p>
      ) : (
        <div>
          <label>
            Argumento objetivo a refutar
            <select
              value={argumentoObjetivoId}
              onChange={(evento) => {
                setArgumentoObjetivoId(evento.target.value);
                setResultado(null);
              }}
            >
              <option value="">Elige un argumento…</option>
              {argumentosPosibles.map((arg) => (
                <option key={arg.argumentId} value={arg.argumentId}>
                  {arg.texto.slice(0, 60)}…
                </option>
              ))}
            </select>
          </label>

          {argumentoObjetivoSeleccionado && (
            <div className="vista-previa-argumento-completo">
              <header>
                <span>Argumento objetivo completo</span>
              </header>
              <p className="vista-previa-argumento-texto">{argumentoObjetivoSeleccionado.texto}</p>
            </div>
          )}

          <label style={{ marginTop: '12px' }}>
            Postura desde la que contraargumentas
            <select
              value={posturaElegidaId}
              onChange={(evento) => {
                setPosturaElegidaId(evento.target.value);
                setResultado(null);
              }}
            >
              <option value="">Elige una postura…</option>
              {programa.posturas.map((postura) => (
                <option key={postura.id} value={postura.id}>
                  {postura.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label style={{ marginTop: '12px' }}>
            Tu contraargumento (debe incluir premisa y razón)
            <textarea
              value={texto}
              rows={4}
              onChange={(evento) => {
                setTexto(evento.target.value);
                setResultado(null);
              }}
              placeholder="Ej. Ese planteamiento falla porque la evidencia demuestra que..."
            />
          </label>

          {resultado && resultado.decision !== DECISIONES.APROBADO && (
            <div className="aviso-de-validacion">
              <p className="mensaje-de-error">{resultado.mensaje}</p>
              {resultado.sugerencia && <p className="texto-de-ayuda">{resultado.sugerencia}</p>}
            </div>
          )}

          {resultado?.decision === DECISIONES.APROBADO && (
            <div className="mensaje-de-exito">
              <p>✅ Tu contraargumento cumple con la estructura requerida.</p>
              <button
                type="button"
                className="boton-exito"
                disabled={enviando || texto !== textoRevisado}
                onClick={enviarContraargumento}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {enviando ? 'Enviando…' : '🚀 Publicar contraargumento'}
              </button>
            </div>
          )}

          {(!resultado || resultado.decision !== DECISIONES.APROBADO) && (
            <button
              type="button"
              className="boton-primario"
              disabled={revisando || !texto.trim() || !argumentoObjetivoId || !posturaElegidaId}
              onClick={revisarConGroq}
              style={{ marginTop: '10px', width: '100%' }}
            >
              {revisando ? 'Revisando contraargumento…' : 'Revisar contraargumento'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

