import { useState } from 'react';
import { IDIOMAS_DEL_DEBATE, resolverIdiomaDelDebate } from '../../../shared/programa/idiomaDelDebate.js';
import {
  DISTRIBUCIONES_DE_ESTRUCTURA,
  ESTRUCTURAS_DE_SERIE,
  ETIQUETA_DE_LA_DISTRIBUCION,
  resolverDistribucion,
  resolverEstructuraDelPrograma,
  resolverNumeroDeParrafos,
} from '../../../shared/nucleo/escritura/estructurasDeEscritura.js';
import { integridadEstaActiva, normalizarIntegridad } from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { resolverUmbralesDeSimilitud } from '../../../shared/nucleo/integridad/similitudDeTextos.js';
import { normalizarPenalizacionPorPegado } from '../../../shared/nucleo/integridad/penalizacionPorPegado.js';
import { resolverRubricaDelPrograma } from '../../../shared/nucleo/rubrica/rubrica.js';
import { MINIMO_DE_PARTICIPANTES_PARA_REVISAR_ENTRE_PARES } from '../../../shared/nucleo/revisionEntrePares/asignarRevisionesEntrePares.js';
import {
  armarProgramaDeLaSesionDeLectura,
  normalizarProgramaDeLectura,
  normalizarRevisionDePares,
  resolverDuracionDeLaEscrituraMin,
  resolverVentanaDeConfirmacionMin,
} from '../../../actividades/controlDeLectura/programaDeLectura.js';
import { SelectorDeIntegridad } from '../SelectorDeIntegridad.jsx';

const ID_DE_LA_ESTRUCTURA_PROPIA = 'propia';

function programaTienePropia(programa) {
  return typeof programa.estructura === 'object' && programa.estructura !== null && !programa.estructura.id;
}

