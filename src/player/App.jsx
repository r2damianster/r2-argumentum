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
import { PanelDeConexionLibre } from './componentes/PanelDeConexionLibre.jsx';
import { PanelDeSugerencias } from './componentes/PanelDeSugerencias.jsx';
import { PanelDeBid } from './componentes/PanelDeBid.jsx';
import { PanelDeCoModerador } from './componentes/PanelDeCoModerador.jsx';
import { SelectorDePosturaPropia } from './componentes/SelectorDePosturaPropia.jsx';

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
          <p className="texto-de-ayuda">Tocá un emoji: es como te van a ver en el marcador.</p>
        </fieldset>
        <button type="submit" disabled={!codigoDeSala || !nombre || !emojiElegido}>
          Entrar
        </button>
      </form>
    </main>
  );
}

function SesionDeParticipante({ codigoDeSala, participantId, nombre, emoji, onSalir }) {
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
          empezó y el historial ya expiró. Pedile al moderador el código vigente y volvé a entrar.
        </p>
        <button type="button" onClick={onSalir}>
          Volver a entrar
        </button>
      </main>
    );
  }

  if (cargando || !estado.programa) {
    // cargando=false con programa=null ya se cubrió arriba (historial expirado);
    // acá solo queda el caso normal: todavía conectando.
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
  // Si el Programa deja elegir postura libremente (en vez de asignarla al azar), esperamos
  // a saber si soy co-moderador (comod.selected ya publicado) antes de mostrar el selector —
  // los co-moderadores no argumentan, no deben elegir postura.
  const debeElegirPostura =
    !sesionCerrada &&
    programa.asignacionPostura === 'libre' &&
    estado.coModeradores !== null &&
    !soyComoderador &&
    !estado.participantes[participantId]?.stanceId;
  const enFaseDeApertura = estado.fase.actual?.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA;
  const yaEscribiMiApertura = (estado.participantes[participantId]?.posicionesCompletadas ?? 0) >= 1;

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

      {sesionCerrada && <PantallaDeResultadoDelParticipante estado={estado} programa={programa} participantId={participantId} />}

      {debeElegirPostura && (
        <SelectorDePosturaPropia programa={programa} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && <FeedDeActividad estado={estado} presencia={presencia} />}

      {!sesionCerrada && soyComoderador && (
        <PanelDeCoModerador estado={estado} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && !debeElegirPostura && enFaseDeApertura && !yaEscribiMiApertura && (
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
        <PantallaDeTurnoOfrecido oferta={oferta} estado={estado} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && tengoElTurno && (
        <FormularioDeArgumento
          estado={estado}
          programa={programa}
          participantId={participantId}
          turnoEnCurso={estado.turnos.turnoEnCurso}
          publicar={publicar}
        />
      )}

      {!sesionCerrada &&
        !soyComoderador &&
        !tengoElTurno &&
        estado.turnos.turnoEnCurso &&
        estado.turnos.turnoEnCurso.participantId !== participantId && (
          <PanelDeBid estado={estado} participantId={participantId} turnoEnCurso={estado.turnos.turnoEnCurso} publicar={publicar} />
        )}

      {!sesionCerrada && sugerenciasVisibles.length > 0 && (
        <PanelDeSugerencias estado={estado} participantId={participantId} publicar={publicar} />
      )}

      {!sesionCerrada && !soyComoderador && misArgumentosLibres.length > 0 && (
        <PanelDeConexionLibre estado={estado} participantId={participantId} publicar={publicar} />
      )}

      <GrafoDeArgumentos estado={estado} programa={programa} presencia={presencia} />

      <p className="texto-de-ayuda">
        Conectado — {presencia.filter((presente) => presente.conectado !== false).length} participante(s) en la
        sala.
      </p>
    </main>
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
