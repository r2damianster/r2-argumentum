import { useEffect, useRef, useState } from 'react';
import { EVENTOS_PRIVADOS } from '../../../shared/nucleo/entregas/canalesPrivados.js';
import { contarPalabras, contarParrafos } from '../../../shared/nucleo/escritura/contarTexto.js';
import { esperaAleatoriaDelEnvioMs } from '../../../shared/nucleo/entregas/escalonadoDelEnvio.js';
import { resolverNumeroDeParrafos } from '../../../shared/nucleo/escritura/estructurasDeEscritura.js';
import { resolverIdiomaDelDebate } from '../../../shared/programa/idiomaDelDebate.js';
import { useControlDeIntegridad } from '../../../shared/nucleo/integridad/useControlDeIntegridad.js';
import { CONTEXTOS_DE_REDACCION } from '../../../shared/nucleo/integridad/canalPrivado.js';
import { AdvertenciaDeIntegridad, AvisoDeIntegridad } from '../../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { IndicadorDePegado } from '../../../shared/componentes/lectura/IndicadorDePegado.jsx';
import { penalizacionPorPegadoEstaActiva } from '../../../shared/nucleo/integridad/penalizacionPorPegado.js';

// El borrador vive en el navegador de cada persona y por sesión: quien cierra la pestaña por error
// recupera lo escrito. No viaja a ninguna parte hasta que se envía.
function claveDelBorrador(identificadorDeSesion, participantId) {
  return `r2-argumentum-borrador-lectura:${identificadorDeSesion ?? 'sesion'}:${participantId}`;
}

function leerBorrador(clave) {
  try {
    return localStorage.getItem(clave) ?? '';
  } catch {
    return '';
  }
}

function guardarBorrador(clave, texto) {
  try {
    if (texto) {
      localStorage.setItem(clave, texto);
    } else {
      localStorage.removeItem(clave);
    }
  } catch {
    // Sin localStorage el borrador simplemente no sobrevive a cerrar la pestaña.
  }
}

