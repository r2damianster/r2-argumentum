import { useEffect, useState } from 'react';
import { obtenerCanalDeDevolucionDeMiCliente, obtenerClienteAbly } from '../shared/ably/clienteAbly.js';
import { EVENTOS_PRIVADOS } from '../shared/nucleo/entregas/canalesPrivados.js';

// Lo que el docente le manda en privado a esta persona (control de lectura): la devolución de su texto
// (comentarios por criterio y un comentario general, NUNCA la nota), los textos de los pares que le toca
// revisar (sin el autor) y, al final, cómo le fue como revisor. Todo llega por un canal que solo esta
// persona puede leer (su token solo abre `debate:devolucion:{su id}:{sala}`, ver api/ably-token.js) y que
// conserva historial: quien se desconecta y vuelve lo recupera. Ver docs/14-control-de-lectura.md.
//
// De cada tipo de mensaje se queda con el más reciente.
export function useMensajesPrivadosDelEstudiante({ clientId, sessionId, activo }) {
  const [mensajes, setMensajes] = useState({ devolucion: null, revisionAsignada: null, resultadoDeRevision: null });

  useEffect(() => {
    if (!activo) {
      return undefined;
    }
    let cancelado = false;
    obtenerClienteAbly(clientId);
    const canal = obtenerCanalDeDevolucionDeMiCliente(clientId, sessionId);

    function aceptar(mensaje) {
      if (cancelado || mensaje.clientId !== 'host') {
        return;
      }
      const carga = mensaje.data ?? {};
      const llegadaEn = Number(mensaje.timestamp ?? 0);
      const reemplazarSiEsMasReciente = (clave, valor) =>
        setMensajes((previos) =>
          previos[clave] && previos[clave].llegadaEn > llegadaEn ? previos : { ...previos, [clave]: { ...valor, llegadaEn } }
        );

      if (mensaje.name === EVENTOS_PRIVADOS.DEVOLUCION_RECIBIDA) {
        reemplazarSiEsMasReciente('devolucion', {
          criterios: Array.isArray(carga.criterios) ? carga.criterios : [],
          comentarioGeneral: String(carga.comentarioGeneral ?? ''),
          revisionesDePares: Array.isArray(carga.revisionesDePares) ? carga.revisionesDePares : [],
          hasta: Number(carga.hasta) || null,
          revisada: Boolean(carga.revisada),
        });
      } else if (mensaje.name === EVENTOS_PRIVADOS.REVISION_ASIGNADA) {
        reemplazarSiEsMasReciente('revisionAsignada', {
          revisiones: Array.isArray(carga.revisiones)
            ? carga.revisiones.map((revision) => ({ indice: Number(revision.indice), texto: String(revision.texto ?? '') }))
            : [],
        });
      } else if (mensaje.name === EVENTOS_PRIVADOS.RESULTADO_DE_REVISION) {
        reemplazarSiEsMasReciente('resultadoDeRevision', {
          hechas: Number(carga.hechas) || 0,
          asignadas: Number(carga.asignadas) || 0,
          puntos: Number(carga.puntos) || 0,
          revisiones: Array.isArray(carga.revisiones) ? carga.revisiones : [],
        });
      }
    }

    async function conectar() {
      await canal.attach();
      canal.subscribe(aceptar);
      let pagina = await canal.history({ untilAttach: true });
      // eslint-disable-next-line no-constant-condition
      while (true) {
        pagina.items.forEach(aceptar);
        if (!pagina.hasNext()) {
          break;
        }
        pagina = await pagina.next();
      }
    }

    conectar().catch((error) => {
      console.warn('[r2-argumentum] no se pudieron leer tus mensajes privados', error);
    });

    return () => {
      cancelado = true;
      canal.unsubscribe(aceptar);
    };
  }, [clientId, sessionId, activo]);

  return mensajes;
}
