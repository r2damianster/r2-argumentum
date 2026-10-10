import { useEffect, useRef, useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../../shared/eventos/nombresDeEventos.js';
import { buscarArgumentoParecido } from '../../../shared/argumentos/buscarArgumentoParecido.js';
import { MINIMO_DE_PALABRAS_DE_UN_APORTE, contarPalabras } from '../../../shared/argumentos/contarPalabras.js';
import { nombreDeParticipante } from '../../../shared/estado/seleccionesDerivadas.js';
import { solicitarSugerenciaDeEvaluacion } from '../../../shared/nucleo/sugerenciaDeIA/solicitarSugerencia.js';
import { AVISO_SIN_REVISION_DE_IA } from '../../../shared/argumentos/validarArgumentoConGroq.js';
import { perfilDeAhorro } from '../../../shared/nucleo/capacidad/modosDeAhorro.js';
import { SugerenciaDeIA } from '../../../shared/componentes/foro/SugerenciaDeIA.jsx';
import { GuiaDeCriteriosAdicionales } from '../../../shared/componentes/foro/GuiaDeCriteriosAdicionales.jsx';
import { AdvertenciaDeIntegridad, AvisoDeIntegridad } from '../../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { useControlDeIntegridad } from '../../../shared/nucleo/integridad/useControlDeIntegridad.js';
import { CONTEXTOS_DE_REDACCION } from '../../../shared/nucleo/integridad/canalPrivado.js';

const TIPOS_DE_REPLICA = [
  TIPOS_DE_RELACION.CONTRAARGUMENTO,
  TIPOS_DE_RELACION.REFUERZO,
  TIPOS_DE_RELACION.DILEMA,
  TIPOS_DE_RELACION.CONCESION,
  TIPOS_DE_RELACION.PREGUNTA,
];

const ETIQUETA_DE_TIPO_DE_REPLICA = {
  [TIPOS_DE_RELACION.CONTRAARGUMENTO]: 'Contradigo (contraargumento)',
  [TIPOS_DE_RELACION.REFUERZO]: 'Apoyo (refuerzo)',
  [TIPOS_DE_RELACION.DILEMA]: 'Planteo un dilema',
  [TIPOS_DE_RELACION.CONCESION]: 'Reconozco que tiene razón (concesión)',
  [TIPOS_DE_RELACION.PREGUNTA]: 'Pregunto',
};

// Cuántas veces se consulta a la IA por cada aporte: la primera orienta y la segunda confirma que se
// mejoró. Pasado eso se publica directo, así la IA nunca frena a quien ya decidió qué escribir y el
// costo por aporte queda acotado.
// Una réplica corta («estoy de acuerdo porque lo viví») no gana nada con la sugerencia de la IA y cuesta una llamada
// a Groq: con salas grandes el plan gratuito se agota enseguida (docs/06-pendientes.md). Se publica directo.
const PALABRAS_MINIMAS_DE_UNA_REPLICA_PARA_CONSULTAR_A_LA_IA = 15;

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// El borrador se guarda en el navegador por persona y por destino: quien cierra la pestaña por
// error recupera lo escrito, y cada respuesta tiene su propio borrador.
function claveDelBorrador(participantId, idDelObjetivo) {
  return `r2-argumentum-borrador-foro:${participantId}:${idDelObjetivo ?? 'nuevo'}`;
}

function leerBorrador(clave) {
  try {
    return localStorage.getItem(clave) ?? '';
  } catch {
    return '';
  }
}

function guardarBorrador(clave, texto) {
  try {
    if (texto) {
      localStorage.setItem(clave, texto);
    } else {
      localStorage.removeItem(clave);
    }
  } catch {
    // Sin localStorage el borrador simplemente no sobrevive a cerrar la pestaña.
  }
}

// Escribir un post nuevo o responder a otro aporte. Sin turnos: se publica cuando se quiere
// mientras el foro esté abierto. Antes de publicar, la IA SUGIERE si el aporte está completo y si
// hay alguna posible falacia; quien escribe puede mejorarlo o publicarlo así. Lo que decide si el
// aporte cuenta lo deciden las personas que moderan (docs/13).
export function CompositorDeAporte({
  estado,
  programa,
  presencia,
  participantId,
  objetivo,
  escrituraAbierta,
  onCancelarRespuesta,
  publicar,
  publicarIntegridad,
}) {
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;
  const clave = claveDelBorrador(participantId, objetivo?.argumentId);
  const campoDeTexto = useRef(null);

  const tipoSugerido =
    objetivo && objetivo.stanceId && objetivo.stanceId === stanceId
      ? TIPOS_DE_RELACION.REFUERZO
      : TIPOS_DE_RELACION.CONTRAARGUMENTO;

  const [texto, setTexto] = useState(() => leerBorrador(clave));
  const [tipoDeReplica, setTipoDeReplica] = useState(tipoSugerido);
  const [aviso, setAviso] = useState('');
  // Persiste después de publicar: avisa que la IA no pudo pre-revisar el último aporte.
  const [avisoSinRevisionDeIA, setAvisoSinRevisionDeIA] = useState('');
  const [aporteParecido, setAporteParecido] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  // La sugerencia vigente: solo vale para el texto exacto con que se pidió.
  const [sugerenciaVigente, setSugerenciaVigente] = useState(null);
  const [consultasHechas, setConsultasHechas] = useState(0);
  // Integridad (apagada por defecto): ver nucleo/integridad. Con ella activa, las señales de pegado u otras
  // se le advierten a quien escribe antes de enviar y las ve el moderador.
  const integridad = useControlDeIntegridad({
    programa,
    contexto: CONTEXTOS_DE_REDACCION.FORO,
    texto,
    publicarIntegridad,
  });

  // Al cambiar de destino (otro post al que responder) se cambia de borrador y de tipo sugerido.
  useEffect(() => {
    setTexto(leerBorrador(clave));
    setTipoDeReplica(tipoSugerido);
    setAviso('');
    setAporteParecido(null);
    setSugerenciaVigente(null);
    setConsultasHechas(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(() => {
    guardarBorrador(clave, texto);
  }, [clave, texto]);

  const palabras = contarPalabras(texto);
  const tipoDeclarado = objetivo ? tipoDeReplica : TIPOS_DE_RELACION.NUEVO;
  const sugerenciaAplicable = sugerenciaVigente && sugerenciaVigente.texto === texto.trim() ? sugerenciaVigente.sugerencia : null;
  const usaLaIA = programa?.sugerenciasDeIA !== false;

  function validarLocalmente() {
    if (palabras < MINIMO_DE_PALABRAS_DE_UN_APORTE) {
      setAviso(
        `Escribe un poco más: lo que afirmas y la razón que lo sostiene (al menos ${MINIMO_DE_PALABRAS_DE_UN_APORTE} palabras).`
      );
      return false;
    }
    // Filtro local, sin gastar ninguna llamada: repetir casi lo mismo que otra persona ya escribió
    // no aporta. Un refuerzo comparte vocabulario con aquello que apoya, así que no cuenta contra su objetivo.
    const aportesParaComparar = Object.values(estado.argumentos).filter(
      (aporte) =>
        aporte.participantId !== participantId &&
        !aporte.oculto &&
        !(tipoDeclarado === TIPOS_DE_RELACION.REFUERZO && aporte.argumentId === objetivo?.argumentId)
    );
    const parecido = buscarArgumentoParecido(texto, aportesParaComparar);
    if (parecido) {
      setAporteParecido(parecido.argumento);
      return false;
    }
    return true;
  }

  function publicarAporte(sugerenciaDeIA, argumentId) {
    setPublicando(true);
    const aportesPropios = Object.values(estado.argumentos).filter((aporte) => aporte.participantId === participantId);
    publicar(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId: null,
      ronda: 1,
      // El foro no usa posiciones de ronda; el reducer pide un número y el puntaje sale de calcularOrdinalDelTipo.
      posicionEnRonda: aportesPropios.length + 1,
      tipoDeclarado,
      argumentoObjetivoId: objetivo?.argumentId ?? null,
      texto: texto.trim(),
      stanceId,
      viaCoModerador: false,
      pendienteDeExposicion: false,
      // Solo si la IA llegó a opinar sobre ESTE texto: lo ven quien escribe y quienes moderan.
      ...(sugerenciaDeIA ? { sugerenciaDeIA } : {}),
    });
    if (objetivo) {
      publicar(EVENTOS.CONEXION_CREADA, {
        linkId: generarId('conexion'),
        sourceArgumentId: argumentId,
        targetArgumentId: objetivo.argumentId,
        tipoDeRelacion: tipoDeclarado,
        porParticipanteId: participantId,
      });
    }
    setTexto('');
    guardarBorrador(clave, '');
    setAviso('');
    setAporteParecido(null);
    setSugerenciaVigente(null);
    setConsultasHechas(0);
    setPublicando(false);
    onCancelarRespuesta?.();
  }

  // Todo envío pasa por la integridad: con ella apagada publica directo; con ella activa puede pedir
  // confirmación antes de publicar.
  function enviar(sugerenciaDeIA) {
    integridad.intentarEnviar({ alEnviar: (argumentId) => publicarAporte(sugerenciaDeIA, argumentId) });
  }

  async function revisarYPublicar() {
    if (!escrituraAbierta || publicando || consultando) {
      return;
    }
    setAviso('');
    setAvisoSinRevisionDeIA('');
    setAporteParecido(null);
    if (!validarLocalmente()) {
      return;
    }
    // Sin IA, o con las consultas agotadas, se publica directo.
    // Según el modo de ahorro (modosDeAhorro.js): en sala pequeña la cuota alcanza y toda réplica puede recibir sugerencia;
    // en sala grande las réplicas muy cortas no se consultan; en «ahorro» y masivo, ninguna réplica y una sola consulta por aporte.
    const perfil = perfilDeAhorro({ programa: estado.programa ?? programa, estado });
    const omiteLasReplicasCortas = !perfil.consultarReplicasCortasALaIA;
    const esReplicaCorta =
      Boolean(objetivo) &&
      (!perfil.consultarReplicasALaIA ||
        (omiteLasReplicasCortas && contarPalabras(texto) < PALABRAS_MINIMAS_DE_UNA_REPLICA_PARA_CONSULTAR_A_LA_IA));
    if (!usaLaIA || consultasHechas >= perfil.maximoDeConsultasALaIAPorAporte || esReplicaCorta) {
      enviar(sugerenciaAplicable);
      return;
    }

    setConsultando(true);
    const respuesta = await solicitarSugerenciaDeEvaluacion({
      texto: texto.trim(),
      programa,
      textoDelObjetivo: objetivo?.texto ?? '',
    });
    setConsultando(false);

    if (respuesta.fallo) {
      // La IA ayuda pero no es requisito: si no responde, el aporte se publica igual y se avisa.
      setAvisoSinRevisionDeIA(AVISO_SIN_REVISION_DE_IA);
      enviar(null);
      return;
    }
    if (respuesta.formaMinima && respuesta.formaMinima.valido === false) {
      setAviso(`${respuesta.formaMinima.motivo} ${respuesta.formaMinima.sugerencia}`.trim());
      return;
    }
    setConsultasHechas((consultas) => consultas + 1);
    setSugerenciaVigente({ texto: texto.trim(), sugerencia: respuesta.sugerencia });
  }

  function reescribir() {
    setSugerenciaVigente(null);
    campoDeTexto.current?.focus();
  }

  if (!escrituraAbierta) {
    return (
      <section className="compositor-del-foro">
        <p className="texto-de-ayuda">La escritura está cerrada: ya no se pueden publicar posts ni réplicas.</p>
      </section>
    );
  }

  const viendoLaSugerencia = Boolean(sugerenciaAplicable);

  return (
    <section
      id="compositor-del-foro"
      className={`compositor-del-foro ${objetivo ? 'compositor-del-foro--respondiendo' : ''}`}
    >
      <AvisoDeIntegridad nivel={integridad.nivel} />
      {objetivo ? (
        <>
          <p>
            <strong>Respondiendo a {nombreDeParticipante(presencia, objetivo.participantId)}:</strong>
          </p>
          <blockquote className="cita-de-argumento">{objetivo.texto}</blockquote>
          <label>
            Tu respuesta es…
            <select value={tipoDeReplica} onChange={(evento) => setTipoDeReplica(evento.target.value)}>
              {TIPOS_DE_REPLICA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_DE_TIPO_DE_REPLICA[tipo]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p>
          <strong>Publica un post nuevo</strong>
          <br />
          <span className="texto-de-ayuda">Di lo que piensas y la razón, un dato o un ejemplo que lo sostiene.</span>
        </p>
      )}

      <GuiaDeCriteriosAdicionales programa={estado.programa ?? programa} encabezado="Se espera además:" />

      <label>
        {objetivo ? 'Tu respuesta' : 'Tu post'}
        <textarea
          ref={campoDeTexto}
          {...integridad.propsDelCampo}
          value={texto}
          rows={4}
          spellCheck
          autoCapitalize="sentences"
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAviso('');
            setAporteParecido(null);
          }}
        />
      </label>
      <p className="contador-de-palabras">
        {palabras} palabra(s){palabras < MINIMO_DE_PALABRAS_DE_UN_APORTE ? ` · mínimo ${MINIMO_DE_PALABRAS_DE_UN_APORTE}` : ''}
      </p>

      {aviso && <p className="mensaje-de-error">{aviso}</p>}
      {avisoSinRevisionDeIA && <p className="texto-de-ayuda">{avisoSinRevisionDeIA}</p>}
      {aporteParecido && (
        <div className="aviso-de-validacion">
          <p className="mensaje-de-error">
            Se parece mucho a lo que escribió {nombreDeParticipante(presencia, aporteParecido.participantId)}: «
            {aporteParecido.texto.slice(0, 90)}…»
          </p>
          <p className="texto-de-ayuda">
            Si quieres apoyarlo, respóndele como refuerzo. Si piensas algo distinto, escríbelo con tus propias palabras.
          </p>
        </div>
      )}

      {viendoLaSugerencia && (
        <div className="aviso-de-validacion">
          <SugerenciaDeIA sugerencia={sugerenciaAplicable} />
          <p className="texto-de-ayuda">
            Es solo una sugerencia: no es tu nota. Si quieres, mejóralo; si no, publícalo así. Quienes moderan deciden si
            cuenta.
          </p>
        </div>
      )}

      {integridad.advertenciaPendiente && (
        <AdvertenciaDeIntegridad
          resumen={integridad.advertenciaPendiente}
          onEnviarIgual={integridad.confirmarEnvioPendiente}
          onReescribir={() => {
            integridad.cancelarEnvioPendiente();
            reescribir();
          }}
        />
      )}

      {!integridad.advertenciaPendiente && (
        <div className="botonera-de-bid">
          {viendoLaSugerencia ? (
            <>
              <button type="button" className="boton-primario" disabled={publicando} onClick={() => enviar(sugerenciaAplicable)}>
                {objetivo ? 'Publicar respuesta así' : 'Publicar así'}
              </button>
              <button type="button" className="boton-secundario" onClick={reescribir}>
                ✏️ Reescribir
              </button>
            </>
          ) : (
            <button type="button" className="boton-primario" disabled={publicando || consultando} onClick={revisarYPublicar}>
              {consultando ? 'Revisando…' : objetivo ? 'Publicar respuesta' : 'Publicar post'}
            </button>
          )}
          {objetivo && (
            <button type="button" className="boton-secundario" onClick={onCancelarRespuesta}>
              Cancelar
            </button>
          )}
        </div>
      )}
    </section>
  );
}
