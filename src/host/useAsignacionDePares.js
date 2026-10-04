import { useCallback, useEffect, useRef, useState } from 'react';
import { TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../shared/nucleo/entregas/canalesPrivados.js';
import { prepararTextosParaRevisar } from '../shared/nucleo/entregas/revisionesEntrePares.js';
import { asignarRevisionesEntrePares } from '../shared/nucleo/revisionEntrePares/asignarRevisionesEntrePares.js';

// Cuánto se espera a que lleguen los textos de todas las entregas antes de repartir sin los que faltan.
const ESPERA_MAXIMA_POR_LOS_TEXTOS_MS = 15 * 1000;

// Al empezar la fase de revisión entre pares, el host reparte quién revisa a quién (una sola vez, queda en
// su canal privado) y manda a cada revisor los textos que le tocan, SIN el autor. Ver docs/14.
export function useAsignacionDePares({ activo, estado, estadoPrivado, programa, publicarComoDocente, enviarAlEstudiante }) {
  const yaIntentado = useRef(false);
  const [error, setError] = useState('');
  const [reloj, setReloj] = useState(0);

  const enviarTextosAUnRevisor = useCallback(
    (revisorId, asignaciones, textos) =>
      enviarAlEstudiante(revisorId, EVENTOS_PRIVADOS.REVISION_ASIGNADA, {
        revisiones: prepararTextosParaRevisar({ estadoPrivado: { asignaciones, textos }, revisorId }),
      }),
    [enviarAlEstudiante]
  );

  useEffect(() => {
    const fase = estado.fase.actual;
    if (!activo || yaIntentado.current || estadoPrivado.asignaciones || fase?.tipo !== TIPOS_DE_FASE.REVISION_DE_PARES) {
      return undefined;
    }
    const autoresRegistrados = Object.keys(estado.lectura?.entregas ?? {});
    const conTexto = autoresRegistrados.filter((participantId) => estadoPrivado.textos[participantId]);
    const faltaAlgunTexto = conTexto.length < autoresRegistrados.length;
    const esperadoHastaAhora = Date.now() - (fase.iniciadaEn ?? Date.now());

    // Los textos llegan por otro canal que el aviso de entrega: se espera un poco a los que faltan.
    if (faltaAlgunTexto && esperadoHastaAhora < ESPERA_MAXIMA_POR_LOS_TEXTOS_MS) {
      const temporizador = setTimeout(() => setReloj((vez) => vez + 1), ESPERA_MAXIMA_POR_LOS_TEXTOS_MS - esperadoHastaAhora + 200);
      return () => clearTimeout(temporizador);
    }

    yaIntentado.current = true;
    const { asignaciones, revisionesPorPersona } = asignarRevisionesEntrePares({
      autoresIds: conTexto,
      revisionesPorPersona: programa.revisionDePares?.revisionesPorPersona,
    });
    (async () => {
      try {
        await publicarComoDocente(EVENTOS_PRIVADOS.ASIGNACION_DE_PARES, { asignaciones, revisionesPorPersona });
        for (const revisorId of Object.keys(asignaciones)) {
          await enviarTextosAUnRevisor(revisorId, asignaciones, estadoPrivado.textos);
        }
      } catch (fallo) {
        console.warn('[r2-argumentum] no se pudo repartir la revisión entre pares', fallo);
        setError('No se pudo repartir o enviar todos los textos. Pulsa «Reintentar el reparto» cuando vuelva la conexión.');
      }
    })();
    return undefined;
  }, [activo, estado.fase.actual, estado.lectura?.entregas, estadoPrivado.asignaciones, estadoPrivado.textos, programa, reloj, publicarComoDocente, enviarTextosAUnRevisor]);

  // Por si un envío falló o el docente refrescó la pestaña a mitad del reparto: si el reparto ya existe,
  // reenvía los textos a cada revisor (el canal de cada uno guarda solo el más reciente); si no, lo hace.
  async function reintentarElReparto() {
    setError('');
    if (!estadoPrivado.asignaciones) {
      yaIntentado.current = false;
      setReloj((vez) => vez + 1);
      return;
    }
    try {
      for (const revisorId of Object.keys(estadoPrivado.asignaciones)) {
        await enviarTextosAUnRevisor(revisorId, estadoPrivado.asignaciones, estadoPrivado.textos);
      }
    } catch (fallo) {
      console.warn('[r2-argumentum] no se pudieron reenviar los textos', fallo);
      setError('No se pudieron reenviar los textos. Revisa la conexión.');
    }
  }

  return { errorDeLaAsignacion: error, reintentarElReparto };
}
