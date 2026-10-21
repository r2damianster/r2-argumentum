import { definirActividad } from '../definirActividad.js';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { crearProcesosDelDebateHablado } from '../debateHablado/motorDelDebateHablado.js';
import { ID_EXPOSICION_DE_POSTURAS } from './reglasDeLaExposicion.js';

export { ID_EXPOSICION_DE_POSTURAS };

// Versión ligera del debate hablado: reutiliza el mismo motor (ruleta, exposición, co-moderación,
// puntaje), pero con una sola fase de turnos y sin conexiones entre argumentos. Cada quien expone
// su postura; nadie rebate a nadie. Ver docs/04-roles-y-turnos.md.
export const exposicionDePosturas = definirActividad({
  id: ID_EXPOSICION_DE_POSTURAS,
  etiqueta: 'Exposición de posturas',
  descripcion:
    'Versión ligera del debate hablado: una sola fase en la que cada quien expone en voz alta su propia postura. No se argumenta contra nadie ni se conectan argumentos.',
  icono: '🗣️',
  descripcionDelPrograma:
    'Un Programa de exposición de posturas trae el tema, las posturas posibles y una sola fase de turnos más el cierre.',
  modulosQueUsa: ['coModeracion', 'revision', 'puntaje', 'patronesDeEscritura'],
  tiposDeFase: [TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS, TIPOS_DE_FASE.CIERRE_Y_RANKING],
  crearProcesosDelMotor: crearProcesosDelDebateHablado,
});
