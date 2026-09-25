import { useEffect, useMemo, useState } from 'react';
import { useEstadoDeSesion } from '../shared/estado/useEstadoDeSesion.js';
import { TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import {
  soyCoModerador,
  misArgumentosSinConexionSaliente,
  obtenerSugerenciasVisiblesParaParticipante,
} from '../shared/estado/seleccionesDerivadas.js';
import { miOfertaDeTurno, tengoElTurnoEnCurso } from './estadoDelParticipante.js';
import { PantallaDeTurnoOfrecido } from './componentes/PantallaDeTurnoOfrecido.jsx';
import { GrafoDeArgumentos } from '../shared/componentes/GrafoDeArgumentos.jsx';
import { FeedDeActividad } from '../shared/componentes/FeedDeActividad.jsx';
import { Creditos } from '../shared/componentes/Creditos.jsx';
import { PodioFinalParaParticipantes } from './componentes/PodioFinalParaParticipantes.jsx';
import { DestacadoDelTurno } from '../shared/componentes/DestacadoDelTurno.jsx';
import { CapaInstruccional } from '../shared/componentes/CapaInstruccional.jsx';
import { AvisoDeConexion } from '../shared/componentes/AvisoDeConexion.jsx';
import { PanelDeConexionLibre } from './componentes/PanelDeConexionLibre.jsx';
import { PanelDeSugerencias } from './componentes/PanelDeSugerencias.jsx';
import { PanelDeBid } from './componentes/PanelDeBid.jsx';
import { PanelDeCoModerador } from './componentes/PanelDeCoModerador.jsx';
import { IngresoConArgumento } from './componentes/IngresoConArgumento.jsx';
import { PrepararArgumento } from './componentes/PrepararArgumento.jsx';
import { IntervencionVerbal } from './componentes/IntervencionVerbal.jsx';
import { AvisoPreparateParaHablar } from './componentes/AvisoPreparateParaHablar.jsx';
import { FormularioDeContraargumentoParaOyentes } from './componentes/FormularioDeContraargumentoParaOyentes.jsx';
import { resolverIdiomaDelDebate } from '../shared/programa/idiomaDelDebate.js';
import { ingresoEstaCerrado } from '../shared/ingreso/reglasDeIngreso.js';

// Mismo set de emojis que R2 Quiz, ver docs/07-acceso-y-paginas.md.
const EMOJIS_DISPONIBLES = [
  '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐢', '🦉', '🦄', '🐝',
  '🦋', '🐙', '🦕', '🦈', '🐬', '🦖', '🐺', '🦔', '🐳', '🦩', '🦜', '🐊',
  '🦓', '🐘', '🦒', '🐌', '🐞', '🦦', '🦥', '🐇', '🐴', '🦌', '🦚', '🐲',
  '🌵', '🍀', '🌻', '🍄', '🌈', '🔥', '🌙', '⭐', '🍕', '🍩', '🍓', '🍉',
  '🥑', '🌮', '🍫', '🧋', '🎧', '🎸', '🎲', '🚀', '🛸', '🎯', '🧩', '🔮',
  '⚽', '🏀', '🛹', '🧠', '👾', '🤖', '👑', '💎',
];

const CLAVE_DE_PARTICIPANTE_ACTIVO = 'r2-argumentum-participante-activo';

function generarParticipantId() {
  return `participante-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function leerParticipanteGuardado(codigoDeSala) {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_DE_PARTICIPANTE_ACTIVO) || 'null');
    return guardado && guardado.codigoDeSala === codigoDeSala ? guardado : null;
  } catch {
    return null;
  }
}

// sessionStorage vuelve solo tras un F5 (misma pestaña), pero se pierde al cerrar la pestaña —
// justo el accidente típico en el aula. Por eso las identidades también se guardan en
// localStorage y, al volver a la sala, se ofrece recuperarlas con un clic. No se aplican solas:
// en un dispositivo compartido podrían ponerle a otra persona la identidad de quien lo usó antes.
//
// Se guarda una LISTA por navegador (no solo la última): en una prueba con varias pestañas del
// mismo navegador, o en un dispositivo que usan varias personas, cada quien elige la suya.
const CLAVE_DE_IDENTIDADES_RECORDADAS = 'r2-argumentum-identidades-recordadas';
const VIDA_MAXIMA_DE_LA_IDENTIDAD_MS = 12 * 60 * 60 * 1000;
const MAXIMO_DE_IDENTIDADES_GUARDADAS = 12;

function leerTodasLasIdentidades() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_DE_IDENTIDADES_RECORDADAS) || '[]');
    return Array.isArray(guardadas)
      ? guardadas.filter((identidad) => Date.now() - (identidad.guardadaEn ?? 0) < VIDA_MAXIMA_DE_LA_IDENTIDAD_MS)
      : [];
  } catch {
    return [];
  }
}

function escribirIdentidades(identidades) {
  try {
    localStorage.setItem(CLAVE_DE_IDENTIDADES_RECORDADAS, JSON.stringify(identidades));
  } catch {
    // Sin localStorage no se puede recuperar la identidad tras cerrar la pestaña.
  }
}

function leerIdentidadesRecordadas(codigoDeSala) {
  return leerTodasLasIdentidades().filter((identidad) => identidad.codigoDeSala === codigoDeSala);
}

function guardarParticipanteActivo(datos) {
  try {
    sessionStorage.setItem(CLAVE_DE_PARTICIPANTE_ACTIVO, JSON.stringify(datos));
  } catch {
    // Sin sessionStorage disponible, simplemente no sobrevive a un refresh.
  }
  const otras = leerTodasLasIdentidades().filter((identidad) => identidad.participantId !== datos.participantId);
  escribirIdentidades([...otras, { ...datos, guardadaEn: Date.now() }].slice(-MAXIMO_DE_IDENTIDADES_GUARDADAS));
}

function borrarParticipanteActivo(participantId) {
  try {
    sessionStorage.removeItem(CLAVE_DE_PARTICIPANTE_ACTIVO);
  } catch {
    // no-op
  }
  escribirIdentidades(leerTodasLasIdentidades().filter((identidad) => identidad.participantId !== participantId));
}

export default function App() {
  const [codigoDeSala, setCodigoDeSala] = useState('');
  const [nombre, setNombre] = useState('');
  const [emojiElegido, setEmojiElegido] = useState('');
  const [participanteActivo, setParticipanteActivo] = useState(null);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const salaDesdeQR = parametros.get('sala');
    if (salaDesdeQR) {
      setCodigoDeSala(salaDesdeQR);
      const guardado = leerParticipanteGuardado(salaDesdeQR);
      if (guardado) {
        setParticipanteActivo(guardado);
      }
    }
  }, []);

  function elegirEmojiAlAzar() {
    const indiceAleatorio = Math.floor(Math.random() * EMOJIS_DISPONIBLES.length);
    setEmojiElegido(EMOJIS_DISPONIBLES[indiceAleatorio]);
  }

  // Identidades de visitas anteriores a esta misma sala (pestaña cerrada por error, por ejemplo).
  const identidadesRecordadas = useMemo(
    () => (codigoDeSala.length === 4 ? leerIdentidadesRecordadas(codigoDeSala) : []),
    [codigoDeSala]
  );

  function continuarConIdentidadRecordada(identidadElegida) {
    const { guardadaEn, ...datos } = identidadElegida;
    guardarParticipanteActivo(datos);
    setParticipanteActivo(datos);
  }

  function manejarIngreso(evento) {
    evento.preventDefault();
    const datos = { codigoDeSala, participantId: generarParticipantId(), nombre, emoji: emojiElegido };
    guardarParticipanteActivo(datos);
    setParticipanteActivo(datos);
  }

  if (participanteActivo) {
    return (
      <SesionDeParticipante
        {...participanteActivo}
        onSalir={() => {
          borrarParticipanteActivo(participanteActivo.participantId);
          setParticipanteActivo(null);
        }}
      />
    );
  }

  return (
    <main>
      <h1>R2 Argumentum</h1>
      <h2>Unirme a la sala</h2>
      {identidadesRecordadas.length > 0 && (
        <section className="tarjeta-de-identidad-recordada">
          <p>
            Ya habías entrado a la sala {codigoDeSala} en este navegador. ¿Se cerró la pestaña sin querer?
            Continúa con tu identidad y conservas tus puntos y argumentos:
          </p>
          {identidadesRecordadas.map((identidad) => (
            <button key={identidad.participantId} type="button" onClick={() => continuarConIdentidadRecordada(identidad)}>
              Continuar como {identidad.emoji} {identidad.nombre}
            </button>
          ))}
          <p className="texto-de-ayuda">
            Si eres otra persona que usa este mismo dispositivo, completa el formulario de abajo.
          </p>
        </section>
      )}
      <form onSubmit={manejarIngreso}>
        <label>
          Código de sala
          <input
            value={codigoDeSala}
            onChange={(evento) => setCodigoDeSala(evento.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            inputMode="numeric"
            maxLength={4}
          />
        </label>
        <label>
          Tu nombre
          <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Ej. Arturo" />
        </label>
        <fieldset>
          <legend>Tu avatar</legend>
          <button type="button" className="boton-sorpreendeme" onClick={elegirEmojiAlAzar}>
            🎲 Sorpréndeme
          </button>
          <div className="grilla-de-emojis">
            {EMOJIS_DISPONIBLES.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className={emoji === emojiElegido ? 'emoji-seleccionado' : ''}
                onClick={() => setEmojiElegido(emoji)}
                aria-label={`Elegir avatar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="texto-de-ayuda">Toca un emoji: así es como te van a ver en el marcador.</p>
        </fieldset>
        <button type="submit" disabled={!codigoDeSala || !nombre || !emojiElegido}>
          Entrar
        </button>
      </form>
      <Creditos />
    </main>
  );
}

