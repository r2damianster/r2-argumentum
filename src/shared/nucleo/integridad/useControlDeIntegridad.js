import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NIVELES_DE_INTEGRIDAD, resolverNivelDeIntegridad } from './nivelesDeIntegridad.js';
import { crearRecolectorDeSenales } from './recolectorDeSenales.js';
import { crearManejadoresDeEntrada, senalDeParecidoAEjemplos } from './manejadoresDeEntrada.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Orquesta la integridad de un campo de texto (ver docs/13-foro-escrito-y-nucleo-reutilizable.md).
// Con la integridad apagada (el valor por defecto) no hace NADA: ni escucha ni registra.
//
//   const integridad = useControlDeIntegridad({ programa, contexto, texto, publicarIntegridad });
//   <textarea {...integridad.propsDelCampo} />
//   integridad.intentarEnviar({ alEnviar: (argumentId) => publicar(…) })
//   {integridad.advertenciaPendiente && <AdvertenciaDeIntegridad … />}
//
// `intentarEnviar` genera el id del aporte y lo entrega a `alEnviar`, para que las marcas queden
// ligadas al aporte exacto. Si hay señales de gravedad media o alta y la advertencia está activa,
// primero se le muestra a quien escribe «el moderador verá esta marca» y se espera su decisión.
export function useControlDeIntegridad({ programa, contexto, texto, publicarIntegridad }) {
  const nivel = resolverNivelDeIntegridad(programa);
  const activo = nivel !== NIVELES_DE_INTEGRIDAD.NINGUNA;
  const bloquearPegado = nivel === NIVELES_DE_INTEGRIDAD.RESTRICTIVA;

  const recolector = useMemo(() => crearRecolectorDeSenales(), []);
  const manejadores = useMemo(
    () => crearManejadoresDeEntrada({ recolector, bloquearPegado }),
    [recolector, bloquearPegado]
  );
  const [advertenciaPendiente, setAdvertenciaPendiente] = useState(null);
  const envioPendienteRef = useRef(null);

  useEffect(() => {
    if (!activo) {
      return undefined;
    }
    function alCambiarLaVisibilidad() {
      manejadores.alCambiarLaVisibilidad(document.visibilityState === 'visible');
    }
    document.addEventListener('visibilitychange', alCambiarLaVisibilidad);
    return () => document.removeEventListener('visibilitychange', alCambiarLaVisibilidad);
  }, [activo, manejadores]);

  // Si se borra todo el texto, se empieza de cero: pegar algo y borrarlo para reescribir a mano no
  // debería seguir contando contra quien lo hizo.
  useEffect(() => {
    if (activo && String(texto ?? '') === '') {
      recolector.reiniciar();
      setAdvertenciaPendiente(null);
      envioPendienteRef.current = null;
    }
  }, [activo, texto, recolector]);

  const resumirTexto = useCallback(
    (textoFinal) =>
      recolector.resumir({
        textoFinal,
        senalesExternas: senalDeParecidoAEjemplos(textoFinal, programa?.ejemplosPorTema ?? []),
      }),
    [recolector, programa]
  );

  function ejecutarEnvio({ alEnviar, argumentId, resumen, advertenciaMostrada }) {
    alEnviar(argumentId);
    if (resumen && resumen.senales.length > 0 && publicarIntegridad) {
      publicarIntegridad({
        argumentId,
        contexto,
        senales: resumen.senales,
        gravedadMaxima: resumen.gravedadMaxima,
        estadisticas: resumen.estadisticas,
        advertenciaMostrada,
      });
    }
    recolector.reiniciar();
    setAdvertenciaPendiente(null);
    envioPendienteRef.current = null;
  }

  // `sinAdvertencia`: el envío no puede esperar una decisión de la persona (por ejemplo, el borrador que
  // se envía solo al agotarse el tiempo). Las señales se registran igual; solo se omite el aviso previo.
  function intentarEnviar({ alEnviar, sinAdvertencia = false }) {
    const argumentId = generarId('aporte');
    if (!activo) {
      alEnviar(argumentId);
      return;
    }
    const resumen = resumirTexto(String(texto ?? '').trim());
    if (resumen.requiereAdvertencia && !sinAdvertencia) {
      envioPendienteRef.current = { alEnviar, argumentId, resumen };
      setAdvertenciaPendiente(resumen);
      return;
    }
    ejecutarEnvio({ alEnviar, argumentId, resumen, advertenciaMostrada: false });
  }

  function confirmarEnvioPendiente() {
    const pendiente = envioPendienteRef.current;
    if (pendiente) {
      ejecutarEnvio({ ...pendiente, advertenciaMostrada: true });
    }
  }

  function cancelarEnvioPendiente() {
    envioPendienteRef.current = null;
    setAdvertenciaPendiente(null);
  }

  return {
    activo,
    nivel,
    bloquearPegado,
    propsDelCampo: activo
      ? { onPaste: manejadores.alPegar, onDrop: manejadores.alSoltar, onInput: manejadores.alEscribir }
      : {},
    advertenciaPendiente,
    intentarEnviar,
    confirmarEnvioPendiente,
    cancelarEnvioPendiente,
  };
}
