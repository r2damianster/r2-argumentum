import { useEffect, useState } from 'react';
import { useEstadoDeSesion } from '../shared/estado/useEstadoDeSesion.js';
import { TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import {
  soyCoModerador,
  misArgumentosSinConexionSaliente,
  obtenerSugerenciasVisiblesParaParticipante,
  calcularRankingPorPostura,
} from '../shared/estado/seleccionesDerivadas.js';
import { miOfertaDeTurno, tengoElTurnoEnCurso } from './estadoDelParticipante.js';
import { PantallaDeTurnoOfrecido } from './componentes/PantallaDeTurnoOfrecido.jsx';
import { FormularioDeArgumento } from './componentes/FormularioDeArgumento.jsx';
import { GrafoDeArgumentos } from '../shared/componentes/GrafoDeArgumentos.jsx';
import { FeedDeActividad } from '../shared/componentes/FeedDeActividad.jsx';
import { CapaInstruccional } from '../shared/componentes/CapaInstruccional.jsx';
import { PanelDeConexionLibre } from './componentes/PanelDeConexionLibre.jsx';
import { PanelDeSugerencias } from './componentes/PanelDeSugerencias.jsx';
import { PanelDeBid } from './componentes/PanelDeBid.jsx';
import { PanelDeCoModerador } from './componentes/PanelDeCoModerador.jsx';
import { IngresoConArgumento } from './componentes/IngresoConArgumento.jsx';
import { PrepararArgumento } from './componentes/PrepararArgumento.jsx';
import { IntervencionVerbal } from './componentes/IntervencionVerbal.jsx';
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

function guardarParticipanteActivo(datos) {
  try {
    sessionStorage.setItem(CLAVE_DE_PARTICIPANTE_ACTIVO, JSON.stringify(datos));
  } catch {
    // Sin sessionStorage disponible, simplemente no sobrevive a un refresh.
  }
}

function borrarParticipanteActivo() {
  try {
    sessionStorage.removeItem(CLAVE_DE_PARTICIPANTE_ACTIVO);
  } catch {
    // no-op
  }
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
          borrarParticipanteActivo();
          setParticipanteActivo(null);
        }}
      />
    );
  }

  return (
    <main>
      <h1>R2 Argumentum</h1>
      <h2>Unirme a la sala</h2>
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
    </main>
  );
}

