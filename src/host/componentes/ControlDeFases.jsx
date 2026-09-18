import { useEffect, useState } from 'react';
import { TIPOS_DE_FASE, EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO } from '../../shared/puntaje/formulaDePuntaje.js';

const ETIQUETA_DE_FASE = {
  [TIPOS_DE_FASE.APERTURA_SIMULTANEA]: 'Apertura simultánea (todos escriben)',
  [TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS]: 'Escritura de argumentos',
  [TIPOS_DE_FASE.CONEXION_SUGERIDA]: 'Conexión sugerida por Groq',
  [TIPOS_DE_FASE.CONEXION_LIBRE]: 'Conexión libre',
  [TIPOS_DE_FASE.CIERRE_Y_RANKING]: 'Cierre y ranking',
};

export function ControlDeFases({ estado, motor, programa, identificadorDeSesion, publicar }) {
  const sesionIniciada = estado.fase.actual !== null || estado.fase.historial.length > 0;
  const faseActual = estado.fase.actual;
  const [posturasSeleccionadas, setPosturasSeleccionadas] = useState(
    () => new Set(programa.posturas.map((postura) => postura.id))
  );
  const [perfilDePuntaje, setPerfilDePuntaje] = useState(programa.perfilDePuntaje ?? PERFIL_POR_DEFECTO);
  // Por defecto en "No": el debate se juega con las posturas que el docente preparó.
  const [permitirPosturasNuevas, setPermitirPosturasNuevas] = useState(
    Boolean(programa.permitirPosturasNuevas)
  );

  function alternarPostura(posturaId) {
    setPosturasSeleccionadas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(posturaId)) {
        siguientes.delete(posturaId);
      } else {
        siguientes.add(posturaId);
      }
      return siguientes;
    });
  }

  function confirmarEIniciarSesion() {
    const posturasElegidas = programa.posturas.filter((postura) => posturasSeleccionadas.has(postura.id));
    if (posturasElegidas.length < 2) {
      return;
    }
    // Republica el Programa con la configuración de esta sesión — así el resto de la UI
    // (grafo, ranking, chips) ya no vuelve a ver las posturas que el moderador destildó, y el
    // motor toma el perfil de puntaje elegido desde el canal (ver parametrosDePuntajeVigentes).
    publicar(EVENTOS.PROGRAMA_PUBLICADO, {
      programa: { ...programa, posturas: posturasElegidas, perfilDePuntaje, permitirPosturasNuevas },
      identificadorDeSesion,
    });
    motor.iniciarSesion(posturasElegidas);
  }

  if (!sesionIniciada) {
    const hayQueElegir = programa.posturas.length > 2;
    return (
      <section className="tarjeta-de-fase">
        {hayQueElegir && (
          <div className="selector-de-posturas">
            <p className="texto-de-ayuda">
              Este Programa tiene {programa.posturas.length} posturas — elegí cuáles se debaten hoy (mínimo 2,
              todas tildadas por defecto):
            </p>
            <ul className="lista-de-posturas-seleccionables">
              {programa.posturas.map((postura) => (
                <li key={postura.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={posturasSeleccionadas.has(postura.id)}
                      onChange={() => alternarPostura(postura.id)}
                    />
                    <span style={{ color: postura.color }}>{postura.etiqueta}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="bloque-de-configuracion">
          <p className="texto-de-ayuda">Modo de calificación</p>
          <ul className="lista-de-perfiles">
            {Object.entries(PERFILES_DE_PUNTAJE).map(([clave, perfil]) => (
              <li key={clave}>
                <label>
                  <input
                    type="radio"
                    name="perfil-de-puntaje"
                    checked={perfilDePuntaje === clave}
                    onChange={() => setPerfilDePuntaje(clave)}
                  />
                  <span>
                    <strong>{perfil.etiqueta}</strong> ({perfil.valoresBasePosicion.join(' / ')} pts)
                    <br />
                    <span className="texto-de-ayuda">{perfil.descripcion}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="bloque-de-configuracion">
          <label className="casilla-de-falta">
            <input
              type="checkbox"
              checked={permitirPosturasNuevas}
              onChange={(evento) => setPermitirPosturasNuevas(evento.target.checked)}
            />
            Permitir que los estudiantes propongan posturas nuevas
          </label>
          <p className="texto-de-ayuda">
            Si está activo y un argumento no encaja en ninguna postura de la lista, el estudiante puede
            proponerla y tú decides si entra al debate. Si está inactivo, se le pide reescribir.
          </p>
        </div>

        <button type="button" disabled={posturasSeleccionadas.size < 2} onClick={confirmarEIniciarSesion}>
          Iniciar sesión
        </button>
      </section>
    );
  }

  if (!faseActual) {
    return (
      <section className="tarjeta-de-fase">
        <p className="texto-de-ayuda">Sin fase activa.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta-de-fase">
      <p className="texto-de-ayuda">Fase activa</p>
      <h3>
        {ETIQUETA_DE_FASE[faseActual.tipo] || faseActual.tipo}
        {faseActual.ronda ? ` · Ronda ${faseActual.ronda}` : ''}
      </h3>
      {faseActual.tipo === TIPOS_DE_FASE.APERTURA_SIMULTANEA ? (
        <PanelDeAperturaDelHost estado={estado} motor={motor} />
      ) : (
        faseActual.tipo !== TIPOS_DE_FASE.CIERRE_Y_RANKING && (
          <button type="button" onClick={motor.cerrarFaseActual}>
            Cerrar fase actual
          </button>
        )
      )}
    </section>
  );
}

// Máquina de rondas de la apertura obligatoria (ver docs/09 y motorDeSesion.js): aquí vive el
// arbitraje del host — dar 1 minuto más, cerrar la ronda ya, o dar/negar la segunda oportunidad
// a quienes quedaron sin argumento. No hay cierre automático por temporizador: el motor espera
// siempre una decisión humana una vez vencido el plazo (salvo que ya todos terminaron).
function PanelDeAperturaDelHost({ estado, motor }) {
  const apertura = estado.apertura;
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!apertura || apertura.cerrada) {
      return undefined;
    }
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [apertura?.ronda, apertura?.cerrada, apertura?.expiraEn]);

  if (!apertura) {
    return <p className="texto-de-ayuda">Arrancando la apertura…</p>;
  }

  if (!apertura.cerrada) {
    const segundosRestantes = Math.max(0, Math.round((apertura.expiraEn - ahora) / 1000));
    const tiempoAgotado = segundosRestantes === 0;
    return (
      <div className="panel-de-apertura-host">
        <p className="texto-de-ayuda">
          {tiempoAgotado
            ? 'Tiempo agotado.'
            : `Tiempo restante: ${segundosRestantes}s`}{' '}
          — pregunta a los estudiantes si ya todos ingresaron su argumento.
        </p>
        <button type="button" onClick={() => motor.cerrarRondaDeApertura()}>
          {tiempoAgotado ? 'Cerrar ronda ya' : 'Cerrar ronda ahora (ya terminaron)'}
        </button>
        {apertura.ronda === 1 && (
          <button type="button" onClick={motor.extenderRondaDeApertura}>
            Dar 1 minuto más
          </button>
        )}
      </div>
    );
  }

  if (apertura.esperandoSegundaOportunidad) {
    const pendientes = apertura.ultimoCierre?.pendientes ?? [];
    return (
      <div className="panel-de-apertura-host">
        <p className="texto-de-ayuda">
          Faltan {pendientes.length} participante(s) sin argumento aprobado. ¿Das otra oportunidad de 1 minuto?
        </p>
        <button type="button" onClick={motor.abrirSegundaOportunidadDeApertura}>
          Sí, dar 1 minuto más
        </button>
        <button type="button" onClick={() => motor.cerrarRondaDeApertura({ forzarFinal: true })}>
          No, continuar sin ellos
        </button>
      </div>
    );
  }

  return null;
}
