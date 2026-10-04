import { definirActividad } from '../definirActividad.js';
import { TIPOS_DE_FASE } from '../../shared/eventos/nombresDeEventos.js';
import { crearProcesosDelControlDeLectura } from './motorDelControlDeLectura.js';
import { ID_CONTROL_DE_LECTURA } from './programaDeLectura.js';

export { ID_CONTROL_DE_LECTURA };

export const controlDeLectura = definirActividad({
  id: ID_CONTROL_DE_LECTURA,
  etiqueta: 'Control de lectura',
  descripcion:
    'Cada estudiante escribe, a solas y en su celular, un texto sobre la lectura que hizo antes. El docente califica con una rúbrica y devuelve comentarios; opcionalmente se revisan entre pares.',
  icono: '📖',
  modulosQueUsa: ['temporizador', 'rubrica', 'escritura', 'entregas', 'podio'],
  tiposDeFase: [TIPOS_DE_FASE.CONTROL_DE_LECTURA, TIPOS_DE_FASE.REVISION_DE_PARES, TIPOS_DE_FASE.CIERRE_Y_RANKING],
  tiposDeFaseConTiempoTotal: [TIPOS_DE_FASE.CONTROL_DE_LECTURA, TIPOS_DE_FASE.REVISION_DE_PARES],
  crearProcesosDelMotor: crearProcesosDelControlDeLectura,
});
