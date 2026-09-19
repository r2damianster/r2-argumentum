// Export de sesión al cierre — ver campo `exportaJSON` del Programa (docs/03-programa-de-debate.md).
// No requiere servidor: cada cliente ya tiene el log completo por haber estado suscrito al canal.

import { calcularRankingPorPostura } from './seleccionesDerivadas.js';

export function exportarSesion({ eventos, estado, programa, presencia = [] }) {
  const mapaArgumental = Object.values(estado.argumentos).map((argumento) => ({
    ...argumento,
    conexionesEntrantes: Object.values(estado.conexiones).filter(
      (conexion) => conexion.targetArgumentId === argumento.argumentId
    ),
  }));

  const perfilPorEstudiante = Object.values(estado.participantes).map((participante) => {
    const presente = presencia.find((p) => p.participantId === participante.participantId);
    return {
      participantId: participante.participantId,
      nombre: presente?.nombre ?? null,
      emoji: presente?.emoji ?? null,
      rol: participante.rol,
      stanceId: participante.stanceId,
      puntajeTotal: participante.puntajeTotal,
      argumentosEscritos: Object.values(estado.argumentos).filter(
        (argumento) => argumento.participantId === participante.participantId
      ).length,
      conexionesHechas: Object.values(estado.conexiones).filter(
        (conexion) => conexion.porParticipanteId === participante.participantId
      ).length,
    };
  });

  return {
    exportadoEn: new Date().toISOString(),
    // "parcial" si el moderador exporta con el debate todavía en curso (ranking hasta ese momento).
    estadoDeLaSesion: estado.sesion.cerrada ? 'cerrada' : 'parcial',
    programa: { programId: programa.programId, titulo: programa.titulo, version: programa.version },
    eventLogCompleto: eventos,
    mapaArgumental,
    rankingPorPostura: calcularRankingPorPostura(estado, programa, presencia),
    perfilPorEstudiante,
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