function SesionDeParticipante({ codigoDeSala, participantId, nombre, emoji, onSalir }) {
  // Entra a presencia apenas se conecta — el requisito de ingreso con argumento (docs/09) lo
  // marca `ingresoConfirmado` en el reducer, no la presencia de Ably. Entrar antes de confirmar
  // es lo que le permite al host ver, en la sala de configuración previa, quién está conectado
  // pero todavía escribiendo (ver ListaDeParticipantes.jsx y PanelDeAvisos.jsx).
  const { estado, presencia, publicar, cargando, conexion } = useEstadoDeSesion({
    clientId: participantId,
    sessionId: codigoDeSala,
    datosDePresencia: { nombre, emoji },
  });

  if (!cargando && !estado.programa) {
    return (
      <main>
        <h1>R2 Argumentum</h1>
        <p className="mensaje-de-error">
          No se pudo recuperar la sesión de la sala {codigoDeSala} — probablemente pasó mucho tiempo desde que
          empezó y el historial ya expiró. Pídele al moderador el código vigente y vuelve a entrar.
        </p>
        <button type="button" onClick={onSalir}>
          Volver a entrar
        </button>
      </main>
    );
  }

  if (cargando || !estado.programa) {
    // cargando=false con programa=null ya se cubrió arriba (historial expirado);
    // aquí solo queda el caso normal: todavía conectando.
    return (
      <main>
        <h1>R2 Argumentum</h1>
        <p className="texto-de-ayuda">
          Conectando a la sala {codigoDeSala} como {nombre} {emoji}…
        </p>
      </main>
    );
  }

  const { programa } = estado;
  const soyComoderador = soyCoModerador(estado, participantId);
  const oferta = miOfertaDeTurno(estado, participantId);
  const tengoElTurno = tengoElTurnoEnCurso(estado, participantId);
  const misArgumentosLibres = misArgumentosSinConexionSaliente(estado, participantId);
  const sugerenciasVisibles = obtenerSugerenciasVisiblesParaParticipante(estado, participantId);
  const miPostura = programa.posturas.find((postura) => postura.id === estado.participantes[participantId]?.stanceId);
  const miPuntaje = estado.participantes[participantId]?.puntajeTotal ?? 0;
  const sesionCerrada = estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING || estado.sesion.cerrada;
  const ingresoConfirmado = Boolean(estado.participantes[participantId]?.ingresoConfirmado);
  const tieneArgumentoListo = Boolean(estado.participantes[participantId]?.argumentoListo);
  const ingresoCerrado = ingresoEstaCerrado(estado);

  // Requisito de ingreso: sin argumento aprobado no se entra al roster (docs/09). Si el debate
  // ya arrancó, quien no alcanzó a confirmar se queda como oyente y solo mira.
  // `lang` en la raíz de lo que ve el participante: lo heredan todos los campos de texto y de ahí
  // el corrector del navegador toma el idioma del debate (español por defecto).
  const idiomaDelDebate = resolverIdiomaDelDebate(programa);

  if (!ingresoConfirmado && !ingresoCerrado) {
    return (
      <main lang={idiomaDelDebate}>
        <div className="barra-superior">
          <h1>{programa.titulo}</h1>
        </div>
        <p className="texto-de-ayuda">
          {emoji} {nombre} · {programa.temaCentral}
        </p>
        <AvisoDeConexion conexion={conexion} />
        <IngresoConArgumento
          estado={estado}
          programa={programa}
          presencia={presencia}
          participantId={participantId}
          nombre={nombre}
          emoji={emoji}
          publicar={publicar}
        />
      </main>
    );
  }

  return (
    <main lang={idiomaDelDebate}>
      <div className="barra-superior">
        <h1>{programa.titulo}</h1>
      </div>
      <p className="texto-de-ayuda">
        {emoji} {nombre} {soyComoderador && <span className="chip-de-rol">Co-moderador</span>}
        {miPostura && (
          <span className="chip-de-postura" style={{ color: miPostura.color }}>
            {miPostura.etiqueta}
          </span>
        )}
        · {miPuntaje} pts
      </p>

      <AvisoDeConexion conexion={conexion} />
      <DestacadoDelTurno
        estado={estado}
        presencia={presencia}
        programa={programa}
        omitirParaParticipanteId={participantId}
      />

      <div className="layout-de-participante">
        <CapaInstruccional estado={estado} presencia={presencia} participantId={participantId} sinFijar={estado.sesion.cerrada} />

        <div className="columna-de-trabajo">
          <AvisoPreparateParaHablar
            visible={!sesionCerrada && !soyComoderador && ingresoConfirmado && tieneArgumentoListo && !oferta && !tengoElTurno}
          />
      {/* El podio solo aparece con el debate REALMENTE cerrado: los ajustes de las exposiciones se
          aplican justo antes de session.closed, así que antes de eso los puntajes no son los finales. */}
      {estado.sesion.cerrada && (
        <PodioFinalParaParticipantes estado={estado} programa={programa} presencia={presencia} participantId={participantId} />
      )}
      {sesionCerrada && !estado.sesion.cerrada && (
        <section className="tarjeta-de-turno-ofrecido">
          <p className="texto-de-ayuda">🥁 El moderador está por cerrar el debate. En cuanto lo haga, aquí aparece el podio.</p>
        </section>
      )}

      {!sesionCerrada && !ingresoConfirmado && (
        <>
          <section className="tarjeta-de-turno-ofrecido">
            <p className="mensaje-de-error">
              Estás como oyente: el debate empezó antes de que confirmaras tu argumento de ingreso. Puedes seguir
              todo lo que pasa, pero no recibes turnos ni puntaje.
            </p>
          </section>
          <FormularioDeContraargumentoParaOyentes
            estado={estado}
            programa={programa}
            presencia={presencia}
            participantId={participantId}
            nombre={nombre}
            emoji={emoji}
            publicar={publicar}
          />
        </>
      )}

      {!sesionCerrada && <FeedDeActividad estado={estado} presencia={presencia} />}

      {!sesionCerrada && soyComoderador && (
        <PanelDeCoModerador estado={estado} presencia={presencia} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && oferta && (
        <PantallaDeTurnoOfrecido
          oferta={oferta}
          estado={estado}
          programa={programa}
          participantId={participantId}
          publicar={publicar}
        />
      )}

      {/* Turno hablado sin argumento escrito: no hay nada que publicar, solo registrar que
          habló para que un co-moderador lo califique. */}
      {!sesionCerrada && !soyComoderador && tengoElTurno && estado.turnos.turnoEnCurso.modo === 'verbal' && (
        <IntervencionVerbal
          turnoEnCurso={estado.turnos.turnoEnCurso}
          participantId={participantId}
          publicar={publicar}
        />
      )}

      {/* Preparación de argumentos: se escribe mientras otros hablan y queda esperando turno.
          El mismo componente muestra el argumento listo cuando llega la palabra. */}
      {!sesionCerrada &&
        !soyComoderador &&
        ingresoConfirmado &&
        estado.turnos.turnoEnCurso?.modo !== 'verbal' && (
          <PrepararArgumento
            estado={estado}
            programa={programa}
            presencia={presencia}
            participantId={participantId}
            publicar={publicar}
          />
        )}

      {!sesionCerrada &&
        !soyComoderador &&
        ingresoConfirmado &&
        !tengoElTurno &&
        estado.turnos.turnoEnCurso &&
        estado.turnos.turnoEnCurso.participantId !== participantId && (
          <PanelDeBid estado={estado} participantId={participantId} turnoEnCurso={estado.turnos.turnoEnCurso} publicar={publicar} />
        )}

      {!sesionCerrada && ingresoConfirmado && sugerenciasVisibles.length > 0 && (
        <PanelDeSugerencias estado={estado} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && ingresoConfirmado && misArgumentosLibres.length > 0 && (
        <PanelDeConexionLibre estado={estado} participantId={participantId} publicar={publicar} />
      )}

      <GrafoDeArgumentos estado={estado} programa={programa} presencia={presencia} />

      <p className="texto-de-ayuda">
        Conectado —{' '}
        {
          presencia.filter(
            (presente) =>
              presente.conectado !== false && estado.participantes[presente.participantId]?.ingresoConfirmado
          ).length
        }{' '}
        participante(s) en el debate.
      </p>
        </div>
      </div>
    </main>
  );
}
