import { useState } from 'react';

// Credencial hardcodeada a propósito, mismo criterio que R2 Quiz (ver docs/07-acceso-y-paginas.md):
// esta consola no maneja información sensible, así que no requiere autenticación real.
const USUARIO_VALIDO = 'usuario';
const CLAVE_VALIDA = 'argumentum';

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
    return <ConsolaDelHost />;
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

function ConsolaDelHost() {
  return (
    <main>
      <h1>Consola del host</h1>
      <p className="texto-de-ayuda">
        Por construir: creación/carga del Programa de Debate, control de fases, grafo argumental en vivo,
        ranking por postura, sorteo de co-moderadores.
      </p>
    </main>
  );
}