// Configuración previa del control de lectura: lo que el docente ajusta para ESTA sesión antes de abrir
// la sala. La consigna, la rúbrica y las claves de la lectura vienen del Programa (ver docs/14).
export function PantallaDeConfiguracionDeLectura({ programaBase, onConfirmarConfiguracion, onCambiarPrograma }) {
  const [programaNormalizado] = useState(() => normalizarProgramaDeLectura(programaBase));
  const tienePropia = programaTienePropia(programaBase);

  const [idioma, setIdioma] = useState(() => resolverIdiomaDelDebate(programaBase));
  const [duracionMin, setDuracionMin] = useState(() => resolverDuracionDeLaEscrituraMin(programaBase));
  const [numeroDeParrafos, setNumeroDeParrafos] = useState(() => resolverNumeroDeParrafos(programaBase));
  const [estructuraElegida, setEstructuraElegida] = useState(() =>
    tienePropia ? ID_DE_LA_ESTRUCTURA_PROPIA : (programaBase.estructura?.id ?? programaBase.estructura ?? 'libre')
  );
  const [distribucion, setDistribucion] = useState(() => resolverDistribucion(programaBase));
  const [ventanaDeConfirmacionMin, setVentanaDeConfirmacionMin] = useState(() => resolverVentanaDeConfirmacionMin(programaBase));
  const [integridad, setIntegridad] = useState(() => normalizarIntegridad(programaNormalizado.integridad));
  const [penalizacion, setPenalizacion] = useState(() => normalizarPenalizacionPorPegado(programaBase.penalizacionPorPegado));
  const [umbrales, setUmbrales] = useState(() => resolverUmbralesDeSimilitud(programaBase));
  const [revisionDePares, setRevisionDePares] = useState(() => normalizarRevisionDePares(programaBase.revisionDePares));

  const estructuraPedida = estructuraElegida === ID_DE_LA_ESTRUCTURA_PROPIA ? programaBase.estructura : estructuraElegida;
  const estructuraResuelta = resolverEstructuraDelPrograma({ estructura: estructuraPedida }, idioma);
  const rubrica = resolverRubricaDelPrograma(programaBase);

  const duracionValida = Number(duracionMin) >= 1;
  const parrafosValidos = Number(numeroDeParrafos) >= 1;
  const ventanaValida = Number(ventanaDeConfirmacionMin) >= 1;
  const umbralesValidos =
    Number(umbrales.atencion) > 0 &&
    Number(umbrales.atencion) < Number(umbrales.alto) &&
    Number(umbrales.alto) < Number(umbrales.probableCopia) &&
    Number(umbrales.probableCopia) <= 100;
  const revisionValida =
    !revisionDePares.activa || (Number(revisionDePares.revisionesPorPersona) >= 1 && Number(revisionDePares.duracionMin) >= 1);

  function confirmar() {
    onConfirmarConfiguracion(
      armarProgramaDeLaSesionDeLectura({
        programaBase,
        idioma,
        duracionDeLaEscrituraMin: Math.floor(Number(duracionMin)),
        numeroDeParrafos: Math.floor(Number(numeroDeParrafos)),
        estructura: estructuraPedida,
        distribucion,
        integridad,
        penalizacionPorPegado: { activa: penalizacion.activa, descuentoMaximo: Number(penalizacion.descuentoMaximo) },
        umbralesDeSimilitud: {
          atencion: Number(umbrales.atencion),
          alto: Number(umbrales.alto),
          probableCopia: Number(umbrales.probableCopia),
        },
        revisionDePares,
        ventanaDeConfirmacionMin: Math.floor(Number(ventanaDeConfirmacionMin)),
      })
    );
  }

  return (
    <section className="tarjeta-de-programa">
      <div className="encabezado-de-tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <p className="texto-de-ayuda">Configuración previa del control de lectura</p>
          <h2>{programaBase.titulo}</h2>
        </div>
        <button type="button" className="boton-cambiar-programa" onClick={onCambiarPrograma}>
          Cambiar Programa
        </button>
      </div>

      <div className="guia-de-la-consigna">
        <p className="etiqueta-de-la-consigna">Consigna del Programa</p>
        <p className="texto-de-la-consigna">{programaBase.consigna}</p>
      </div>

      <div className="bloque-de-configuracion">
        <label>
          Duración de la escritura (minutos)
          <input type="number" min="1" max="180" value={duracionMin} onChange={(evento) => setDuracionMin(evento.target.value)} />
        </label>
        <p className="texto-de-ayuda">Puedes extenderla en vivo de 5 en 5 minutos.</p>
      </div>

      <div className="bloque-de-configuracion">
        <label>
          Estructura de escritura
          <select value={estructuraElegida} onChange={(evento) => setEstructuraElegida(evento.target.value)}>
            {Object.values(ESTRUCTURAS_DE_SERIE).map((estructura) => (
              <option key={estructura.id} value={estructura.id}>
                {estructura.nombre.es}
                {estructura.partes.length > 0 ? ` — ${estructura.partes.map((parte) => parte.nombre.es).join(', ')}` : ''}
              </option>
            ))}
            {tienePropia && (
              <option value={ID_DE_LA_ESTRUCTURA_PROPIA}>
                {resolverEstructuraDelPrograma(programaBase, idioma).nombre} (propia del Programa)
              </option>
            )}
          </select>
        </label>
        <label>
          Número de párrafos
          <input type="number" min="1" max="12" value={numeroDeParrafos} onChange={(evento) => setNumeroDeParrafos(evento.target.value)} />
        </label>
        {!estructuraResuelta.esLibre && (
          <ul className="lista-de-perfiles">
            {Object.values(DISTRIBUCIONES_DE_ESTRUCTURA).map((valor) => (
              <li key={valor}>
                <label>
                  <input
                    type="radio"
                    name="distribucion-de-la-estructura"
                    checked={distribucion === valor}
                    onChange={() => setDistribucion(valor)}
                  />
                  <span>{ETIQUETA_DE_LA_DISTRIBUCION[valor]}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="texto-de-ayuda">
          La plataforma solo cuenta palabras y párrafos y muestra la guía de la estructura: no restringe lo que escribe cada
          persona.
        </p>
      </div>

      <div className="bloque-de-configuracion">
        <p className="texto-de-ayuda">Idioma del ejercicio</p>
        <ul className="lista-de-perfiles">
          {Object.entries(IDIOMAS_DEL_DEBATE).map(([clave, idiomaDisponible]) => (
            <li key={clave}>
              <label>
                <input type="radio" name="idioma-de-la-lectura" checked={idioma === clave} onChange={() => setIdioma(clave)} />
                <strong>{idiomaDisponible.etiqueta}</strong>
              </label>
            </li>
          ))}
        </ul>
        <p className="texto-de-ayuda">Cambia el corrector del navegador y el nombre de las partes de la estructura.</p>
      </div>

      <div className="bloque-de-configuracion">
        <label>
          Ventana para que cada estudiante confirme su devolución (minutos)
          <input
            type="number"
            min="1"
            max="120"
            value={ventanaDeConfirmacionMin}
            onChange={(evento) => setVentanaDeConfirmacionMin(evento.target.value)}
          />
        </label>
        <p className="texto-de-ayuda">Si no responde dentro de la ventana, su entrega se confirma sola con la calificación asignada.</p>
      </div>

      <div className="bloque-de-configuracion">
        <label className="casilla-de-falta">
          <input
            type="checkbox"
            checked={revisionDePares.activa}
            onChange={(evento) => setRevisionDePares((actual) => ({ ...actual, activa: evento.target.checked }))}
          />
          Revisión entre pares después de escribir
        </label>
        <p className="texto-de-ayuda">
          Cada estudiante revisa textos de compañeros, de forma anónima y con la misma rúbrica. Tú apruebas los comentarios antes
          de que lleguen al autor, y quien revisa suma puntos según qué tanto coincide con tu calificación. Necesita al menos{' '}
          {MINIMO_DE_PARTICIPANTES_PARA_REVISAR_ENTRE_PARES} entregas. Con esta opción la devolución se envía cuando termina la
          revisión.
        </p>
        {revisionDePares.activa && (
          <>
            <label>
              Textos que revisa cada persona
              <input
                type="number"
                min="1"
                max="5"
                value={revisionDePares.revisionesPorPersona}
                onChange={(evento) => setRevisionDePares((actual) => ({ ...actual, revisionesPorPersona: evento.target.value }))}
              />
            </label>
            <label>
              Duración de la revisión (minutos)
              <input
                type="number"
                min="1"
                max="120"
                value={revisionDePares.duracionMin}
                onChange={(evento) => setRevisionDePares((actual) => ({ ...actual, duracionMin: evento.target.value }))}
              />
            </label>
          </>
        )}
      </div>

      <SelectorDeIntegridad integridad={integridad} onCambiarIntegridad={setIntegridad} />

      {integridadEstaActiva({ integridad }) && (
        <div className="bloque-de-configuracion">
          <label className="casilla-de-falta">
            <input
              type="checkbox"
              checked={penalizacion.activa}
              onChange={(evento) => setPenalizacion((actual) => ({ ...actual, activa: evento.target.checked }))}
            />
            Descontar automáticamente por texto pegado
          </label>
          <p className="texto-de-ayuda">
            Al pegar, el estudiante recibe un aviso al instante y ve un color de verde a rojo (nunca un número). El descuento sale de
            la parte del texto que se pegó; borrar lo pegado no lo elimina del todo. Tú lo puedes revertir por entrega.
          </p>
          {penalizacion.activa && (
            <label>
              Descuento máximo si todo el texto es pegado (puntos sobre 10)
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={penalizacion.descuentoMaximo}
                onChange={(evento) => setPenalizacion((actual) => ({ ...actual, descuentoMaximo: evento.target.value }))}
              />
            </label>
          )}
        </div>
      )}

      {integridadEstaActiva({ integridad }) && (
        <div className="bloque-de-configuracion">
          <p className="texto-de-ayuda">Parecido entre textos: desde qué porcentaje se marca cada banda</p>
          <div className="botonera-de-bid">
            {[
              ['atencion', 'Atención desde'],
              ['alto', 'Alto desde'],
              ['probableCopia', 'Probable copia desde'],
            ].map(([clave, etiqueta]) => (
              <label key={clave}>
                {etiqueta} (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={umbrales[clave]}
                  onChange={(evento) => setUmbrales((actuales) => ({ ...actuales, [clave]: evento.target.value }))}
                />
              </label>
            ))}
          </div>
          <p className="texto-de-ayuda">
            Se comparan secuencias de 5 palabras entre las entregas (y con los ejemplos y el texto de la lectura, si lo cargaste);
            lo que va entre comillas no cuenta. Es una advertencia para ti: nunca hay sanción automática ni anulación.
          </p>
          {!umbralesValidos && <p className="mensaje-de-error">Los umbrales deben ir de menor a mayor y el último no puede pasar de 100.</p>}
        </div>
      )}

      <div className="bloque-de-configuracion">
        <p className="texto-de-ayuda">Rúbrica ({rubrica.length} criterios)</p>
        <ul className="lista-de-criterios-de-rubrica">
          {rubrica.map((criterio) => (
            <li key={criterio.id}>
              <strong>{criterio.nombre}</strong> <span className="texto-de-ayuda">· peso {criterio.peso}</span>
            </li>
          ))}
        </ul>
        <p className="texto-de-ayuda">
          La rúbrica sale del Programa (criterios de serie más los de la consigna). Cada criterio tiene 4 niveles; la nota sale
          sobre 10 y solo la ves tú.
        </p>
      </div>

      {(!duracionValida || !parrafosValidos || !ventanaValida || !revisionValida) && (
        <p className="mensaje-de-error">Revisa los números: la duración, los párrafos, la ventana y la revisión deben ser al menos 1.</p>
      )}

      <button
        type="button"
        disabled={!duracionValida || !parrafosValidos || !ventanaValida || !revisionValida || !umbralesValidos}
        onClick={confirmar}
        style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', fontSize: '1.05rem', fontWeight: 'bold' }}
      >
        📲 Confirmar configuración y abrir sala (Generar QR)
      </button>
    </section>
  );
}
