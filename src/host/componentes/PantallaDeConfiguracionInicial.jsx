import { useState } from 'react';
import { armarProgramaDeLaSesion } from '../programaDeLaSesion.js';
import { PERFILES_DE_PUNTAJE, PERFIL_POR_DEFECTO } from '../../shared/puntaje/formulaDePuntaje.js';
import { IDIOMAS_DEL_DEBATE, resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';

export function PantallaDeConfiguracionInicial({ programaBase, onConfirmarConfiguracion, onCambiarPrograma }) {
  const [posturasDelPrograma] = useState(() => programaBase.posturas);
  const [posturasSeleccionadas, setPosturasSeleccionadas] = useState(
    () => new Set(posturasDelPrograma.map((postura) => postura.id))
  );
  const [perfilDePuntaje, setPerfilDePuntaje] = useState(programaBase.perfilDePuntaje ?? PERFIL_POR_DEFECTO);
  const [idiomaDelDebate, setIdiomaDelDebate] = useState(() => resolverIdiomaDelDebate(programaBase));
  const [permitirPosturasNuevas, setPermitirPosturasNuevas] = useState(
    Boolean(programaBase.permitirPosturasNuevas)
  );
  const [asignacionPostura, setAsignacionPostura] = useState(
    () => programaBase.asignacionPostura ?? 'aleatoria'
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

  function manejarConfirmacion() {
    const programaConfigurado = armarProgramaDeLaSesion({
      programaBase,
      posturasDelPrograma,
      idsDePosturasSeleccionadas: posturasSeleccionadas,
      perfilDePuntaje,
      permitirPosturasNuevas,
      idioma: idiomaDelDebate,
      asignacionPostura,
    });

    if (!programaConfigurado) {
      return;
    }

    onConfirmarConfiguracion(programaConfigurado);
  }

  const hayQueElegir = posturasDelPrograma.length > 2;
  const posturasValidas = posturasSeleccionadas.size >= 2;

  return (
    <section className="tarjeta-de-programa">
      <div className="encabezado-de-tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="texto-de-ayuda">Etapa 1: Configuración previa del debate</p>
          <h2>{programaBase.titulo}</h2>
        </div>
        <button type="button" className="boton-cambiar-programa" onClick={onCambiarPrograma}>
          Cambiar Programa
        </button>
      </div>
      <p>{programaBase.temaCentral}</p>

      {hayQueElegir && (
        <div className="selector-de-posturas">
          <p className="texto-de-ayuda">
            Este Programa tiene {posturasDelPrograma.length} posturas — elige cuáles se debaten hoy (mínimo 2):
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
                name="modo-asignacion-postura-inicial"
                checked={asignacionPostura === 'aleatoria'}
                onChange={() => setAsignacionPostura('aleatoria')}
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
                name="modo-asignacion-postura-inicial"
                checked={asignacionPostura === 'por_argumento'}
                onChange={() => setAsignacionPostura('por_argumento')}
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
                name="modo-asignacion-postura-inicial"
                checked={asignacionPostura === 'libre'}
                onChange={() => setAsignacionPostura('libre')}
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
                  name="perfil-de-puntaje-inicial"
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
        <p className="texto-de-ayuda">Idioma de los argumentos</p>
        <ul className="lista-de-perfiles">
          {Object.entries(IDIOMAS_DEL_DEBATE).map(([clave, idioma]) => (
            <li key={clave}>
              <label>
                <input
                  type="radio"
                  name="idioma-del-debate-inicial"
                  checked={idiomaDelDebate === clave}
                  onChange={() => setIdiomaDelDebate(clave)}
                />
                <strong>{idioma.etiqueta}</strong>
              </label>
            </li>
          ))}
        </ul>
        <p className="texto-de-ayuda">
          Cambia el corrector ortográfico de los campos de texto y el idioma en que Groq revisa los argumentos. Los botones y avisos siguen en español.
        </p>
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
          Si está activo y un argumento no encaja en ninguna postura de la lista, el estudiante puede proponerla y tú decides si entra al debate.
        </p>
      </div>

      {!posturasValidas && (
        <p className="mensaje-de-error">Debes seleccionar al menos 2 posturas para abrir el debate.</p>
      )}

      <button
        type="button"
        disabled={!posturasValidas}
        onClick={manejarConfirmacion}
        style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', fontSize: '1.05rem', fontWeight: 'bold' }}
      >
        📲 Confirmar configuración y abrir sala (Generar QR)
      </button>
    </section>
  );
}
