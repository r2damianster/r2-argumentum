import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cargarPrograma } from '../shared/programa/cargarPrograma.js';
import { PROGRAMAS_DE_EJEMPLO, agruparProgramasPorCategoria } from '../shared/programa/ejemplos/index.js';

// Credencial hardcodeada a propósito, mismo criterio que R2 Quiz (ver docs/07-acceso-y-paginas.md):
// esta consola no maneja información sensible, así que no requiere autenticación real.
const USUARIO_VALIDO = 'arturo.rodriguez@uleam.edu.ec';
const CLAVE_VALIDA = 'R2ironmaiden';

export default function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mensajeDeError, setMensajeDeError] = useState('');

  function manejarEnvioDeLogin(evento) {
    evento.preventDefault();
    if (usuario === USUARIO_VALIDO && clave === CLAVE_VALIDA) {
      setMensajeDeError('');
      setAutenticado(true);
    } else {
      setMensajeDeError('Usuario o clave incorrectos.');
    }
  }

  if (autenticado) {
    return <ConsolaDelHost onCerrarSesion={() => setAutenticado(false)} />;
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

function ConsolaDelHost({ onCerrarSesion }) {
  const [programaActivo, setProgramaActivo] = useState(null);
  const [errorDeCarga, setErrorDeCarga] = useState('');

  function manejarSeleccionDeArchivo(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) {
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      try {
        setProgramaActivo(cargarPrograma(lector.result));
        setErrorDeCarga('');
      } catch (error) {
        setErrorDeCarga(error.message);
      }
    };
    lector.readAsText(archivo);
    evento.target.value = '';
  }

  function usarProgramaDeEjemplo(programaDeEjemplo) {
    try {
      setProgramaActivo(cargarPrograma(JSON.stringify(programaDeEjemplo)));
      setErrorDeCarga('');
    } catch (error) {
      setErrorDeCarga(error.message);
    }
  }

  if (!programaActivo) {
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
      onCambiarPrograma={() => setProgramaActivo(null)}
      onCerrarSesion={onCerrarSesion}
    />
  );
}

function ConsolaDeSesion({ programa, onCambiarPrograma, onCerrarSesion }) {
  const codigoDeSala = useMemo(() => generarCodigoDeSala(), [programa]);
  const urlDeIngreso = `${window.location.origin}/player.html?sala=${codigoDeSala}`;

  return (
    <main>
      <div className="barra-superior">
        <h1>Consola del host</h1>
        <button type="button" className="boton-cerrar-sesion" onClick={onCerrarSesion}>
          Cerrar sesión
        </button>
      </div>

      <section className="tarjeta-de-programa">
        <p className="texto-de-ayuda">Programa activo</p>
        <h2>{programa.titulo}</h2>
        <p>{programa.temaCentral}</p>
        <ul className="lista-de-posturas">
          {programa.posturas.map((postura) => (
            <li key={postura.id} style={{ color: postura.color }}>
              {postura.etiqueta}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onCambiarPrograma}>
          Cambiar Programa de Debate
        </button>
      </section>

      <section className="tarjeta-de-sala">
        <p className="texto-de-ayuda">Código de sala</p>
        <p className="codigo-de-sala">{codigoDeSala}</p>
        <QRCodeSVG value={urlDeIngreso} size={180} bgColor="#ffffff" fgColor="#0f172a" />
        <p className="texto-de-ayuda">
          Los estudiantes escanean el QR o entran en <code>/player.html</code> e ingresan el código.
        </p>
      </section>

      <p className="texto-de-ayuda">
        Por construir: control de fases, grafo argumental en vivo, ranking por postura, sorteo de
        co-moderadores.
      </p>
    </main>
  );
}
