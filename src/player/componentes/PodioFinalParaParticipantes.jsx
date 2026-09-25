import { useMemo } from 'react';
import { calcularPodioDePosturas, calcularPodioIndividual } from '../../shared/estado/seleccionesDerivadas.js';
import { Creditos } from '../../shared/componentes/Creditos.jsx';
import { construirEtapasDelPodio, puestosRevelados, MAXIMO_DE_PUESTOS_EN_EL_PODIO } from '../podio/etapasDelPodio.js';
import { useRevelacionPorEtapas } from '../podio/useRevelacionPorEtapas.js';
import { useAtencionDelTurno } from '../useAtencionDelTurno.js';

// Las etiquetas de postura suelen ser «Más estado / redistribución»: en una columna de podio de
// 90 px cabe la parte corta («Más estado»); la etiqueta completa queda en el título del escalón.
function nombreCortoDeLaPostura(etiqueta) {
  return String(etiqueta).split(' / ')[0];
}

const MEDALLA_POR_PUESTO = { 1: '🥇', 2: '🥈', 3: '🥉' };
const NOMBRE_DEL_PUESTO = { 1: 'Primer lugar', 2: 'Segundo lugar', 3: 'Tercer lugar' };
const MENSAJE_POR_NIVEL = {
  Sólido: '¡Un debate sólido! Tus argumentos sostuvieron la discusión.',
  Consistente: 'Un debate consistente: aportaste razones que hicieron avanzar la conversación.',
  'En desarrollo': 'Tu debate está en desarrollo: cada intervención cuenta y la práctica te hace mejor.',
};

// Confeti solo decorativo (CSS): se oculta con «reducir movimiento» y para lectores de pantalla.
function Confeti() {
  return (
    <div className="confeti" aria-hidden="true">
      {Array.from({ length: 14 }, (_, indice) => (
        <span key={indice} className="confeti__pieza" style={{ '--n': indice }} />
      ))}
    </div>
  );
}

