import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cargarPrograma } from '../shared/programa/cargarPrograma.js';
import { PROGRAMAS_DE_EJEMPLO, agruparProgramasPorCategoria } from '../shared/programa/ejemplos/index.js';
import { useEstadoDeSesion } from '../shared/estado/useEstadoDeSesion.js';
import { EVENTOS, TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import { useMotorDeSesion } from './useMotorDeSesion.js';
import { ControlDeFases } from './componentes/ControlDeFases.jsx';
import { ListaDeParticipantes } from './componentes/ListaDeParticipantes.jsx';
import { PanelDeDecisionDeBids } from './componentes/PanelDeDecisionDeBids.jsx';
import { PanelDePosturasPropuestas } from './componentes/PanelDePosturasPropuestas.jsx';
import { VistaEspejoDeParticipante } from './componentes/VistaEspejoDeParticipante.jsx';
import { PanelDeAvisos } from './componentes/PanelDeAvisos.jsx';
import { InformeDelDebate } from './componentes/InformeDelDebate.jsx';
import { PantallaDeRanking } from './componentes/PantallaDeRanking.jsx';
import { GrafoDeArgumentos } from '../shared/componentes/GrafoDeArgumentos.jsx';
import { AvisoDeConexion } from '../shared/componentes/AvisoDeConexion.jsx';
import { FeedDeActividad } from '../shared/componentes/FeedDeActividad.jsx';

// Credencial hardcodeada a propósito, mismo criterio que R2 Quiz (ver docs/07-acceso-y-paginas.md):
// esta consola no maneja información sensible, así que no requiere autenticación real.
const USUARIO_VALIDO = 'arturo.rodriguez@uleam.edu.ec';
const CLAVE_VALIDA = 'R2ironmaiden';

const CLAVE_DE_SESION_ACTIVA = 'r2-argumentum-sesion-activa';
const CLAVE_DE_LOGIN_RECORDADO = 'r2-argumentum-host-autenticado';

// Recordar el login en localStorage (no sessionStorage) — sobrevive cerrar el navegador.
// Mismo criterio que la credencial hardcodeada: esta consola no maneja información
// sensible, así que no hay costo real en no pedirla cada vez (docs/07-acceso-y-paginas.md).
function leerLoginRecordado() {
  try {
    return localStorage.getItem(CLAVE_DE_LOGIN_RECORDADO) === 'true';
  } catch {
    return false;
  }
}

function guardarLoginRecordado(recordar) {
  try {
    if (recordar) {
      localStorage.setItem(CLAVE_DE_LOGIN_RECORDADO, 'true');
    } else {
      localStorage.removeItem(CLAVE_DE_LOGIN_RECORDADO);
    }
  } catch {
    // Sin localStorage disponible, simplemente vuelve a pedir usuario/clave cada vez.
  }
}

export default function App() {
  const [autenticado, setAutenticado] = useState(() => leerLoginRecordado());
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mensajeDeError, setMensajeDeError] = useState('');

  function manejarEnvioDeLogin(evento) {
    evento.preventDefault();
    if (usuario === USUARIO_VALIDO && clave === CLAVE_VALIDA) {
      setMensajeDeError('');
      guardarLoginRecordado(true);
      setAutenticado(true);
    } else {
      setMensajeDeError('Usuario o clave incorrectos.');
    }
  }

  function cerrarSesionDeHost() {
    guardarLoginRecordado(false);
    setAutenticado(false);
  }

  if (autenticado) {
    return <ConsolaDelHost onCerrarSesion={cerrarSesionDeHost} />;
  }

  return (
    <main>
      <img src="/avatar.png" alt="R2 Argumentum" className="portada" />
      <h1>R2 Argumentum · Consola del host</h1>
      <p className="acceso-reservado">
        Acceso reservado. Solo el docente moderador entra aquí. Los estudiantes entran en{' '}
        <code>/player.html</code>.
      </p>
      <form onSubmit={manejarEnvioDeLogin}>
        <label>
          Usuario
          <input value={usuario} onChange={(evento) => setUsuario(evento.target.value)} autoComplete="username" />
        </label>
        <label>
          Clave
          <input
            type="password"
            value={clave}
            onChange={(evento) => setClave(evento.target.value)}
            autoComplete="current-password"
          />
        </label>
        {mensajeDeError && <p className="mensaje-de-error">{mensajeDeError}</p>}
        <button type="submit">Entrar</button>
      </form>
      <footer>R2 Argumentum — Arturo Damián Rodríguez Zambrano · Docente, investigador y vibe coder</footer>
    </main>
  );
}

