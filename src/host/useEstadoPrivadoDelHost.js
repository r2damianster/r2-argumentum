import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  obtenerCanalDeEntregas,
  obtenerCanalDelDocente,
  obtenerClienteAbly,
  publicarDevolucionDelHost,
} from '../shared/ably/clienteAbly.js';
import { publicarConReintentos } from '../shared/ably/reintentarPublicacion.js';
import { procesarMensajeDeEntrega, procesarMensajeDelDocente } from '../shared/nucleo/entregas/canalesPrivados.js';
import { reducirRegistrosPrivados } from '../shared/nucleo/entregas/estadoPrivadoDelDocente.js';

// Estado privado del docente en el control de lectura (ver docs/14-control-de-lectura.md): el texto de
// cada entrega, las confirmaciones con su motivo y las decisiones del propio docente. Se lee de dos
// canales que solo el host puede abrir (entregas y docente, ver api/ably-token.js).
//
// El historial de Ably dura poco: si el docente refresca la pestaña, lo anterior se recupera de la copia
// local de este navegador. Cada mensaje se valida antes de aceptarlo (lo publicó quien dice ser).

const VIDA_MAXIMA_DE_LA_COPIA_MS = 12 * 60 * 60 * 1000;

function claveDeLaCopia(sessionId) {
  return `r2-argumentum-lectura-privada:${sessionId}`;
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

async function recorrerHistorial(canal, alRecibir) {
  let pagina = await canal.history({ untilAttach: true });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pagina.items.forEach(alRecibir);
    if (!pagina.hasNext()) {
      break;
    }
    pagina = await pagina.next();
  }
}

export function useEstadoPrivadoDelHost({ sessionId, activo }) {
  const [registros, setRegistros] = useState(() => (activo ? leerCopiaLocal(sessionId) : []));

  useEffect(() => {
    if (!activo) {
      return undefined;
    }
    let cancelado = false;
    obtenerClienteAbly('host');
    const canalDeEntregas = obtenerCanalDeEntregas(sessionId);
    const canalDelDocente = obtenerCanalDelDocente(sessionId);

    function aceptar(procesar) {
      return (mensaje) => {
        const registro = procesar(mensaje);
        if (!registro || cancelado) {
          return;
        }
        setRegistros((previos) =>
          previos.some((previo) => previo.idDelMensaje === registro.idDelMensaje) ? previos : [...previos, registro]
        );
      };
    }
    const aceptarEntrega = aceptar(procesarMensajeDeEntrega);
    const aceptarDelDocente = aceptar(procesarMensajeDelDocente);

    async function conectar() {
      await Promise.all([canalDeEntregas.attach(), canalDelDocente.attach()]);
      canalDeEntregas.subscribe(aceptarEntrega);
      canalDelDocente.subscribe(aceptarDelDocente);
      await Promise.all([
        recorrerHistorial(canalDeEntregas, aceptarEntrega),
        recorrerHistorial(canalDelDocente, aceptarDelDocente),
      ]);
    }

    conectar().catch((error) => {
      console.warn('[r2-argumentum] no se pudieron leer los canales privados del control de lectura', error);
    });

    return () => {
      cancelado = true;
      canalDeEntregas.unsubscribe(aceptarEntrega);
      canalDelDocente.unsubscribe(aceptarDelDocente);
    };
  }, [sessionId, activo]);

  useEffect(() => {
    if (activo) {
      guardarCopiaLocal(sessionId, registros);
    }
  }, [sessionId, activo, registros]);

  // Las decisiones dependen del orden (la última calificación reemplaza a la anterior): se aplican
  // por la hora del servidor, no por el orden en que cada canal entregó su historial.
  const estadoPrivado = useMemo(
    () => reducirRegistrosPrivados([...registros].sort((registroA, registroB) => registroA.enviadoEn - registroB.enviadoEn)),
    [registros]
  );

  // Lo que decide el docente queda en su canal privado: es su estado y sobrevive a un refresco.
  const publicarComoDocente = useCallback(
    (nombreDelEvento, carga) => publicarConReintentos(() => obtenerCanalDelDocente(sessionId).publish(nombreDelEvento, carga)),
    [sessionId]
  );

  const enviarAlEstudiante = useCallback(
    (participantId, nombreDelEvento, carga) => publicarDevolucionDelHost(sessionId, participantId, nombreDelEvento, carga),
    [sessionId]
  );

  return { estadoPrivado, publicarComoDocente, enviarAlEstudiante };
}
