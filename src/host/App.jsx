import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cargarPrograma } from '../shared/programa/cargarPrograma.js';
import { PROGRAMAS_DE_EJEMPLO, agruparProgramasPorCategoria } from '../shared/programa/ejemplos/index.js';
import { useEstadoDeSesion } from '../shared/estado/useEstadoDeSesion.js';
import { EVENTOS, TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import { useMotorDeSesion } from './useMotorDeSesion.js';
import { PantallaDeConfiguracionInicial } from './componentes/PantallaDeConfiguracionInicial.jsx';
import { PanelDeGuiaPedagogica } from './componentes/PanelDeGuiaPedagogica.jsx';
import { ControlDeFases } from './componentes/ControlDeFases.jsx';
import { PanelDeEvaluacionDeExposiciones } from './componentes/PanelDeEvaluacionDeExposiciones.jsx';
import { ListaDeParticipantes } from './componentes/ListaDeParticipantes.jsx';
import { PanelDeDecisionDeBids } from './componentes/PanelDeDecisionDeBids.jsx';
import { PanelDePosturasPropuestas } from './componentes/PanelDePosturasPropuestas.jsx';
import { VistaEspejoDeParticipante } from './componentes/VistaEspejoDeParticipante.jsx';
import { PanelDeAvisos } from './componentes/PanelDeAvisos.jsx';
import { InformeDelDebate } from './componentes/InformeDelDebate.jsx';
import { PantallaDeRanking } from './componentes/PantallaDeRanking.jsx';
import { AccionesDeCierre } from './componentes/AccionesDeCierre.jsx';
import { VistaDeProyeccion } from './componentes/VistaDeProyeccion.jsx';
import { abrirVentanaDeProyeccion, useEmisorDeProyeccion } from './proyeccion/canalDeProyeccion.js';
import { GrafoDeArgumentos } from '../shared/componentes/GrafoDeArgumentos.jsx';
import { AvisoDeConexion } from '../shared/componentes/AvisoDeConexion.jsx';
import { FeedDeActividad } from '../shared/componentes/FeedDeActividad.jsx';
import { DestacadoDelTurno } from '../shared/componentes/DestacadoDelTurno.jsx';
import { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO } from '../shared/puntaje/formulaDePuntaje.js';
import { IDIOMAS_DEL_DEBATE } from '../shared/programa/idiomaDelDebate.js';

// Credencial hardcodeada a propósito, mismo criterio que R2 Quiz (ver docs/07-acceso-y-paginas.md):
// esta consola no maneja información sensible, así que no requiere autenticación real.
const USUARIO_VALIDO = 'arturo.rodriguez@uleam.edu.ec';
const CLAVE_VALIDA = 'R2ironmaiden';

const CLAVE_DE_SESION_ACTIVA = 'r2-argumentum-sesion-activa';
const CLAVE_DE_LOGIN_RECORDADO = 'r2-argumentum-host-autenticado';

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
    // Sin localStorage disponible
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
    // Sin sessionStorage disponible
  }
}

function borrarSesionActivaGuardada() {
  try {
    sessionStorage.removeItem(CLAVE_DE_SESION_ACTIVA);
  } catch {
    // no-op
  }
}