function SesionDeParticipante({ codigoDeSala, participantId, nombre, emoji, onSalir }) {
  // Entra a presencia apenas se conecta — el requisito de ingreso con argumento (docs/09) lo
  // marca `ingresoConfirmado` en el reducer, no la presencia de Ably. Entrar antes de confirmar
  // es lo que le permite al host ver, en la sala de configuración previa, quién está conectado
  // pero todavía escribiendo (ver ListaDeParticipantes.jsx y PanelDeAvisos.jsx).
  const { estado, presencia, publicar, cargando } = useEstadoDeSesion({
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
  const enFaseDeApertura = estado.fase.actual?.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA;
  const yaEscribiMiApertura = (estado.participantes[participantId]?.posicionesCompletadas ?? 0) >= 1;
  const sinArgumentoDeApertura = Boolean(estado.participantes[participantId]?.sinArgumentoDeApertura);
  const ingresoConfirmado = Boolean(estado.participantes[participantId]?.ingresoConfirmado);
  const ingresoCerrado = ingresoEstaCerrado(estado);

  // Requisito de ingreso: sin argumento aprobado no se entra al roster (docs/09). Si el debate
  // ya arrancó, quien no alcanzó a confirmar se queda como oyente y solo mira.
  if (!ingresoConfirmado && !ingresoCerrado) {
    return (
      <main>
        <div className="barra-superior">
          <h1>{programa.titulo}</h1>
        </div>
        <p className="texto-de-ayuda">
          {emoji} {nombre} · {programa.temaCentral}
        </p>
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
    <main>
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

      <div className="layout-de-participante">
        <CapaInstruccional estado={estado} presencia={presencia} participantId={participantId} />

        <div className="columna-de-trabajo">
      {sesionCerrada && <PantallaDeResultadoDelParticipante estado={estado} programa={programa} participantId={participantId} />}

      {!sesionCerrada && !ingresoConfirmado && (
        <section className="tarjeta-de-turno-ofrecido">
          <p className="mensaje-de-error">
            Estás como oyente: el debate empezó antes de que confirmaras tu argumento de ingreso. Puedes seguir
            todo lo que pasa, pero no recibes turnos ni puntaje.
          </p>
        </section>
      )}

      {!sesionCerrada && sinArgumentoDeApertura && (
        <section className="tarjeta-de-turno-ofrecido">
          <p className="mensaje-de-error">
            No alcanzaste a completar tu argumento inicial a tiempo — quedaste sin este argumento y sin turno en
            la ruleta de esta sesión. Puedes seguir mirando el debate.
          </p>
        </section>
      )}

      {!sesionCerrada && enFaseDeApertura && <CronometroDeApertura apertura={estado.apertura} />}

      {!sesionCerrada && <FeedDeActividad estado={estado} presencia={presencia} />}

      {!sesionCerrada && soyComoderador && (
        <PanelDeCoModerador estado={estado} presencia={presencia} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && ingresoConfirmado && enFaseDeApertura && !yaEscribiMiApertura && (
        <FormularioDeArgumento
          estado={estado}
          programa={programa}
          participantId={participantId}
          publicar={publicar}
          modoApertura
        />
      )}

      {!sesionCerrada && !soyComoderador && enFaseDeApertura && yaEscribiMiApertura && (
        <section className="tarjeta-de-turno-ofrecido">
          <p className="texto-de-ayuda">✅ Ya enviaste tu argumento inicial — esperando a que terminen los demás.</p>
        </section>
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
        !enFaseDeApertura &&
        estado.turnos.turnoEnCurso?.modo !== 'verbal' && (
          <PrepararArgumento estado={estado} programa={programa} participantId={participantId} publicar={publicar} />
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

// Cronómetro de la apertura obligatoria (ver docs/09 y ControlDeFases.jsx del host, que es
// quien realmente decide cuándo se cierra la ronda — este componente solo muestra el plazo
// vigente, nunca cierra nada por su cuenta).
function CronometroDeApertura({ apertura }) {
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!apertura || apertura.cerrada) {
      return undefined;
    }
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [apertura?.ronda, apertura?.cerrada, apertura?.expiraEn]);

  if (!apertura) {
    return null;
  }

  if (apertura.cerrada) {
    if (apertura.esperandoSegundaOportunidad) {
      return (
        <p className="texto-de-ayuda">
          Ronda 1 cerrada — el moderador está decidiendo si da una segunda oportunidad a quienes faltan.
        </p>
      );
    }
    return null;
  }

  const segundosRestantes = Math.max(0, Math.round((apertura.expiraEn - ahora) / 1000));
  return (
    <p className="texto-de-ayuda">
      Ronda {apertura.ronda} de apertura — {segundosRestantes > 0 ? `${segundosRestantes}s restantes` : 'tiempo agotado, esperando al moderador'}
    </p>
  );
}

function PantallaDeResultadoDelParticipante({ estado, programa, participantId }) {
  const ranking = calcularRankingPorPostura(estado, programa);
  const miStanceId = estado.participantes[participantId]?.stanceId;
  const miEntrada = miStanceId
    ? ranking[miStanceId]?.find((participante) => participante.participantId === participantId)
    : null;

  return (
    <section className="tarjeta-de-ranking">
      <h3>Debate cerrado</h3>
      {miEntrada ? (
        <p>
          Tu resultado: {miEntrada.puntajeTotal} pts —{' '}
          {miEntrada.tier === 'Sólido' ? '🥇' : miEntrada.tier === 'Consistente' ? '🥈' : '🥉'} {miEntrada.tier}
        </p>
      ) : (
        <p className="texto-de-ayuda">Gracias por participar.</p>
      )}
    </section>
  );
}
