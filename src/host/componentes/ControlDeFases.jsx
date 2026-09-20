import { useEffect, useRef, useState } from 'react';
import { TIPOS_DE_FASE, EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { armarProgramaDeLaSesion } from '../programaDeLaSesion.js';
import { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO } from '../../shared/puntaje/formulaDePuntaje.js';
import { IDIOMAS_DEL_DEBATE, resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';

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
  // Lista completa del Programa: la configuración se republica en vivo (ver abajo) y eso deja
  // `programa.posturas` ya filtrado, así que sin esta copia una postura destildada desaparecía
  // de la lista y no se podía volver a tildar.
  const [posturasDelPrograma, setPosturasDelPrograma] = useState(() => programa.posturas);
  const [posturasSeleccionadas, setPosturasSeleccionadas] = useState(
    () => new Set(posturasDelPrograma.map((postura) => postura.id))
  );
  const [perfilDePuntaje, setPerfilDePuntaje] = useState(programa.perfilDePuntaje ?? PERFIL_POR_DEFECTO);
  const [idiomaDelDebate, setIdiomaDelDebate] = useState(() => resolverIdiomaDelDebate(programa));
  // Por defecto en "No": el debate se juega con las posturas que el docente preparó.
  const [permitirPosturasNuevas, setPermitirPosturasNuevas] = useState(
    Boolean(programa.permitirPosturasNuevas)
  );
  const [asignacionPostura, setAsignacionPostura] = useState(
    () => programa.asignacionPostura ?? 'aleatoria'
  );

  // Una postura propuesta por un estudiante y aceptada por el moderador entra al Programa por
  // el canal (ver PanelDePosturasPropuestas): se suma a la lista y queda tildada. Sin esto, la
  // republicación de configuración de abajo la habría vuelto a sacar del debate enseguida.
  useEffect(() => {
    const posturasNuevas = (estado.programa?.posturas ?? []).filter(
      (postura) => !posturasDelPrograma.some((conocida) => conocida.id === postura.id)
    );
    if (posturasNuevas.length === 0) {
      return;
    }
    setPosturasDelPrograma((conocidas) => [...conocidas, ...posturasNuevas]);
    setPosturasSeleccionadas(
      (elegidas) => new Set([...elegidas, ...posturasNuevas.map((postura) => postura.id)])
    );
  }, [estado.programa, posturasDelPrograma]);

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
    programarPublicacionDeConfiguracion();
  }

  // La configuración se republica mientras la sala está en espera, no solo al iniciar. Los
  // estudiantes ingresan con su argumento ANTES de que el moderador arranque la sesión (ver
  // IngresoConArgumento), así que un Programa que se publica recién al iniciar les llega
  // tarde: validaban su ingreso con la configuración por defecto. Bug real reportado en
  // prueba en vivo — con "Permitir posturas nuevas" tildado, a los estudiantes se les seguía
  // diciendo que el debate solo admite las posturas de la lista.
  //
  // Se publica SOLO desde los manejadores de los controles (lo que el moderador hizo con la
  // mano), nunca desde un efecto que compare el canal con el estado local. Ese efecto pisaba el
  // canal con el estado local cada vez que difería, y en la prueba del 19 de septiembre el modo
  // de calificación elegido (Estándar) volvió a Liviano a mitad de la espera y otra vez al
  // iniciar. Como cada publicación lleva la configuración completa, una publicación nunca
  // deshace lo que otra dejó.
  const configuracionActualRef = useRef(null);
  configuracionActualRef.current = {
    programaBase: programa,
    posturasDelPrograma,
    idsDePosturasSeleccionadas: posturasSeleccionadas,
    perfilDePuntaje,
    permitirPosturasNuevas,
    idioma: idiomaDelDebate,
    asignacionPostura,
  };
  const temporizadorDePublicacionRef = useRef(null);

  function publicarConfiguracion(origen) {
    temporizadorDePublicacionRef.current = null;
    const programaDeLaSesion = armarProgramaDeLaSesion(configuracionActualRef.current);
    if (!programaDeLaSesion) {
      return;
    }
    // `origen` no lo usa el reducer: queda en el log de eventos para saber quién publicó cada
    // versión del Programa cuando algo se ve raro.
    publicar(EVENTOS.PROGRAMA_PUBLICADO, { programa: programaDeLaSesion, identificadorDeSesion, origen });
  }

  // Pequeña espera para no publicar una vez por cada clic mientras el moderador tilda; siempre
  // publica la configuración más reciente, no la del momento del clic.
  function programarPublicacionDeConfiguracion() {
    clearTimeout(temporizadorDePublicacionRef.current);
    temporizadorDePublicacionRef.current = setTimeout(() => publicarConfiguracion('configuracion'), 500);
  }

  useEffect(() => () => clearTimeout(temporizadorDePublicacionRef.current), []);

  function cambiarPerfilDePuntaje(clave) {
    setPerfilDePuntaje(clave);
    // El ref se actualiza en el siguiente render: el temporizador lo lee 500 ms después.
    programarPublicacionDeConfiguracion();
  }

  function cambiarIdiomaDelDebate(clave) {
    setIdiomaDelDebate(clave);
    programarPublicacionDeConfiguracion();
  }

  function cambiarPermitirPosturasNuevas(permitido) {
    setPermitirPosturasNuevas(permitido);
    programarPublicacionDeConfiguracion();
  }

  function cambiarAsignacionPostura(modo) {
    setAsignacionPostura(modo);
    programarPublicacionDeConfiguracion();
  }

  function confirmarEIniciarSesion() {
    if (posturasSeleccionadas.size < 2) {
      return;
    }
    // Ya no se republica el Programa al iniciar (los controles lo hicieron en vivo): así el
    // inicio nunca puede pisar la configuración del canal con un estado local viejo. Solo se
    // adelanta lo que haya quedado esperando el pequeño retraso de arriba.
    if (temporizadorDePublicacionRef.current) {
      clearTimeout(temporizadorDePublicacionRef.current);
      publicarConfiguracion('inicio');
    }
    motor.iniciarSesion();
  }

  if (!sesionIniciada) {
    const hayQueElegir = posturasDelPrograma.length > 2;
    return (
      <section className="tarjeta-de-fase">
        {hayQueElegir && (
          <div className="selector-de-posturas">
            <p className="texto-de-ayuda">
              Este Programa tiene {posturasDelPrograma.length} posturas — elige cuáles se debaten hoy (mínimo
              2, todas tildadas por defecto):
            </p>
            <ul className="lista-de-posturas-seleccionables">
              {posturasDelPrograma.map((postura) => (
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
          <p className="texto-de-ayuda">Modo de asignación de postura</p>
          <ul className="lista-de-perfiles">
            <li>
              <label>
                <input
                  type="radio"
                  name="modo-asignacion-postura"
                  checked={asignacionPostura === 'aleatoria'}
                  onChange={() => cambiarAsignacionPostura('aleatoria')}
                />
                <span>
                  <strong>🎲 Modo Rolplay (Asignación Aleatoria)</strong>
                  <br />
                  <span className="texto-de-ayuda">El programa asigna la postura a cada estudiante para balancear bandos de entrada.</span>
                </span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="radio"
                  name="modo-asignacion-postura"
                  checked={asignacionPostura === 'por_argumento'}
                  onChange={() => cambiarAsignacionPostura('por_argumento')}
                />
                <span>
                  <strong>✍️ Modo Postura Propia (Auto-detectada por Groq)</strong>
                  <br />
                  <span className="texto-de-ayuda">El estudiante escribe su postura/argumento libremente y Groq determina su bando.</span>
                </span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="radio"
                  name="modo-asignacion-postura"
                  checked={asignacionPostura === 'libre'}
                  onChange={() => cambiarAsignacionPostura('libre')}
                />
                <span>
                  <strong>🖐️ Modo Elección Libre (Por botones)</strong>
                  <br />
                  <span className="texto-de-ayuda">El estudiante elige su postura manualmente antes de redactar. Groq valida la concordancia.</span>
                </span>
              </label>
            </li>
          </ul>
        </div>

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
                    onChange={() => cambiarPerfilDePuntaje(clave)}
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
          <p className="texto-de-ayuda">Idioma de los argumentos</p>
          <ul className="lista-de-perfiles">
            {Object.entries(IDIOMAS_DEL_DEBATE).map(([clave, idioma]) => (
              <li key={clave}>
                <label>
                  <input
                    type="radio"
                    name="idioma-del-debate"
                    checked={idiomaDelDebate === clave}
                    onChange={() => cambiarIdiomaDelDebate(clave)}
                  />
                  <strong>{idioma.etiqueta}</strong>
                </label>
              </li>
            ))}
          </ul>
          <p className="texto-de-ayuda">
            Cambia el corrector ortográfico de los campos de texto y el idioma en que Groq revisa los argumentos.
            Los botones y avisos siguen en español.
          </p>
        </div>

        <div className="bloque-de-configuracion">
          <label className="casilla-de-falta">
            <input
              type="checkbox"
              checked={permitirPosturasNuevas}
              onChange={(evento) => cambiarPermitirPosturasNuevas(evento.target.checked)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {faseActual.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS && motor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="texto-de-ayuda">
                  Ruleta: {estado.turnos.ruletaPausada ? '⏸️ Pausada' : '▶️ Activa'}
                </span>
                {estado.turnos.ruletaPausada ? (
                  <button type="button" onClick={() => motor.reanudarRuleta()}>
                    ▶️ Reanudar ruleta
                  </button>
                ) : (
                  <button type="button" className="boton-cambiar-programa" onClick={() => motor.pausarRuleta()}>
                    ⏸️ Pausar ruleta
                  </button>
                )}
              </div>
            )}
            <button type="button" onClick={motor.cerrarFaseActual}>
              Cerrar fase actual
            </button>
          </div>
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