function resolverSesionInicial() {
  const guardada = leerSesionActivaGuardada();
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
  const [programaBaseSeleccionado, setProgramaBaseSeleccionado] = useState(null);
  const [programaActivo, setProgramaActivo] = useState(sesionRestaurada?.programa ?? null);
  const [codigoDeSala, setCodigoDeSala] = useState(sesionRestaurada?.codigoDeSala ?? null);
  const [identificadorDeSesion, setIdentificadorDeSesion] = useState(sesionRestaurada?.identificadorDeSesion ?? null);
  const [errorDeCarga, setErrorDeCarga] = useState('');

  function seleccionarProgramaBase(programa) {
    setProgramaBaseSeleccionado(programa);
    setErrorDeCarga('');
  }

  function activarProgramaConfigurado(programaConfigurado) {
    const nuevoCodigoDeSala = generarCodigoDeSala();
    const nuevoIdentificadorDeSesion = generarIdentificadorDeSesion();
    setProgramaActivo(programaConfigurado);
    setCodigoDeSala(nuevoCodigoDeSala);
    setIdentificadorDeSesion(nuevoIdentificadorDeSesion);
    guardarSesionActiva({
      programa: programaConfigurado,
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
        seleccionarProgramaBase(cargarPrograma(lector.result));
      } catch (error) {
        setErrorDeCarga(error.message);
      }
    };
    lector.readAsText(archivo);
    evento.target.value = '';
  }

  function usarProgramaDeEjemplo(programaDeEjemplo) {
    try {
      seleccionarProgramaBase(cargarPrograma(JSON.stringify(programaDeEjemplo)));
    } catch (error) {
      setErrorDeCarga(error.message);
    }
  }

  function cambiarPrograma() {
    setProgramaBaseSeleccionado(null);
    setProgramaActivo(null);
    setCodigoDeSala(null);
    setIdentificadorDeSesion(null);
    borrarSesionActivaGuardada();
  }

  function modificarConfiguracion() {
    const baseActual = programaActivo ?? programaBaseSeleccionado;
    setProgramaActivo(null);
    setCodigoDeSala(null);
    setIdentificadorDeSesion(null);
    borrarSesionActivaGuardada();
    if (baseActual) {
      setProgramaBaseSeleccionado(baseActual);
    }
  }

  // Etapa 1.1: Si aún no se selecciona ningún programa base ni hay sesión activa
  if (!programaActivo && !programaBaseSeleccionado) {
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

  // Etapa 1.2: El programa fue seleccionado pero la sala AÚN no se abre (Pantalla de Configuración Inicial)
  if (programaBaseSeleccionado && (!programaActivo || !codigoDeSala)) {
    return (
      <main>
        <div className="barra-superior">
          <h1>Consola del host</h1>
          <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
        <PantallaDeConfiguracionInicial
          programaBase={programaBaseSeleccionado}
          onConfirmarConfiguracion={activarProgramaConfigurado}
          onCambiarPrograma={cambiarPrograma}
        />
      </main>
    );
  }

  // Etapa 2 y 3: Sala de espera con QR ya generado o debate en vivo
  return (
    <ConsolaDeSesion
      programa={programaActivo}
      codigoDeSala={codigoDeSala}
      identificadorDeSesion={identificadorDeSesion}
      onCambiarPrograma={cambiarPrograma}
      onModificarConfiguracion={modificarConfiguracion}
      onCerrarSesion={onCerrarSesion}
    />
  );
}

function ConsolaDeSesion({ programa, codigoDeSala, identificadorDeSesion, onCambiarPrograma, onModificarConfiguracion, onCerrarSesion }) {
  const urlDeIngreso = `${window.location.origin}/?sala=${codigoDeSala}`;
  const { estado, eventos, presencia, publicar, cargando, conexion } = useEstadoDeSesion({
    clientId: 'host',
    sessionId: codigoDeSala,
  });
  const motor = useMotorDeSesion({ estado, presencia, publicar, programa });

  const [modoProyeccion, setModoProyeccion] = useState(false);
  const [rankingParcialVisible, setRankingParcialVisible] = useState(false);
  const [avisoDeVentanaBloqueada, setAvisoDeVentanaBloqueada] = useState(false);
  const programaYaPublicadoRef = useRef(false);

  useEffect(() => {
    if (cargando || programaYaPublicadoRef.current) {
      return;
    }
    programaYaPublicadoRef.current = true;
    const sesionGuardadaEstabaIniciada = Boolean(leerSesionActivaGuardada()?.iniciada);
    const historialSinEstaSesion = !estado.programa || estado.sesion.identificador !== identificadorDeSesion;
    if (sesionGuardadaEstabaIniciada && historialSinEstaSesion) {
      onCambiarPrograma();
      return;
    }
    if (estado.programa && estado.sesion.identificador === identificadorDeSesion) {
      return;
    }
    publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa, identificadorDeSesion, origen: 'arranque' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;

  useEffect(() => {
    if (sesionIniciada) {
      guardarSesionActiva({
        programa: estado.programa ?? programa,
        codigoDeSala,
        identificadorDeSesion,
        iniciada: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionIniciada, estado.programa]);

  const mostrarRanking =
    estado.fase.actual?.tipo === TIPOS_DE_FASE.CIERRE_Y_RANKING || estado.sesion.cerrada || rankingParcialVisible;
  const programaVisible = estado.programa ?? programa;

  useEmisorDeProyeccion({ codigoDeSala, estado, presencia, programa: programaVisible, conexion });

  function alternarRankingParcial() {
    const seVaAMostrar = !rankingParcialVisible;
    setRankingParcialVisible(seVaAMostrar);
    if (seVaAMostrar) {
      setTimeout(() => document.getElementById('ranking-del-debate')?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }

  const sesionYaEstabaCerrada = useRef(estado.sesion.cerrada);
  useEffect(() => {
    if (estado.sesion.cerrada && !sesionYaEstabaCerrada.current) {
      setTimeout(() => document.getElementById('ranking-del-debate')?.scrollIntoView({ behavior: 'smooth' }), 120);
    }
    sesionYaEstabaCerrada.current = estado.sesion.cerrada;
  }, [estado.sesion.cerrada]);

  function proyectarEnOtraVentana() {
    setAvisoDeVentanaBloqueada(abrirVentanaDeProyeccion(codigoDeSala) === null);
  }

  if (modoProyeccion) {
    return (
      <VistaDeProyeccion
        estado={estado}
        programa={programaVisible}
        presencia={presencia}
        conexion={conexion}
        botonDeSalida={
          <button type="button" className="boton-cerrar-sesion" onClick={() => setModoProyeccion(false)}>
            Salir de proyección
          </button>
        }
      />
    );
  }

  return (
    <main className="consola-de-sesion">
      <div className="barra-superior">
        <h1>Consola del host</h1>
        <div className="acciones-de-barra">
          {sesionIniciada && (
            <>
              <button type="button" className="boton-cerrar-sesion" onClick={() => setModoProyeccion(true)}>
                📽️ Proyectar aquí
              </button>
              <button type="button" className="boton-cerrar-sesion" onClick={proyectarEnOtraVentana}>
                🪟 Proyectar en otra ventana
              </button>
            </>
          )}
          <button type="button" className="boton-cerrar-sesion" onClick={() => cerrarSesionConAviso(sesionIniciada && !estado.sesion.cerrada, onCerrarSesion)}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <AvisoDeConexion conexion={conexion} />
      {avisoDeVentanaBloqueada && (
        <p className="mensaje-de-error">
          El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio y vuelve a
          pulsar «Proyectar en otra ventana».
        </p>
      )}
      <DestacadoDelTurno estado={estado} presencia={presencia} programa={programaVisible} />

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
        // Sala de espera (Etapa 2): con QR, guía pedagógica y lista de participantes incorporándose
        <section className="tarjeta-de-sala-de-configuracion">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3>Etapa 2: Sala de espera y recepción de participantes</h3>
            {onModificarConfiguracion && (
              <button type="button" className="boton-cambiar-programa" onClick={onModificarConfiguracion}>
                ✏️ Volver a configuración
              </button>
            )}
          </div>
          <p className="texto-de-ayuda">
            Comparte el código o el QR con la clase para que se vayan conectando. Cuando todos estén dentro, presiona «Iniciar debate».
          </p>
          <div className="tarjeta-de-sala">
            <p className="texto-de-ayuda">Código de sala</p>
            <p className="codigo-de-sala">{codigoDeSala}</p>
            <QRCodeSVG value={urlDeIngreso} size={200} bgColor="#ffffff" fgColor="#0f172a" />
            <p className="texto-de-ayuda">
              Los estudiantes escanean el QR, o entran a <code>{urlDeIngreso}</code>, o entran a{' '}
              <code>/player.html</code> e ingresan el código a mano.
            </p>
            <BotonCopiarLink url={urlDeIngreso} />
          </div>

          <PanelDeGuiaPedagogica />

          <TarjetaResumenDeConfiguracion programa={programaVisible} onModificarConfiguracion={onModificarConfiguracion} />

          <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          <PanelDeAvisos estado={estado} presencia={presencia} motor={motor} />
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
        // Debate en vivo (Etapa 3)
        <>
          <PanelDeAvisos estado={estado} presencia={presencia} motor={motor} />
          {!estado.sesion.cerrada && (
            <ControlDeFases
              estado={estado}
              motor={motor}
              programa={programaVisible}
              identificadorDeSesion={identificadorDeSesion}
              publicar={publicar}
            />
          )}
          <AccionesDeCierre
            estado={estado}
            presencia={presencia}
            motor={motor}
            rankingParcialVisible={rankingParcialVisible}
            onAlternarRankingParcial={alternarRankingParcial}
          />
          <FeedDeActividad estado={estado} presencia={presencia} />
          {!estado.sesion.cerrada && (
            <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          )}
          <PanelDePosturasPropuestas
            estado={estado}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
          <PanelDeDecisionDeBids estado={estado} motor={motor} />
          <PanelDeEvaluacionDeExposiciones estado={estado} presencia={presencia} publicar={publicar} />
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
              onNuevoDebate={onCambiarPrograma}
            />
          )}
        </>
      )}
    </main>
  );
}

function TarjetaResumenDeConfiguracion({ programa, onModificarConfiguracion }) {
  const perfilObj = PERFILES_DE_PUNTAJE[programa.perfilDePuntaje] ?? PERFILES_DE_PUNTAJE[PERFIL_POR_DEFECTO];
  const idiomaObj = IDIOMAS_DEL_DEBATE[programa.idioma] ?? IDIOMAS_DEL_DEBATE.es;

  const NOMBRES_MODO_ASIGNACION = {
    aleatoria: '🎲 Rolplay (Asignación Aleatoria)',
    por_argumento: '✍️ Postura Propia (Auto-detectada)',
    libre: '🖐️ Elección Libre (Por botones)',
  };

  return (
    <div className="tarjeta-resumen-configuracion" style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p className="texto-de-ayuda" style={{ fontWeight: 'bold', color: '#334155', margin: 0 }}>
          ⚙️ Configuración activa del debate
        </p>
        {onModificarConfiguracion && (
          <button type="button" className="boton-cambiar-programa" onClick={onModificarConfiguracion}>
            ✏️ Modificar configuración
          </button>
        )}
      </div>
      <ul className="texto-de-ayuda" style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', marginBottom: 0 }}>
        <li><strong>Posturas ({programa.posturas.length}):</strong> {programa.posturas.map((p) => p.etiqueta).join(', ')}</li>
        <li><strong>Modo de asignación:</strong> {NOMBRES_MODO_ASIGNACION[programa.asignacionPostura] ?? programa.asignacionPostura}</li>
        <li><strong>Modo de calificación:</strong> {perfilObj.etiqueta} ({perfilObj.valoresBasePosicion.join(' / ')} pts)</li>
        <li><strong>Idioma:</strong> {idiomaObj.etiqueta}</li>
        <li><strong>Posturas nuevas propuestas:</strong> {programa.permitirPosturasNuevas ? 'Permitidas' : 'No permitidas'}</li>
      </ul>
    </div>
  );
}

function BotonCopiarLink({ url }) {
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
