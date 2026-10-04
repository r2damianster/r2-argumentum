import { definirActividad } from '../definirActividad.js';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { crearProcesosDelDebateHablado } from './motorDelDebateHablado.js';

export const ID_DEBATE_HABLADO = 'debate_hablado';

export const debateHablado = definirActividad({
  id: ID_DEBATE_HABLADO,
  etiqueta: 'Debate hablado',
  descripcion:
    'Se debate en voz alta por turnos: cada quien escribe su argumento, la ruleta le da la palabra para exponerlo y los co-moderadores califican la exposición.',
  icono: '🎙️',
  modulosQueUsa: ['coModeracion', 'revision', 'puntaje'],
  tiposDeFase: [
    TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS,
    TIPOS_DE_FASE.CONEXION_SUGERIDA,
    TIPOS_DE_FASE.CONEXION_LIBRE,
    TIPOS_DE_FASE.CIERRE_Y_RANKING,
  ],
  crearProcesosDelMotor: crearProcesosDelDebateHablado,
});
