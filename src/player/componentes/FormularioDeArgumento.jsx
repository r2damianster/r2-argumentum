import { useState } from 'react';
import { EVENTOS, TIPOS_DE_RELACION } from '../../shared/eventos/nombresDeEventos.js';
import { resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';
import { siguientePosicionParaParticipante } from '../../shared/estado/seleccionesDerivadas.js';

const TIPOS_QUE_REQUIEREN_OBJETIVO = [
  TIPOS_DE_RELACION.CONTRAARGUMENTO,
  TIPOS_DE_RELACION.REFUERZO,
  TIPOS_DE_RELACION.DILEMA,
  TIPOS_DE_RELACION.CONEXION,
];

const ETIQUETA_DE_TIPO = {
  [TIPOS_DE_RELACION.NUEVO]: 'Argumento nuevo',
  [TIPOS_DE_RELACION.CONTRAARGUMENTO]: 'Contraargumento',
  [TIPOS_DE_RELACION.REFUERZO]: 'Refuerzo',
  [TIPOS_DE_RELACION.DILEMA]: 'Dilema',
  [TIPOS_DE_RELACION.PREGUNTA]: 'Pregunta',
  [TIPOS_DE_RELACION.CONCESION]: 'Concesión',
};

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// modoApertura: la fase de apertura simultánea (ver docs/09) no tiene turno — todos
// escriben en paralelo su argumento inicial, siempre tipo "nuevo" (todavía no hay nada
// publicado a lo que responder). turnoEnCurso puede venir null en ese caso.
export function FormularioDeArgumento({ estado, programa, participantId, turnoEnCurso, publicar, modoApertura = false }) {
  const [tipoDeclarado, setTipoDeclarado] = useState(TIPOS_DE_RELACION.NUEVO);
  const [argumentoObjetivoId, setArgumentoObjetivoId] = useState('');
  const [texto, setTexto] = useState('');
  const [numeroDeIntento, setNumeroDeIntento] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const requiereObjetivo = !modoApertura && TIPOS_QUE_REQUIEREN_OBJETIVO.includes(tipoDeclarado);
  const argumentosExistentes = Object.values(estado.argumentos);
  const posicionEnRonda = siguientePosicionParaParticipante(estado, participantId);
  const ronda = modoApertura ? 1 : estado.fase.actual?.ronda ?? 1;
  const stanceId = estado.participantes[participantId]?.stanceId ?? null;
  const turnId = modoApertura ? `apertura-${participantId}` : turnoEnCurso.turnId;

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (!texto.trim() || (requiereObjetivo && !argumentoObjetivoId)) {
      return;
    }
    setEnviando(true);
    const attemptId = generarId('intento');
    publicar(EVENTOS.ARGUMENTO_INTENTO, {
      attemptId,
      participantId,
      turnId,
      ronda,
      numeroDeIntento,
      texto,
    });

    let resultado;
    try {
      const respuesta = await fetch('/api/groq-validar-argumento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ejemplos: programa.ejemplosPorTema, idioma: resolverIdiomaDelDebate(programa) }),
      });
      if (!respuesta.ok) {
        resultado = { aprobado: false, motivo: 'El validador no respondió, inténtalo de nuevo.', sugerenciaDeCorreccion: '' };
      } else {
        resultado = await respuesta.json();
      }
    } catch {
      resultado = { aprobado: false, motivo: 'No se pudo validar (error de conexión).', sugerenciaDeCorreccion: '' };
    }

    publicar(EVENTOS.ARGUMENTO_RESULTADO_VALIDACION, { attemptId, ...resultado });

    const argumentoDeBase = {
      argumentId: generarId('argumento'),
      participantId,
      turnId,
      ronda,
      posicionEnRonda,
      tipoDeclarado,
      argumentoObjetivoId: requiereObjetivo ? argumentoObjetivoId : null,
      texto,
      stanceId,
    };

    if (resultado.aprobado) {
      publicar(EVENTOS.ARGUMENTO_PUBLICADO, { ...argumentoDeBase, viaCoModerador: false });
      setEnviando(false);
      return;
    }

    if (numeroDeIntento >= programa.maxIntentosGroqPorArgumento) {
      publicar(EVENTOS.ARGUMENTO_PUBLICADO, { ...argumentoDeBase, viaCoModerador: true });
      setEnviando(false);
      return;
    }

    setUltimoResultado(resultado);
    setNumeroDeIntento((numero) => numero + 1);
    setEnviando(false);
  }

  return (
    <section className="tarjeta-de-formulario-de-argumento">
      {modoApertura ? (
        <p className="texto-de-ayuda">
          Escribe tu argumento inicial defendiendo tu postura — todos lo hacen al mismo tiempo, nadie espera
          turno todavía. Cuando termine el tiempo (o escriban todos), Groq revisa el conjunto completo y arranca
          la ronda de reacciones.
        </p>
      ) : (
        <p className="texto-de-ayuda">
          Es tu turno — puedes agregar un argumento nuevo, o elegir abajo un tipo para responder a algo que ya se
          dijo (contraargumento, refuerzo, dilema…) y apoyar o rebatir la postura de otro compañero.
        </p>
      )}
      <p className="texto-de-ayuda">
        Posición {posicionEnRonda} · intento {numeroDeIntento} de {programa.maxIntentosGroqPorArgumento}
      </p>
      <form onSubmit={manejarEnvio}>
        {!modoApertura && (
          <label>
            Tipo
            <select value={tipoDeclarado} onChange={(evento) => setTipoDeclarado(evento.target.value)}>
              {Object.entries(ETIQUETA_DE_TIPO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
        )}

        {requiereObjetivo && (
          <label>
            Argumento al que apunta
            <select value={argumentoObjetivoId} onChange={(evento) => setArgumentoObjetivoId(evento.target.value)}>
              <option value="">Elige uno…</option>
              {argumentosExistentes.map((argumento) => (
                <option key={argumento.argumentId} value={argumento.argumentId}>
                  {argumento.texto.slice(0, 50)}…
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Tu argumento
          <textarea value={texto} onChange={(evento) => setTexto(evento.target.value)} rows={4} />
        </label>

        {ultimoResultado && !ultimoResultado.aprobado && (
          <p className="mensaje-de-error">
            {ultimoResultado.motivo} {ultimoResultado.sugerenciaDeCorreccion}
          </p>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Validando…' : 'Enviar'}
        </button>
      </form>
    </section>
  );
}
