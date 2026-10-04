import { definirActividad } from '../definirActividad.js';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { crearProcesosDelForo } from './motorDelForo.js';

export const ID_FORO_ESCRITO = 'foro_escrito';

export const foroEscrito = definirActividad({
  id: ID_FORO_ESCRITO,
  etiqueta: 'Foro escrito',
  descripcion:
    'Nadie habla: la clase escribe posts y réplicas durante un tiempo total. Sin turnos; el moderador y los co-moderadores revisan lo escrito.',
  icono: '⌨️',
  modulosQueUsa: ['coModeracion', 'revision', 'conciencia', 'temporizador', 'reacciones', 'puntaje'],
  tiposDeFase: [TIPOS_DE_FASE.FORO_ESCRITO, TIPOS_DE_FASE.CIERRE_Y_RANKING],
  tiposDeFaseConTiempoTotal: [TIPOS_DE_FASE.FORO_ESCRITO],
  crearProcesosDelMotor: crearProcesosDelForo,
});