// Un solo cuadro de texto, con el conteo de palabras y párrafos. No se restringe nada: cada persona
// escribe como quiera. Una sola entrega; no se edita después de enviar (docs/14-control-de-lectura.md).
export function CompositorDeLaEntrega({
  estado,
  programa,
  participantId,
  escrituraAbierta,
  escrituraYaCerro,
  publicarIntegridad,
  publicarEntregaPrivada,
}) {
  // El host anuncia las entregas a la sala en lote cada pocos segundos: para que la persona vea su confirmación
  // al instante se recuerda aquí lo que acaba de enviar por su canal privado.
  const [entregaLocal, setEntregaLocal] = useState(null);
  const entrega = estado.lectura?.entregas?.[participantId] ?? entregaLocal;
  const clave = claveDelBorrador(estado.sesion.identificador, participantId);
  const idioma = resolverIdiomaDelDebate(programa);
  const parrafosPedidos = resolverNumeroDeParrafos(programa, idioma);

  const [texto, setTexto] = useState(() => leerBorrador(clave));
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Mientras espera su turno de envío (escalonado) la persona no debe ver «no se registró ninguna entrega».
  const [esperandoElEnvioPorTiempo, setEsperandoElEnvioPorTiempo] = useState(false);
  const yaIntentoElEnvioPorTiempo = useRef(false);
  const campoDeTexto = useRef(null);

  const integridad = useControlDeIntegridad({
    programa,
    contexto: CONTEXTOS_DE_REDACCION.ENTREGA_DE_LECTURA,
    texto,
    publicarIntegridad,
  });

  useEffect(() => {
    if (!entrega) {
      guardarBorrador(clave, texto);
    }
  }, [clave, texto, entrega]);

  const palabras = contarPalabras(texto);
  const parrafos = contarParrafos(texto);

  // Primero el texto por el canal privado (si falla, la persona puede reintentar con su texto intacto) y
  // después el aviso público, que solo lleva los conteos.
  async function enviar({ porTiempo }) {
    const textoFinal = texto.trim();
    if (!textoFinal || enviando) {
      return;
    }
    setEnviando(true);
    setError('');
    try {
      // El texto va solo por el canal privado; el aviso a la sala (con los conteos) lo publica el host en lote.
      await publicarEntregaPrivada(EVENTOS_PRIVADOS.ENTREGA_TEXTO, { texto: textoFinal, enviadoPorTiempo: porTiempo });
      setEntregaLocal({
        participantId,
        palabras: contarPalabras(textoFinal),
        parrafos: contarParrafos(textoFinal),
        enviadaPorTiempo: porTiempo,
      });
      setConfirmandoEnvio(false);
    } catch (fallo) {
      console.warn('[r2-argumentum] no se pudo enviar la entrega', fallo);
      setError('No se pudo enviar. Revisa tu conexión y vuelve a intentarlo: tu texto sigue aquí.');
      yaIntentoElEnvioPorTiempo.current = false;
    } finally {
      setEnviando(false);
    }
  }

  // Al cerrarse la escritura (por tiempo o porque el docente la cerró) se envía lo que haya escrito. El envío se
  // escalona con una espera aleatoria que crece con el tamaño de la sala: si todos publicaran en el mismo
  // instante, Ably rechazaría parte de las entregas (ver escalonadoDelEnvio.js). No se cancela el temporizador al
  // desmontar: lo escrito tiene que salir.
  useEffect(() => {
    if (!escrituraYaCerro || entrega || yaIntentoElEnvioPorTiempo.current || !texto.trim()) {
      return;
    }
    yaIntentoElEnvioPorTiempo.current = true;
    setEsperandoElEnvioPorTiempo(true);
    const espera = esperaAleatoriaDelEnvioMs(Object.keys(estado.participantes ?? {}).length);
    setTimeout(() => {
      setEsperandoElEnvioPorTiempo(false);
      integridad.intentarEnviar({ alEnviar: () => enviar({ porTiempo: true }), sinAdvertencia: true });
    }, espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrituraYaCerro, entrega]);

  function pedirConfirmacion() {
    setError('');
    if (!texto.trim()) {
      setError('Escribe algo antes de enviar.');
      return;
    }
    setConfirmandoEnvio(true);
  }

  function confirmarEnvio() {
    integridad.intentarEnviar({ alEnviar: () => enviar({ porTiempo: false }) });
  }

  if (entrega) {
    return (
      <section className="compositor-de-lectura compositor-de-lectura--entregado">
        <p>
          ✅ <strong>Entregaste tu texto</strong> ({entrega.palabras} palabras, {entrega.parrafos} párrafo(s))
          {entrega.enviadaPorTiempo && <span className="texto-de-ayuda"> · enviado al terminar el tiempo</span>}
        </p>
        {texto && <blockquote className="cita-de-argumento texto-entregado">{texto}</blockquote>}
      </section>
    );
  }

  if (!escrituraAbierta) {
    if (esperandoElEnvioPorTiempo || enviando) {
      return (
        <section className="compositor-de-lectura">
          <p className="texto-de-ayuda">Enviando tu texto… no cierres esta pantalla.</p>
        </section>
      );
    }
    if (error && escrituraYaCerro && texto.trim()) {
      return (
        <section className="compositor-de-lectura">
          <p className="mensaje-de-error">{error}</p>
          <button type="button" className="boton-primario" onClick={() => enviar({ porTiempo: true })}>
            Reintentar el envío
          </button>
        </section>
      );
    }
    return (
      <section className="compositor-de-lectura">
        <p className="texto-de-ayuda">
          {escrituraYaCerro ? 'La escritura terminó y no se registró ninguna entrega tuya.' : 'La escritura todavía no está abierta.'}
        </p>
      </section>
    );
  }

  return (
    <section className="compositor-de-lectura">
      <AvisoDeIntegridad nivel={integridad.nivel} conDescuento={penalizacionPorPegadoEstaActiva(programa)} />
      <label>
        Tu texto
        <textarea
          ref={campoDeTexto}
          {...integridad.propsDelCampo}
          value={texto}
          rows={9}
          lang={idioma}
          spellCheck
          autoCapitalize="sentences"
          disabled={enviando}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setConfirmandoEnvio(false);
            setError('');
            // Un aviso de integridad pendiente era sobre el texto de antes: ya no vale.
            if (integridad.advertenciaPendiente) {
              integridad.cancelarEnvioPendiente();
            }
          }}
        />
      </label>
      <IndicadorDePegado proporcion={integridad.proporcionPegada} activo={penalizacionPorPegadoEstaActiva(programa)} />
      <p className="contador-de-palabras">
        {palabras} palabra(s) · {parrafos} de {parrafosPedidos} párrafo(s) pedidos
      </p>
      {parrafos > 0 && parrafos !== parrafosPedidos && (
        <p className="texto-de-ayuda">La consigna pide {parrafosPedidos} párrafo(s); separa cada uno con un salto de línea.</p>
      )}

      {error && <p className="mensaje-de-error">{error}</p>}

      {integridad.advertenciaPendiente && (
        <AdvertenciaDeIntegridad
          resumen={integridad.advertenciaPendiente}
          onEnviarIgual={integridad.confirmarEnvioPendiente}
          onReescribir={() => {
            integridad.cancelarEnvioPendiente();
            setConfirmandoEnvio(false);
            campoDeTexto.current?.focus();
          }}
        />
      )}

      {!integridad.advertenciaPendiente && confirmandoEnvio && (
        <div className="aviso-de-validacion">
          <p>
            <strong>Una vez enviado, no se puede editar.</strong> ¿Quieres enviar tu texto ahora?
          </p>
          <div className="botonera-de-bid">
            <button type="button" className="boton-exito" disabled={enviando} onClick={confirmarEnvio}>
              {enviando ? 'Enviando…' : 'Sí, enviar'}
            </button>
            <button type="button" className="boton-secundario" disabled={enviando} onClick={() => setConfirmandoEnvio(false)}>
              Seguir editando
            </button>
          </div>
        </div>
      )}

      {!integridad.advertenciaPendiente && !confirmandoEnvio && (
        <div className="botonera-de-bid">
          <button type="button" className="boton-primario" onClick={pedirConfirmacion}>
            Enviar mi texto
          </button>
        </div>
      )}
    </section>
  );
}
