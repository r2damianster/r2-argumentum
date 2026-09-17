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
import { PantallaDeRanking } from './componentes/PantallaDeRanking.jsx';
import { GrafoDeArgumentos } from '../shared/componentes/GrafoDeArgumentos.jsx';
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

function generarCodigoDeSala() {
  return String(Math.floor(1000 + Math.random() * 9000));
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

function ConsolaDelHost({ onCerrarSesion }) {
  const sesionRestaurada = useRef(leerSesionActivaGuardada()).current;
  const [programaActivo, setProgramaActivo] = useState(sesionRestaurada?.programa ?? null);
  const [codigoDeSala, setCodigoDeSala] = useState(sesionRestaurada?.codigoDeSala ?? null);
  const [errorDeCarga, setErrorDeCarga] = useState('');

  function activarPrograma(programa) {
    const nuevoCodigoDeSala = generarCodigoDeSala();
    setProgramaActivo(programa);
    setCodigoDeSala(nuevoCodigoDeSala);
    guardarSesionActiva({ programa, codigoDeSala: nuevoCodigoDeSala });
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
          <h2>Elegí el Programa de Debate a abrir</h2>
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
      onCambiarPrograma={cambiarPrograma}
      onCerrarSesion={onCerrarSesion}
    />
  );
}

function ConsolaDeSesion({ programa, codigoDeSala, onCambiarPrograma, onCerrarSesion }) {
  // Link corto para compartir (WhatsApp, etc.) — la raíz con ?sala= redirige a
  // /player.html?sala= vía vercel.json (solo en el deploy, no en `npm run dev` local).
  const urlDeIngreso = `${window.location.origin}/?sala=${codigoDeSala}`;
  const { estado, eventos, presencia, publicar, cargando } = useEstadoDeSesion({
    clientId: 'host',
    sessionId: codigoDeSala,
  });
  const motor = useMotorDeSesion({ estado, presencia, publicar, programa });

  const programaYaPublicadoRef = useRef(false);
  useEffect(() => {
    if (!cargando && !programaYaPublicadoRef.current) {
      programaYaPublicadoRef.current = true;
      publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;
  const mostrarRanking = estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING || estado.sesion.cerrada;
  // Una vez que el Programa se publicó al canal (ver efecto arriba), estado.programa es la
  // fuente de verdad — puede diferir del prop `programa` original si el moderador filtró
  // posturas al iniciar sesión (ver ControlDeFases). Antes de eso, cae al prop cargado.
  const programaVisible = estado.programa ?? programa;

  return (
    <main className="consola-de-sesion">
      <div className="barra-superior">
        <h1>Consola del host</h1>
        <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
          Cerrar sesión
        </button>
      </div>

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
            Compartí el código o el QR para que se vayan conectando. Cuando estés listo, elegí las posturas de
            esta sesión y arrancá — recién ahí empieza el debate para todos.
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
          <ControlDeFases estado={estado} motor={motor} programa={programaVisible} publicar={publicar} />
        </section>
      ) : (
        <>
          <ControlDeFases estado={estado} motor={motor} programa={programaVisible} publicar={publicar} />
          <FeedDeActividad estado={estado} presencia={presencia} />
          <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          <PanelDeDecisionDeBids estado={estado} motor={motor} />
          <GrafoDeArgumentos estado={estado} programa={programaVisible} presencia={presencia} />
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
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso/soporte de clipboard — el link ya está visible como texto arriba.
    }
  }

  return (
    <button type="button" className="boton-cambiar-programa" onClick={copiar}>
      {copiado ? '✅ Copiado' : '📋 Copiar link para compartir'}
    </button>
  );
}