// "Cerrar sesión" desconecta al host del canal — con el debate en curso eso apaga la
// proyección y, si pasan más de ~2 minutos antes de volver a entrar, el historial de Ably ya
// expiró y la vista en vivo no se puede reconstruir (queda como sala de configuración vacía).
// Antes no avisaba nada, mismo botón con el mismo riesgo silencioso estuviera el debate
// arrancado o no. Bug real reportado en prueba en vivo.
function cerrarSesionConAviso(sesionIniciada, onCerrarSesion) {
  if (
    !sesionIniciada ||
    window.confirm(
      'El debate sigue en curso. Si tardas en volver a entrar, la vista en vivo puede perderse. ¿Cerrar sesión igual?'
    )
  ) {
    onCerrarSesion();
  }
}

function generarCodigoDeSala() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// El código de sala de 4 dígitos se puede repetir entre debates (son 10.000 combinaciones y
// no hay control de colisión), y el canal de Ably se llama solo con ese código. Sin una marca
// propia por sesión, un debate nuevo hereda del historial del canal los argumentos y el
// comod.selected del debate anterior — bug real: unos participantes veían 4 nodos en el grafo
// y otros 2, y el rol de co-moderador quedaba asignado a gente que ya no estaba.
function generarIdentificadorDeSesion() {
  return `sesion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function leerSesionActivaGuardada() {
  try {
    const guardada = sessionStorage.getItem(CLAVE_DE_SESION_ACTIVA);
    return guardada ? JSON.parse(guardada) : null;
  } catch {
    return null;
  }
}

function guardarSesionActiva(sesion) {
  try {
    sessionStorage.setItem(CLAVE_DE_SESION_ACTIVA, JSON.stringify(sesion));
  } catch {
    // Sin sessionStorage disponible, simplemente no persiste entre refrescos.
  }
}

function borrarSesionActivaGuardada() {
  try {
    sessionStorage.removeItem(CLAVE_DE_SESION_ACTIVA);
  } catch {
    // no-op
  }
}

// Solo vale la pena restaurar automáticamente una sesión guardada si ya estaba iniciada
// (evita perder progreso real de un debate en curso ante un refresh accidental). Si quedó
// parada en "sala de configuración previa" sin iniciar, se descarta — cada login nuevo debe
// mostrar la lista de Programas, no reabrir directo el último que se estaba configurando.
function resolverSesionInicial() {
  const guardada = leerSesionActivaGuardada();
  // Sin identificadorDeSesion no se puede separar esta sesión de las anteriores en el mismo
  // código de sala, así que una sesión guardada en el formato viejo se descarta.
  if (guardada?.iniciada && guardada.identificadorDeSesion) {
    return guardada;
  }
  if (guardada) {
    borrarSesionActivaGuardada();
  }
  return null;
}

function ConsolaDelHost({ onCerrarSesion }) {
  const [sesionRestaurada] = useState(resolverSesionInicial);
  const [programaActivo, setProgramaActivo] = useState(sesionRestaurada?.programa ?? null);
  const [codigoDeSala, setCodigoDeSala] = useState(sesionRestaurada?.codigoDeSala ?? null);
  const [identificadorDeSesion, setIdentificadorDeSesion] = useState(sesionRestaurada?.identificadorDeSesion ?? null);
  const [errorDeCarga, setErrorDeCarga] = useState('');

  function activarPrograma(programa) {
    const nuevoCodigoDeSala = generarCodigoDeSala();
    const nuevoIdentificadorDeSesion = generarIdentificadorDeSesion();
    setProgramaActivo(programa);
    setCodigoDeSala(nuevoCodigoDeSala);
    setIdentificadorDeSesion(nuevoIdentificadorDeSesion);
    guardarSesionActiva({
      programa,
      codigoDeSala: nuevoCodigoDeSala,
      identificadorDeSesion: nuevoIdentificadorDeSesion,
    });
    setErrorDeCarga('');
  }

  function manejarSeleccionDeArchivo(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) {
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      try {
        activarPrograma(cargarPrograma(lector.result));
      } catch (error) {
        setErrorDeCarga(error.message);
      }
    };
    lector.readAsText(archivo);
    evento.target.value = '';
  }

  function usarProgramaDeEjemplo(programaDeEjemplo) {
    try {
      activarPrograma(cargarPrograma(JSON.stringify(programaDeEjemplo)));
    } catch (error) {
      setErrorDeCarga(error.message);
    }
  }

  function cambiarPrograma() {
    setProgramaActivo(null);
    setCodigoDeSala(null);
    setIdentificadorDeSesion(null);
    borrarSesionActivaGuardada();
  }

  if (!programaActivo || !codigoDeSala) {
    const categoriasDeEjemplos = agruparProgramasPorCategoria(PROGRAMAS_DE_EJEMPLO);

    return (
      <main>
        <div className="barra-superior">
          <h1>Consola del host</h1>
          <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
        <section className="tarjeta-de-programa">
          <h2>Elige el Programa de Debate a abrir</h2>
          <p className="texto-de-ayuda">
            Un Programa define el tema, las posturas, las reglas de puntaje y los ejemplos para Groq de esta
            sesión. Ver <code>docs/03-programa-de-debate.md</code>.
          </p>
          <label className="boton-cargar-archivo">
            Cargar archivo propio (.json)
            <input type="file" accept="application/json" onChange={manejarSeleccionDeArchivo} />
          </label>

          {[...categoriasDeEjemplos.entries()].map(([categoria, programas]) => (
            <div key={categoria} className="categoria-de-programas">
              <h3>{categoria}</h3>
              <ul className="lista-de-programas-de-ejemplo">
                {programas.map((programa) => (
                  <li key={programa.programId}>
                    <button type="button" onClick={() => usarProgramaDeEjemplo(programa)}>
                      {programa.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {errorDeCarga && <p className="mensaje-de-error">{errorDeCarga}</p>}
        </section>
      </main>
    );
  }

  return (
    <ConsolaDeSesion
      programa={programaActivo}
      codigoDeSala={codigoDeSala}
      identificadorDeSesion={identificadorDeSesion}
      onCambiarPrograma={cambiarPrograma}
      onCerrarSesion={onCerrarSesion}
    />
  );
}

function ConsolaDeSesion({ programa, codigoDeSala, identificadorDeSesion, onCambiarPrograma, onCerrarSesion }) {
  // Link corto para compartir (WhatsApp, etc.) — la raíz con ?sala= redirige a
  // /player.html?sala= vía vercel.json (solo en el deploy, no en `npm run dev` local).
  const urlDeIngreso = `${window.location.origin}/?sala=${codigoDeSala}`;
  const { estado, eventos, presencia, publicar, cargando, conexion } = useEstadoDeSesion({
    clientId: 'host',
    sessionId: codigoDeSala,
  });
  const motor = useMotorDeSesion({ estado, presencia, publicar, programa });

  const [modoProyeccion, setModoProyeccion] = useState(false);
  const programaYaPublicadoRef = useRef(false);
  useEffect(() => {
    if (cargando || programaYaPublicadoRef.current) {
      return;
    }
    programaYaPublicadoRef.current = true;
    // Una sesión que ya estaba iniciada y cuyo historial ya no trae su Programa (expiró en
    // Ably) no se puede reconstruir: republicarlo la dejaba como una sala de configuración
    // nueva con el MISMO código, y cualquier pestaña vieja de participantes se mezclaba con
    // ella. Se vuelve a la lista de Programas, que emite un código nuevo.
    const sesionGuardadaEstabaIniciada = Boolean(leerSesionActivaGuardada()?.iniciada);
    const historialSinEstaSesion = !estado.programa || estado.sesion.identificador !== identificadorDeSesion;
    if (sesionGuardadaEstabaIniciada && historialSinEstaSesion) {
      onCambiarPrograma();
      return;
    }
    // Si el canal ya trae el Programa de ESTA sesión, no se republica. El host guarda el
    // Programa tal como lo cargó, sin las posturas filtradas ni el perfil de puntaje que
    // eligió después: republicarlo al refrescar la pestaña le pisaba al debate en curso su
    // propia configuración y devolvía al tablero las posturas que el moderador había sacado.
    if (estado.programa && estado.sesion.identificador === identificadorDeSesion) {
      return;
    }
    publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa, identificadorDeSesion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;

  // Recién aquí se marca la sesión guardada como "iniciada" — antes de esto (sala de
  // configuración previa) un refresh de la pestaña debe volver a la lista de Programas,
  // no reabrir directo esta configuración a medio hacer (ver resolverSesionInicial arriba).
  useEffect(() => {
    if (sesionIniciada) {
      // Se guarda el Programa VIGENTE (el del canal, con las posturas y el perfil que eligió
      // el moderador), no el archivo original: es el que hay que reabrir si refresca.
      guardarSesionActiva({
        programa: estado.programa ?? programa,
        codigoDeSala,
        identificadorDeSesion,
        iniciada: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionIniciada, estado.programa]);
  const mostrarRanking = estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING || estado.sesion.cerrada;
  // Una vez que el Programa se publicó al canal (ver efecto arriba), estado.programa es la
  // fuente de verdad — puede diferir del prop `programa` original si el moderador filtró
  // posturas al iniciar sesión (ver ControlDeFases). Antes de eso, cae al prop cargado.
  const programaVisible = estado.programa ?? programa;

  // Modo proyección: la consola se usa casi siempre desde una laptop conectada al proyector,
  // y los controles del moderador no tienen por qué leerse desde el fondo del aula. Este modo
  // agranda todo y deja solo lo que la clase necesita ver.
  if (modoProyeccion) {
    return (
      <main className="consola-de-sesion modo-proyeccion">
        <div className="barra-superior">
          <h1>{programaVisible.titulo}</h1>
          <button type="button" className="boton-cerrar-sesion" onClick={() => setModoProyeccion(false)}>
            Salir de proyección
          </button>
        </div>
        <AvisoDeConexion conexion={conexion} />
        <FeedDeActividad estado={estado} presencia={presencia} />
        <GrafoDeArgumentos estado={estado} programa={programaVisible} presencia={presencia} />
        <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
      </main>
    );
  }

  return (
    <main className="consola-de-sesion">
      <div className="barra-superior">
        <h1>Consola del host</h1>
        <div className="acciones-de-barra">
          {sesionIniciada && (
            <button type="button" className="boton-cerrar-sesion" onClick={() => setModoProyeccion(true)}>
              📽️ Proyectar
            </button>
          )}
          <button type="button" className="boton-cerrar-sesion" onClick={() => cerrarSesionConAviso(sesionIniciada, onCerrarSesion)}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <AvisoDeConexion conexion={conexion} />

      <section className="tarjeta-de-programa">
        <p className="texto-de-ayuda">Programa activo</p>
        <h2>{programaVisible.titulo}</h2>
        <p>{programaVisible.temaCentral}</p>
        <ul className="lista-de-posturas">
          {programaVisible.posturas.map((postura) => (
            <li key={postura.id} style={{ color: postura.color }}>
              {postura.etiqueta}
            </li>
          ))}
        </ul>
        {!sesionIniciada && (
          <button type="button" className="boton-cambiar-programa" onClick={onCambiarPrograma}>
            Cambiar Programa de Debate
          </button>
        )}
      </section>

      {cargando ? (
        <p className="texto-de-ayuda">Conectando al canal de la sesión…</p>
      ) : !sesionIniciada ? (
        // Sala de configuración previa: se comparte el código/QR para que los estudiantes
        // ya se vayan conectando mientras el moderador elige posturas y decide cuándo
        // arrancar — recién ahí pasa a la vista "en vivo" de abajo.
        <section className="tarjeta-de-sala-de-configuracion">
          <h3>Sala de configuración previa</h3>
          <p className="texto-de-ayuda">
            Comparte el código o el QR para que se vayan conectando. Cuando estés listo, elige las posturas de
            esta sesión y comienza — recién ahí empieza el debate para todos.
          </p>
          <div className="tarjeta-de-sala">
            <p className="texto-de-ayuda">Código de sala</p>
            <p className="codigo-de-sala">{codigoDeSala}</p>
            <QRCodeSVG value={urlDeIngreso} size={180} bgColor="#ffffff" fgColor="#0f172a" />
            <p className="texto-de-ayuda">
              Los estudiantes escanean el QR, o entran a <code>{urlDeIngreso}</code>, o entran a{' '}
              <code>/player.html</code> e ingresan el código a mano.
            </p>
            <BotonCopiarLink url={urlDeIngreso} />
          </div>
          <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          <PanelDeAvisos estado={estado} presencia={presencia} />
          <PanelDePosturasPropuestas
            estado={estado}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
          <ControlDeFases
            estado={estado}
            motor={motor}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
        </section>
      ) : (
        <>
          <PanelDeAvisos estado={estado} presencia={presencia} />
          <ControlDeFases
            estado={estado}
            motor={motor}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
          <FeedDeActividad estado={estado} presencia={presencia} />
          <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          <PanelDePosturasPropuestas
            estado={estado}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
          <PanelDeDecisionDeBids estado={estado} motor={motor} />
          <VistaEspejoDeParticipante estado={estado} presencia={presencia} programa={programaVisible} />
          <GrafoDeArgumentos estado={estado} programa={programaVisible} presencia={presencia} />
          {mostrarRanking && (
            <InformeDelDebate estado={estado} programa={programaVisible} presencia={presencia} eventos={eventos} />
          )}
          {mostrarRanking && (
            <PantallaDeRanking
              estado={estado}
              eventos={eventos}
              programa={programaVisible}
              presencia={presencia}
              motor={motor}
            />
          )}
        </>
      )}
    </main>
  );
}

function BotonCopiarLink({ url }) {
  // `navigator.clipboard` no existe fuera de contexto seguro y puede fallar por permisos. Antes
  // ese caso se tragaba en silencio y el botón no cambiaba nunca — el docente no sabía si había
  // copiado o no. Ahora el fallo muestra el link seleccionable para copiarlo a mano.
  const [resultado, setResultado] = useState(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setResultado('copiado');
      setTimeout(() => setResultado(null), 2000);
    } catch {
      setResultado('fallo');
    }
  }

  if (resultado === 'fallo') {
    return (
      <div>
        <p className="texto-de-ayuda">
          Tu navegador no dejó copiar automáticamente. Selecciona el link y cópialo a mano:
        </p>
        <input readOnly value={url} onFocus={(evento) => evento.target.select()} />
      </div>
    );
  }

  return (
    <button type="button" className="boton-cambiar-programa" onClick={copiar}>
      {resultado === 'copiado' ? '✅ Copiado' : '📋 Copiar link para compartir'}
    </button>
  );
}