// Un podio de hasta 3 puestos. Los lugares aún no revelados se ven como un «?» para dar suspenso.
function BloqueDePodio({ titulo, tipo, entradas, reveladas, describir, idDelUsuario }) {
  const puestos = Math.min(MAXIMO_DE_PUESTOS_EN_EL_PODIO, entradas.length);
  // Orden visual clásico de un podio: 2.º a la izquierda, 1.º al centro y 3.º a la derecha.
  const ordenVisual = [2, 1, 3].filter((posicion) => posicion <= puestos);

  return (
    <section className="podio-bloque" aria-label={titulo}>
      <h3 className="podio-bloque__titulo">{titulo}</h3>
      <div className={`podio-escalones podio-escalones--de-${puestos}`}>
        {ordenVisual.map((posicion) => {
          const entrada = entradas[posicion - 1];
          const revelado = reveladas.has(posicion);
          const esTuyo = revelado && tipo === 'individual' && entrada.participantId === idDelUsuario;
          const detalle = revelado ? describir(entrada) : null;
          return (
            <div
              key={posicion}
              className={[
                'escalon',
                `escalon--puesto-${posicion}`,
                revelado ? 'escalon--revelado' : 'escalon--oculto',
                esTuyo ? 'escalon--tuyo' : '',
              ].join(' ')}
              data-puesto={posicion}
              title={detalle?.etiquetaCompleta}
            >
              {revelado && posicion === 1 && <Confeti />}
              <div className="escalon__contenido">
                {revelado ? (
                  <>
                    <span className="escalon__medalla" aria-hidden="true">{MEDALLA_POR_PUESTO[posicion]}</span>
                    <span className="escalon__emblema" aria-hidden="true">{detalle.emblema}</span>
                    <span className="escalon__nombre">{detalle.nombre}</span>
                    <span className="escalon__puntos">{detalle.puntos}</span>
                    {esTuyo && <span className="escalon__tuyo">¡Eres tú!</span>}
                  </>
                ) : (
                  <span className="escalon__misterio" aria-hidden="true">?</span>
                )}
              </div>
              <div className="escalon__base" aria-hidden="true">{posicion}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TarjetaDeTuResultado({ estado, participantId, podioIndividual, podioDePosturas }) {
  const yo = estado.participantes?.[participantId];
  const entradaMia = podioIndividual.find((entrada) => entrada.participantId === participantId);

  if (yo?.rol === 'co_moderador') {
    return (
      <section className="podio-tu-resultado" aria-label="Tu resultado">
        <h3>🧑‍⚖️ Fuiste co-moderador</h3>
        <p>Tus calificaciones ayudaron a evaluar las exposiciones del debate. ¡Gracias por sostener el criterio del grupo!</p>
      </section>
    );
  }

  if (!entradaMia) {
    return (
      <section className="podio-tu-resultado" aria-label="Tu resultado">
        <h3>👋 Gracias por acompañar el debate</h3>
        <p>Esta vez lo viste desde la tribuna. En el próximo, tu argumento puede estar en el podio.</p>
      </section>
    );
  }

  const posturaMia = podioDePosturas.findIndex((postura) => postura.stanceId === entradaMia.stanceId);
  return (
    <section className="podio-tu-resultado" aria-label="Tu resultado">
      <h3>Tu resultado</h3>
      <p className="podio-tu-resultado__puesto">
        Puesto <strong>{entradaMia.posicion}</strong> de {podioIndividual.length} · <strong>{entradaMia.puntajeTotal} pts</strong>
      </p>
      <p>{MENSAJE_POR_NIVEL[entradaMia.tier] ?? ''}</p>
      {posturaMia >= 0 && podioDePosturas.length >= 2 && (
        <p className="texto-de-ayuda">
          Tu postura, «{podioDePosturas[posturaMia].etiqueta}», quedó en el puesto {posturaMia + 1} de {podioDePosturas.length}.
        </p>
      )}
    </section>
  );
}

// Pantalla final del participante: el podio se descubre poco a poco (del último lugar al primero),
// con suspenso, y al terminar aparecen su resultado personal, la tabla completa y los créditos.
export function PodioFinalParaParticipantes({ estado, programa, presencia, participantId }) {
  const podioDePosturas = useMemo(
    () => calcularPodioDePosturas(estado, programa, presencia).filter((postura) => postura.totalIntegrantes > 0),
    [estado, programa, presencia]
  );
  const podioIndividual = useMemo(() => calcularPodioIndividual(estado, presencia), [estado, presencia]);
  const etapas = useMemo(
    () => construirEtapasDelPodio({ podioDePosturas, podioIndividual }),
    [podioDePosturas, podioIndividual]
  );
  const { indice, terminado, saltar, repetir } = useRevelacionPorEtapas(etapas);
  // Al cerrarse el debate la persona puede tener la página desplazada a cualquier parte: el podio
  // se lleva solo a la pantalla (desde su primera línea) para que no se pierda la revelación.
  const referenciaDelPodio = useAtencionDelTurno(true, '🏆 ¡Ya está el podio!', { bloque: 'start' });

  const posturasReveladas = puestosRevelados(etapas, indice, 'postura');
  const individualesReveladas = puestosRevelados(etapas, indice, 'individual');
  const hayPodioDePosturas = etapas.some((etapa) => etapa.tipo === 'postura');
  const hayPodioIndividual = etapas.some((etapa) => etapa.tipo === 'individual');
  const enIntroduccion = etapas[indice]?.tipo === 'introduccion';
  // El podio individual aparece cuando el de posturas ya reveló todos sus puestos.
  const posturasCompletas =
    !hayPodioDePosturas || posturasReveladas.size === Math.min(MAXIMO_DE_PUESTOS_EN_EL_PODIO, podioDePosturas.length);
  const mostrarPodioIndividual = !enIntroduccion && hayPodioIndividual && posturasCompletas;

  const etapaActual = etapas[indice];
  const anuncio = etapaActual?.posicion
    ? `${NOMBRE_DEL_PUESTO[etapaActual.posicion]} ${etapaActual.tipo === 'postura' ? 'por postura' : 'individual'}`
    : '';

  return (
    <section className="podio-final-participante" aria-live="polite" ref={referenciaDelPodio}>
      <header className="podio-final__encabezado">
        <p className="podio-final__etiqueta">🏁 Debate cerrado</p>
        <h2>{enIntroduccion ? '🥁 Y ahora… ¡el podio!' : terminado ? '🏆 El podio final' : '🥁 Descubriendo el podio…'}</h2>
        {!terminado && (
          <button type="button" className="boton-secundario podio-final__saltar" onClick={saltar}>
            Saltar la animación
          </button>
        )}
        <p className="visualmente-oculto">{anuncio}</p>
      </header>

      {enIntroduccion && (
        <p className="podio-final__suspenso" aria-hidden="true">
          <span>.</span><span>.</span><span>.</span>
        </p>
      )}

      {!enIntroduccion && hayPodioDePosturas && (
        <BloqueDePodio
          titulo="🏆 Podio por postura"
          tipo="postura"
          entradas={podioDePosturas}
          reveladas={posturasReveladas}
          idDelUsuario={participantId}
          describir={(postura) => ({
            emblema: '🚩',
            nombre: nombreCortoDeLaPostura(postura.etiqueta),
            etiquetaCompleta: postura.etiqueta,
            puntos: `${postura.puntajeTotalPostura} pts`,
          })}
        />
      )}

      {mostrarPodioIndividual && (
        <BloqueDePodio
          titulo="🎖️ Podio individual"
          tipo="individual"
          entradas={podioIndividual}
          reveladas={individualesReveladas}
          idDelUsuario={participantId}
          describir={(persona) => ({
            emblema: persona.emoji,
            nombre: persona.nombre,
            puntos: `${persona.puntajeTotal} pts`,
          })}
        />
      )}

      {terminado && (
        <>
          <TarjetaDeTuResultado
            estado={estado}
            participantId={participantId}
            podioIndividual={podioIndividual}
            podioDePosturas={podioDePosturas}
          />

          {podioIndividual.length > 3 && (
            <details className="podio-tabla-completa">
              <summary>Ver la tabla completa</summary>
              <ol>
                {podioIndividual.map((persona) => (
                  <li key={persona.participantId} className={persona.participantId === participantId ? 'podio-tabla-completa__yo' : ''}>
                    {persona.emoji} {persona.nombre} — {persona.puntajeTotal} pts
                  </li>
                ))}
              </ol>
            </details>
          )}

          <p className="podio-final__gracias">¡Gracias por debatir! Tus argumentos hicieron pensar a todo el grupo.</p>
          <button type="button" className="boton-secundario" onClick={repetir}>
            🔁 Ver la revelación otra vez
          </button>
          <Creditos />
        </>
      )}
    </section>
  );
}
