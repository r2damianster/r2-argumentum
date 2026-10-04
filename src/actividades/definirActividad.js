// Contrato de una actividad — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Una actividad (debate hablado, foro escrito, las que vengan) es un paquete de LÓGICA que se arma con
// las piezas del núcleo (src/shared/nucleo/). No contiene pantallas: cada app (host y player) asocia
// el id de la actividad con sus componentes, así el código de estado no depende de React ni de la
// app donde se usa.
//
//   id                       identificador estable; es el valor del campo `actividad` del Programa
//   etiqueta, descripcion    lo que ve el moderador al elegir la actividad
//   icono                    emoji de la tarjeta de selección
//   modulosQueUsa            piezas del núcleo que la actividad compone (documentación viva)
//   tiposDeFase              tipos de fase que entiende (el Programa solo puede traer estos)
//   tiposDeFaseConTiempoTotal  fases que tienen una duración total (la cuenta atrás la lleva el motor)
//   crearProcesosDelMotor    (servicios) => {
//                              alSincronizarAntesDelPuntaje?, alSincronizarDespuesDelPuntaje?,
//                              calcularPuntajeProvisional(argumento, estado) → { delta, motivo } | null,
//                              calcularAjustesAlCierre(estado) → ajustes[],
//                              acciones?: { … métodos que el motor expone a la consola del host },
//                              destruir?
//                            }
//   reductorDeEventos?       (estado, evento) → estado | undefined; extiende el reducer con los
//                            eventos propios de la actividad (undefined = no lo reconoce)
//   habilitada               false mientras la actividad se construye: no se ofrece al moderador

const CAMPOS_OBLIGATORIOS = ['id', 'etiqueta', 'descripcion', 'crearProcesosDelMotor'];

export function definirActividad(definicion) {
  const camposFaltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !definicion?.[campo]);
  if (camposFaltantes.length > 0) {
    throw new Error(`Actividad inválida, faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
  }
  if (typeof definicion.crearProcesosDelMotor !== 'function') {
    throw new Error(`La actividad «${definicion.id}» necesita crearProcesosDelMotor como función.`);
  }

  return Object.freeze({
    icono: '',
    modulosQueUsa: [],
    tiposDeFase: [],
    tiposDeFaseConTiempoTotal: [],
    habilitada: true,
    reductorDeEventos: null,
    ...definicion,
  });
}
