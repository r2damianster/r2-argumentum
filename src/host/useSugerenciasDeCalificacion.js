import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTOS_PRIVADOS } from '../shared/nucleo/entregas/canalesPrivados.js';
import { solicitarSugerenciaDeCalificacion } from '../shared/nucleo/sugerenciaDeIA/solicitarSugerenciaDeCalificacion.js';
import {
  ESPERA_ENTRE_INTENTOS_MS,
  MAXIMO_DE_INTENTOS_AUTOMATICOS,
  calcularPausaPorLimite,
  elegirConsultasPendientes,
} from '../shared/nucleo/sugerenciaDeIA/colaDeConsultas.js';

// Pide a Groq la sugerencia de cada entrega a medida que llega (en cola, pocas a la vez) y la guarda en
// el canal privado del docente. Groq solo sugiere y el estudiante nunca la ve (docs/14-control-de-lectura.md).
//
// Devuelve `estados`: por entrega, 'en_curso', 'en_espera' (la IA alcanzó su límite por minuto: la cola se pausa y
// sigue sola) o 'fallo'. Un fallo no bloquea nada: el docente califica
// a mano o pide la sugerencia con «Reintentar».
export function useSugerenciasDeCalificacion({ activo, cola, programa, rubrica, publicarComoDocente, razonamiento = 'normal' }) {
  const [estados, setEstados] = useState({});
  const [reintentoManual, setReintentoManual] = useState(0);
  const enCurso = useRef(new Set());
  const intentos = useRef({});
  const ultimoIntento = useRef({});
  const pausadoHasta = useRef(0);

  const marcar = useCallback((participantId, valor) => {
    setEstados((previos) => {
      const siguientes = { ...previos };
      if (valor === null) {
        delete siguientes[participantId];
      } else {
        siguientes[participantId] = valor;
      }
      return siguientes;
    });
  }, []);

  async function consultar(item) {
    enCurso.current.add(item.participantId);
    intentos.current[item.participantId] = (intentos.current[item.participantId] ?? 0) + 1;
    ultimoIntento.current[item.participantId] = Date.now();
    marcar(item.participantId, 'en_curso');

    const respuesta = await solicitarSugerenciaDeCalificacion({ texto: item.texto, programa, rubrica, razonamiento });
    try {
      if (respuesta.fallo && respuesta.reintentarEnMs) {
        // Límite por minuto de Groq: no es un fallo de esta entrega. Se pausa toda la cola y se vuelve a intentar sola.
        intentos.current[item.participantId] = Math.max(0, (intentos.current[item.participantId] ?? 1) - 1);
        pausadoHasta.current = Date.now() + calcularPausaPorLimite(respuesta.reintentarEnMs);
        marcar(item.participantId, 'en_espera');
        return;
      }
      if (respuesta.fallo) {
        marcar(item.participantId, 'fallo');
        return;
      }
      await publicarComoDocente(EVENTOS_PRIVADOS.SUGERENCIA_DE_IA, {
        participantId: item.participantId,
        sugerencia: respuesta.sugerencia,
        omitida: respuesta.sugerencia ? null : (respuesta.motivo ?? 'sin_sugerencia'),
      });
      marcar(item.participantId, null);
    } catch {
      marcar(item.participantId, 'fallo');
    } finally {
      enCurso.current.delete(item.participantId);
    }
  }

  useEffect(() => {
    if (!activo) {
      return undefined;
    }
    const pendientes = elegirConsultasPendientes({
      cola,
      enCurso: enCurso.current,
      intentos: intentos.current,
      ultimoIntento: ultimoIntento.current,
      pausadoHasta: pausadoHasta.current,
    });
    pendientes.forEach((item) => {
      consultar(item);
    });

    // En pausa por el límite de Groq: se vuelve a mirar cuando termine la pausa.
    const pausaRestante = pausadoHasta.current - Date.now();
    if (pausaRestante > 0) {
      const temporizadorDePausa = setTimeout(() => setReintentoManual((veces) => veces + 1), pausaRestante + 250);
      return () => clearTimeout(temporizadorDePausa);
    }

    // Un fallo necesita que alguien vuelva a mirar cuando pase la espera: no hay otro evento que lo haga.
    // Si ya se agotaron los intentos automáticos, queda para «Reintentar» y no se vuelve a mirar solo.
    const hayFallosEnEspera = Object.entries(intentos.current).some(
      ([participantId, hechos]) =>
        hechos < MAXIMO_DE_INTENTOS_AUTOMATICOS &&
        !enCurso.current.has(participantId) &&
        cola.some((item) => item.participantId === participantId && !item.sugerenciaConsultada)
    );
    if (!hayFallosEnEspera) {
      return undefined;
    }
    const temporizador = setTimeout(() => setReintentoManual((veces) => veces + 1), ESPERA_ENTRE_INTENTOS_MS + 500);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, cola, estados, reintentoManual]);

  // «Reintentar»: borra el conteo de intentos de esa entrega y vuelve a mirar.
  function reintentar(participantId) {
    delete intentos.current[participantId];
    delete ultimoIntento.current[participantId];
    pausadoHasta.current = 0;
    marcar(participantId, null);
    setReintentoManual((veces) => veces + 1);
  }

  return { estados, reintentar };
}
