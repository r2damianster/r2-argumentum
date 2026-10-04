import { useEffect, useState } from 'react';
import { obtenerCanalDeIntegridad, obtenerClienteAbly } from '../shared/ably/clienteAbly.js';
import { procesarMensajeDeIntegridad } from '../shared/nucleo/integridad/canalPrivado.js';

// Recibe las señales de integridad que publican los participantes en el canal privado (solo el host
// puede leerlo, ver api/ably-token.js). Con la integridad apagada no se conecta a nada.
//
// El historial de Ably dura poco: si el moderador refresca la pestaña, las marcas viejas se
// recuperan de la copia local de este navegador. Cada mensaje se valida antes de aceptarlo (debe
// haberlo publicado quien dice ser).

const VIDA_MAXIMA_DE_LA_COPIA_MS = 12 * 60 * 60 * 1000;

function claveDeLaCopia(sessionId) {
  return `r2-argumentum-integridad:${sessionId}`;
}

function leerCopiaLocal(sessionId) {
  try {
    const guardada = JSON.parse(localStorage.getItem(claveDeLaCopia(sessionId)) || 'null');
    if (guardada && Date.now() - (guardada.guardadaEn ?? 0) < VIDA_MAXIMA_DE_LA_COPIA_MS) {
      return Array.isArray(guardada.registros) ? guardada.registros : [];
    }
  } catch {
    // Sin copia local o dañada: se empieza de cero.
  }
  return [];
}

function guardarCopiaLocal(sessionId, registros) {
  try {
    localStorage.setItem(claveDeLaCopia(sessionId), JSON.stringify({ guardadaEn: Date.now(), registros }));
  } catch {
    // Sin localStorage la copia simplemente no sobrevive a un refresco.
  }
}

export function useSenalesDeIntegridadDelHost({ sessionId, activo }) {
  const [registros, setRegistros] = useState(() => (activo ? leerCopiaLocal(sessionId) : []));

  useEffect(() => {
    if (!activo) {
      return undefined;
    }
    let cancelado = false;
    obtenerClienteAbly('host');
    const canal = obtenerCanalDeIntegridad(sessionId);

    function aceptar(mensaje) {
      const registro = procesarMensajeDeIntegridad(mensaje);
      if (!registro || cancelado) {
        return;
      }
      setRegistros((previos) =>
        previos.some((previo) => previo.idDelMensaje === registro.idDelMensaje) ? previos : [...previos, registro]
      );
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
      console.warn('[r2-argumentum] no se pudo leer el canal de integridad', error);
    });

    return () => {
      cancelado = true;
      canal.unsubscribe(aceptar);
    };
  }, [sessionId, activo]);

  useEffect(() => {
    if (activo) {
      guardarCopiaLocal(sessionId, registros);
    }
  }, [sessionId, activo, registros]);

  return { registros };
}
