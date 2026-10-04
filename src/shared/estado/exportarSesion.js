// Export de sesión al cierre — ver campo `exportaJSON` del Programa (docs/03-programa-de-debate.md).
// No requiere servidor: cada cliente ya tiene el log completo por haber estado suscrito al canal.

import {
  calcularRankingPorPostura,
  calcularPodioIndividual,
  calcularPodioDePosturas,
  nombreDeParticipante,
} from './seleccionesDerivadas.js';
import { resolverParametrosDePuntaje } from '../puntaje/perfilesDePuntaje.js';
import { armarRevisionesDeCoModeradores } from '../puntaje/evaluacionDeExposiciones.js';
import { calcularDesgloseDePuntaje } from '../nucleo/informe/desgloseDePuntaje.js';
import { describirEvaluacionDeCoModeradores } from '../nucleo/informe/evaluacionDeCoModeradores.js';
import { resolverNivelDeIntegridad } from '../nucleo/integridad/nivelesDeIntegridad.js';
import { agruparSenalesPorParticipante } from '../nucleo/integridad/canalPrivado.js';
import { resolverActividadDelPrograma } from '../../actividades/registroDeActividades.js';
import { ID_FORO_ESCRITO } from '../../actividades/foroEscrito/definicion.js';
import { construirResumenDelForo } from '../../actividades/foroEscrito/informeDelForo.js';

const ESCALA_DE_REVISION_GENERICA = { minimo: 0, maximo: 1 };

// Cómo le fue a cada co-moderador. Cada actividad arma lo que revisó a su manera; el cálculo es el mismo.
export function calcularEvaluacionDeCoModeradores({ estado, programa, presencia = [] }) {
  const programaVigente = estado.programa ?? programa;
  const parametros = resolverParametrosDePuntaje(programaVigente);
  if (resolverActividadDelPrograma(programaVigente).id === ID_FORO_ESCRITO) {
    return construirResumenDelForo({ estado, parametros, presencia }).evaluacionDeCoModeradores;
  }
  return describirEvaluacionDeCoModeradores({
    revisiones: armarRevisionesDeCoModeradores(estado),
    escala: ESCALA_DE_REVISION_GENERICA,
    parametros,
    presencia,
  });
}

export function exportarSesion({ eventos, estado, programa, presencia = [] }) {
  const mapaArgumental = Object.values(estado.argumentos).map((argumento) => ({
    ...argumento,
    conexionesEntrantes: Object.values(estado.conexiones).filter(
      (conexion) => conexion.targetArgumentId === argumento.argumentId
    ),
  }));

  const podioIndividual = calcularPodioIndividual(estado, presencia);
  const podioColaborativoPorPostura = calcularPodioDePosturas(estado, programa, presencia);
  const actividad = resolverActividadDelPrograma(estado.programa ?? programa);
  const parametros = resolverParametrosDePuntaje(estado.programa ?? programa);

  const perfilPorEstudiante = Object.values(estado.participantes).map((participante) => {
    const presente = presencia.find((p) => p.participantId === participante.participantId);
    return {
      participantId: participante.participantId,
      nombre: presente?.nombre ?? participante.nombre ?? null,
      emoji: presente?.emoji ?? participante.emoji ?? null,
      rol: participante.rol,
      stanceId: participante.stanceId,
      puntajeTotal: participante.puntajeTotal ?? 0,
      argumentosEscritos: Object.values(estado.argumentos).filter(
        (argumento) => argumento.participantId === participante.participantId
      ).length,
      conexionesHechas: Object.values(estado.conexiones).filter(
        (conexion) => conexion.porParticipanteId === participante.participantId
      ).length,
    };
  });

  // De dónde sale cada punto (por persona), a partir de los score.updated del log.
  const desglosePorParticipante = Object.entries(calcularDesgloseDePuntaje(eventos)).map(([participantId, desglose]) => ({
    participantId,
    nombre: nombreDeParticipante(presencia, participantId),
    rol: estado.participantes[participantId]?.rol ?? null,
    ...desglose,
  }));

  const esForo = actividad.id === ID_FORO_ESCRITO;
  const resumenDelForo = esForo ? construirResumenDelForo({ estado, parametros, presencia }) : null;

  return {
    exportadoEn: new Date().toISOString(),
    // "parcial" si el moderador exporta con el debate todavía en curso (ranking hasta ese momento).
    estadoDeLaSesion: estado.sesion.cerrada ? 'cerrada' : 'parcial',
    actividad: actividad.id,
    programa: { programId: programa.programId, titulo: programa.titulo, version: programa.version },
    eventLogCompleto: eventos,
    mapaArgumental,
    // Calificaciones de las exposiciones orales (co-moderadores y decisión del moderador); los
    // ajustes de puntaje que produjeron quedan en el log como score.updated al cerrar la sesión.
    exposiciones: Object.values(estado.exposiciones ?? {}),
    podioIndividual,
    podioColaborativoPorPostura,
    rankingPorPostura: calcularRankingPorPostura(estado, programa, presencia),
    perfilPorEstudiante,
    desglosePorParticipante,
    // Qué tan bien revisaron los co-moderadores (porcentaje de acierto sobre el azar y esfuerzo).
    evaluacionDeCoModeradores: calcularEvaluacionDeCoModeradores({ estado, programa, presencia }),
    // Solo el foro escrito: participación, reacciones y la revisión aporte por aporte.
    ...(esForo ? { foro: resumenDelForo } : {}),
    // Solo el NIVEL: las marcas de integridad van en un archivo aparte (exportarAnexoDeIntegridad).
    integridad: { nivel: resolverNivelDeIntegridad(estado.programa ?? programa) },
  };
}

// Las señales de integridad son confidenciales y solo las ve el moderador: van en su propio archivo
// para que no viajen dentro del informe general, que se comparte o se proyecta con más facilidad.
export function exportarAnexoDeIntegridad({ registros, estado, programa, presencia = [] }) {
  return {
    exportadoEn: new Date().toISOString(),
    confidencial: true,
    advertencia:
      'Son señales que ayudan a revisar, no pruebas de nada: el dictado por voz, el autocorrector y el uso del celular pueden generarlas. Decide con criterio y conversa con la persona antes de actuar.',
    nivelDeIntegridad: resolverNivelDeIntegridad(estado.programa ?? programa),
    programa: { programId: programa.programId, titulo: programa.titulo },
    personas: agruparSenalesPorParticipante(registros).map((grupo) => ({
      participantId: grupo.participantId,
      nombre: nombreDeParticipante(presencia, grupo.participantId),
      gravedadMaxima: grupo.gravedadMaxima,
      registros: grupo.registros.map((registro) => ({
        ...registro,
        textoDelAporte: registro.argumentId ? estado.argumentos[registro.argumentId]?.texto ?? null : null,
      })),
    })),
  };
}

export function descargarComoJSON(objeto, nombreDeArchivo) {
  const contenido = JSON.stringify(objeto, null, 2);
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDeArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
