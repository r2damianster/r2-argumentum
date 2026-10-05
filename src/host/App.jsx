import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cargarPrograma } from '../shared/programa/cargarPrograma.js';
import { PROGRAMAS_DE_EJEMPLO, agruparProgramasPorCategoria } from '../shared/programa/ejemplos/index.js';
import { useEstadoDeSesion } from '../shared/estado/useEstadoDeSesion.js';
import { EVENTOS, TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import { useMotorDeSesion } from './useMotorDeSesion.js';
import { PantallaDeConfiguracionInicial } from './componentes/PantallaDeConfiguracionInicial.jsx';
import { PantallaDeConfiguracionDeLectura } from './componentes/lectura/PantallaDeConfiguracionDeLectura.jsx';
import { PanelDelControlDeLecturaParaElDocente } from './componentes/lectura/PanelDelControlDeLecturaParaElDocente.jsx';
import { ResumenDeConfiguracionDeLectura } from './componentes/lectura/ResumenDeConfiguracionDeLectura.jsx';
import { useEstadoPrivadoDelHost } from './useEstadoPrivadoDelHost.js';
import { useAnunciosEnLote } from './useAnunciosEnLote.js';
import { perfilDeAhorro } from '../shared/nucleo/capacidad/modosDeAhorro.js';
import { AvisoDeSalaGrande } from './componentes/AvisoDeSalaGrande.jsx';
import { SelectorDeActividad } from './componentes/SelectorDeActividad.jsx';
import { PanelDeDesignacionDeCoModeradores } from './componentes/PanelDeDesignacionDeCoModeradores.jsx';
import { PanelDelForoParaElModerador } from './componentes/PanelDelForoParaElModerador.jsx';
import { PanelDeRevisionDelModerador } from './componentes/PanelDeRevisionDelModerador.jsx';
import { PanelDeIntegridadDelModerador } from './componentes/PanelDeIntegridadDelModerador.jsx';
import { useSenalesDeIntegridadDelHost } from './useSenalesDeIntegridadDelHost.js';
import { calcularDescuentosAutomaticosPorPegado } from '../shared/nucleo/integridad/penalizacionPorPegado.js';
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
import { textoDeCreditos } from '../shared/creditos.js';
import { guardarSesionDelHost, iniciarSesionDelHost, leerSesionDelHost } from '../shared/ably/sesionDelHost.js';
import { normalizarModeracion } from '../shared/nucleo/coModeracion/calcularCoModeradores.js';
import {
  ETIQUETA_DEL_NIVEL_DE_INTEGRIDAD,
  integridadEstaActiva,
  resolverNivelDeIntegridad,
} from '../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { ID_FORO_ESCRITO } from '../actividades/foroEscrito/definicion.js';
import {
  conCamposSoloDelHost,
  esProgramaDeControlDeLectura,
  programaPublicable,
} from '../actividades/controlDeLectura/programaDeLectura.js';
import {
  buscarActividadPorId,
  listarActividadesHabilitadas,
  resolverActividadDelPrograma,
} from '../actividades/registroDeActividades.js';

const CLAVE_DE_SESION_ACTIVA = 'r2-argumentum-sesion-activa';

export default function App() {
  const [autenticado, setAutenticado] = useState(() => leerSesionDelHost() !== null);
  const [iniciandoSesion, setIniciandoSesion] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mensajeDeError, setMensajeDeError] = useState('');

  async function manejarEnvioDeLogin(evento) {
    evento.preventDefault();
    setIniciandoSesion(true);
    const { sesion, mensajeDeError: mensajeDelServidor } = await iniciarSesionDelHost({ usuario, clave });
    setIniciandoSesion(false);
    if (sesion) {
      setMensajeDeError('');
      setClave('');
      setAutenticado(true);
    } else {
      setMensajeDeError(mensajeDelServidor);
    }
  }

  function cerrarSesionDeHost() {
    guardarSesionDelHost(null);
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
        <button type="submit" disabled={iniciandoSesion}>
          {iniciandoSesion ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <footer>{textoDeCreditos()}</footer>
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

// Con una sola actividad habilitada no hay nada que elegir: se salta el paso.
function resolverActividadInicial(sesionRestaurada) {
  if (sesionRestaurada?.programa) {
    return resolverActividadDelPrograma(sesionRestaurada.programa).id;
  }
  const habilitadas = listarActividadesHabilitadas();
  return habilitadas.length === 1 ? habilitadas[0].id : null;
}

function ConsolaDelHost({ onCerrarSesion }) {
  const [sesionRestaurada] = useState(resolverSesionInicial);
  const [idDeActividadElegida, setIdDeActividadElegida] = useState(() => resolverActividadInicial(sesionRestaurada));
  const [programaBaseSeleccionado, setProgramaBaseSeleccionado] = useState(null);
  const [programaActivo, setProgramaActivo] = useState(sesionRestaurada?.programa ?? null);
  const [codigoDeSala, setCodigoDeSala] = useState(sesionRestaurada?.codigoDeSala ?? null);
  const [identificadorDeSesion, setIdentificadorDeSesion] = useState(sesionRestaurada?.identificadorDeSesion ?? null);
  const [errorDeCarga, setErrorDeCarga] = useState('');

  const actividadesHabilitadas = listarActividadesHabilitadas();
  const actividadElegida = buscarActividadPorId(idDeActividadElegida);

  // Un Programa de otra actividad no se puede abrir con esta: la actividad manda cómo se juega.
  function seleccionarProgramaBase(programa) {
    const actividadDelPrograma = resolverActividadDelPrograma(programa);
    if (programa.actividad && actividadDelPrograma.id !== actividadElegida.id) {
      throw new Error(
        `Este Programa es de otra actividad («${actividadDelPrograma.etiqueta}»). Cambia de actividad o elige otro Programa.`
      );
    }
    setProgramaBaseSeleccionado({ ...programa, actividad: actividadElegida.id });
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

  function cambiarActividad() {
    setIdDeActividadElegida(actividadesHabilitadas.length === 1 ? actividadesHabilitadas[0].id : null);
    setErrorDeCarga('');
  }

  // Al terminar una actividad: vuelve al primer paso para elegir OTRA actividad (o la misma).
  function elegirOtraActividad() {
    cambiarPrograma();
    setIdDeActividadElegida(null);
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

  // Etapa 1.0: elegir la actividad (debate hablado, foro escrito…) antes de elegir el Programa
  if (!programaActivo && !programaBaseSeleccionado && !actividadElegida) {
    return (
      <main>
        <div className="barra-superior">
          <h1>Consola del host</h1>
          <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
        <SelectorDeActividad actividades={actividadesHabilitadas} onElegirActividad={setIdDeActividadElegida} />
      </main>
    );
  }

  // Etapa 1.1: Si aún no se selecciona ningún programa base ni hay sesión activa
  if (!programaActivo && !programaBaseSeleccionado) {
    const programasDeLaActividad = PROGRAMAS_DE_EJEMPLO.filter(
      (programa) => resolverActividadDelPrograma(programa).id === actividadElegida.id
    );
    const categoriasDeEjemplos = agruparProgramasPorCategoria(programasDeLaActividad);

    return (
      <main>
        <div className="barra-superior">
          <h1>Consola del host</h1>
          <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
        <section className="tarjeta-de-programa">
          <h2>
            {actividadElegida.icono} {actividadElegida.etiqueta}: elige el Programa a abrir
          </h2>
          {actividadesHabilitadas.length > 1 && (
            <button type="button" className="boton-cambiar-programa" onClick={cambiarActividad}>
              ↩️ Cambiar de actividad
            </button>
          )}
          <p className="texto-de-ayuda">
            {actividadElegida.descripcionDelPrograma ||
              'Un Programa define el tema, las posturas, las reglas de puntaje y los ejemplos para Groq de esta sesión.'}{' '}
            Ver <code>docs/03-programa-de-debate.md</code>.
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

          {programasDeLaActividad.length === 0 && (
            <p className="texto-de-ayuda">
              Esta actividad todavía no trae Programas de ejemplo: carga uno propio con el botón de arriba.
            </p>
          )}

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
        {esProgramaDeControlDeLectura(programaBaseSeleccionado) ? (
          <PantallaDeConfiguracionDeLectura
            programaBase={programaBaseSeleccionado}
            onConfirmarConfiguracion={activarProgramaConfigurado}
            onCambiarPrograma={cambiarPrograma}
          />
        ) : (
          <PantallaDeConfiguracionInicial
            programaBase={programaBaseSeleccionado}
            onConfirmarConfiguracion={activarProgramaConfigurado}
            onCambiarPrograma={cambiarPrograma}
          />
        )}
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
      onElegirOtraActividad={elegirOtraActividad}
      onModificarConfiguracion={modificarConfiguracion}
      onCerrarSesion={onCerrarSesion}
    />
  );
}

function ConsolaDeSesion({ programa, codigoDeSala, identificadorDeSesion, onCambiarPrograma, onElegirOtraActividad, onModificarConfiguracion, onCerrarSesion }) {
  const urlDeIngreso = `${window.location.origin}/?sala=${codigoDeSala}`;
  const { estado, eventos, presencia, publicar, cargando, conexion } = useEstadoDeSesion({
    clientId: 'host',
    sessionId: codigoDeSala,
  });
  // Control de lectura: el estado privado del docente (textos, calificaciones) llega por canales que solo
  // el host puede abrir. Con otra actividad no se conecta a nada.
  const esLectura = esProgramaDeControlDeLectura(programa);
  const { estadoPrivado, publicarComoDocente, enviarAlEstudiante } = useEstadoPrivadoDelHost({
    sessionId: codigoDeSala,
    activo: esLectura,
  });
  // En los modos de sala grande y masivo lo que protagoniza cada persona se anuncia a la sala EN LOTE desde aquí (no un
  // aviso suelto por estudiante): ver anunciosEnLote.js y modosDeAhorro.js.
  const perfilDeLaSesion = perfilDeAhorro({ programa: estado.programa ?? programa, estado });
  useAnunciosEnLote({ activo: esLectura, estado, estadoPrivado, publicar, perfil: perfilDeLaSesion });
  // Señales de integridad: solo el host lee el canal privado. Con la integridad apagada no se conecta.
  const integridadActiva = integridadEstaActiva(estado.programa ?? programa);
  const { registros: registrosDeIntegridad } = useSenalesDeIntegridadDelHost({
    sessionId: codigoDeSala,
    activo: integridadActiva,
  });
  // El descuento automático por texto pegado (lo calcula el host con lo que publicó cada estudiante) viaja
  // junto al estado privado: la cola, el podio y el informe usan el mismo número, y el docente lo puede revertir.
  const estadoPrivadoConDescuentos = useMemo(
    () => ({
      ...estadoPrivado,
      descuentosAutomaticos: calcularDescuentosAutomaticosPorPegado({ registros: registrosDeIntegridad, programa: estado.programa ?? programa }),
    }),
    [estadoPrivado, registrosDeIntegridad, estado.programa, programa]
  );
  const motor = useMotorDeSesion({
    estado,
    presencia,
    publicar,
    programa,
    estadoPrivado: esLectura ? estadoPrivadoConDescuentos : null,
  });

  // Volver a configuración abre una sala NUEVA con otro código (así no se mezclan debates, ver
  // docs/06). Quienes ya entraron se quedan en la sala actual sin enterarse: se avisa antes.
  function pedirModificarConfiguracion() {
    const personasYaEnLaSala = presencia.filter(
      (presente) => presente.conectado !== false && presente.participantId !== 'host'
    ).length;
    if (personasYaEnLaSala > 0) {
      const seguir = window.confirm(
        `Volver a configuración abre una sala NUEVA con otro código. Las ${personasYaEnLaSala} persona(s) que ya entraron se quedan en la sala actual y tendrán que volver a entrar con el código nuevo. ¿Continuar?`
      );
      if (!seguir) {
        return;
      }
    }
    onModificarConfiguracion();
  }

  const [modoProyeccion, setModoProyeccion] = useState(false);
  const [incluirAnexoDeIntegridad, setIncluirAnexoDeIntegridad] = useState(false);
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
    // Lo que solo conoce el host (claves de la lectura) no viaja al canal de la sala: lo leen todos.
    publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa: programaPublicable(programa), identificadorDeSesion, origen: 'arranque' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;

  useEffect(() => {
    if (sesionIniciada) {
      guardarSesionActiva({
        programa: conCamposSoloDelHost(estado.programa ?? programa, programa),
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
  const esForo = resolverActividadDelPrograma(programaVisible).id === ID_FORO_ESCRITO;

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
      {!esLectura && <DestacadoDelTurno estado={estado} presencia={presencia} programa={programaVisible} />}

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
              <button type="button" className="boton-cambiar-programa" onClick={pedirModificarConfiguracion}>
                ✏️ Volver a configuración
              </button>
            )}
          </div>
          <p className="texto-de-ayuda">
            Comparte el código o el QR con la clase para que se vayan conectando. Cuando todos estén dentro, presiona «{esLectura ? 'Iniciar control de lectura' : 'Iniciar debate'}».
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

          <AvisoDeSalaGrande presencia={presencia} estado={estado} programa={programaVisible} />

          {esLectura ? (
            <ResumenDeConfiguracionDeLectura
              estado={estado}
              presencia={presencia}
              programa={programaVisible}
              onModificarConfiguracion={onModificarConfiguracion && pedirModificarConfiguracion}
            />
          ) : (
            <>
              <PanelDeGuiaPedagogica />

              <TarjetaResumenDeConfiguracion programa={programaVisible} onModificarConfiguracion={onModificarConfiguracion && pedirModificarConfiguracion} />

              <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
              <PanelDeDesignacionDeCoModeradores
                estado={estado}
                presencia={presencia}
                programa={programaVisible}
                motor={motor}
              />
              <PanelDeAvisos estado={estado} presencia={presencia} motor={motor} />
              <PanelDePosturasPropuestas
                estado={estado}
                programa={programaVisible}
                identificadorDeSesion={identificadorDeSesion}
                publicar={publicar}
              />
            </>
          )}
          <ControlDeFases
            estado={estado}
            motor={motor}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
        </section>
      ) : (
        // Control de lectura en vivo: su propio panel (cola anónima, calificador, devolución y podio)
        esLectura ? (
          <>
            {!estado.sesion.cerrada && (
              <ControlDeFases
                estado={estado}
                motor={motor}
                programa={programaVisible}
                identificadorDeSesion={identificadorDeSesion}
                publicar={publicar}
              />
            )}
            <PanelDelControlDeLecturaParaElDocente
              estado={estado}
              presencia={presencia}
              programa={programa}
              motor={motor}
              estadoPrivado={estadoPrivadoConDescuentos}
              publicar={publicar}
              publicarComoDocente={publicarComoDocente}
              enviarAlEstudiante={enviarAlEstudiante}
              registrosDeIntegridad={registrosDeIntegridad}
              onElegirOtraActividad={onElegirOtraActividad}
            />
          </>
        ) : (
        // Debate en vivo (Etapa 3)
        <>
          <PanelDeAvisos estado={estado} presencia={presencia} motor={motor} />
          {integridadActiva && (
            <PanelDeIntegridadDelModerador
              estado={estado}
              presencia={presencia}
              registros={registrosDeIntegridad}
              esForo={esForo}
              publicar={publicar}
            />
          )}
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
          {!estado.sesion.cerrada && (
            <ListaDeParticipantes estado={estado} presencia={presencia} programa={programaVisible} />
          )}
          <PanelDePosturasPropuestas
            estado={estado}
            programa={programaVisible}
            identificadorDeSesion={identificadorDeSesion}
            publicar={publicar}
          />
          {esForo ? (
            <>
              {!estado.sesion.cerrada && (
                <PanelDeRevisionDelModerador estado={estado} presencia={presencia} publicar={publicar} />
              )}
              <PanelDelForoParaElModerador
                estado={estado}
                presencia={presencia}
                programa={programaVisible}
                publicar={publicar}
              />
            </>
          ) : (
            <>
              <FeedDeActividad estado={estado} presencia={presencia} />
              <PanelDeDecisionDeBids estado={estado} motor={motor} />
              <PanelDeEvaluacionDeExposiciones estado={estado} presencia={presencia} publicar={publicar} />
              <VistaEspejoDeParticipante estado={estado} presencia={presencia} programa={programaVisible} />
            </>
          )}
          <GrafoDeArgumentos estado={estado} programa={programaVisible} presencia={presencia} />
          {mostrarRanking && (
            <InformeDelDebate
              estado={estado}
              programa={programaVisible}
              presencia={presencia}
              eventos={eventos}
              registrosDeIntegridad={registrosDeIntegridad}
              incluirAnexoDeIntegridad={incluirAnexoDeIntegridad}
            />
          )}
          {mostrarRanking && (
            <PantallaDeRanking
              estado={estado}
              eventos={eventos}
              programa={programaVisible}
              presencia={presencia}
              motor={motor}
              onNuevoDebate={onElegirOtraActividad}
              integridadActiva={integridadActiva}
              registrosDeIntegridad={registrosDeIntegridad}
              incluirAnexoDeIntegridad={incluirAnexoDeIntegridad}
              onAlternarAnexoDeIntegridad={() => setIncluirAnexoDeIntegridad((incluir) => !incluir)}
            />
          )}
        </>
        )
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

  const NOMBRES_MODO_MODERACION = {
    reglamentario: '📏 Reglamentario (uno por cada 10 participantes)',
    fijo: `🔢 Número fijo (${programa.moderacion?.numeroFijo ?? '—'})`,
    ninguno: '🙋 Sin co-moderadores',
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
        <li><strong>Co-moderadores:</strong> {NOMBRES_MODO_MODERACION[normalizarModeracion(programa.moderacion).modo]}</li>
        <li><strong>Integridad:</strong> {ETIQUETA_DEL_NIVEL_DE_INTEGRIDAD[resolverNivelDeIntegridad(programa)]}</li>
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
