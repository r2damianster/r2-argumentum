// Registro de las actividades que la plataforma sabe ejecutar — ver docs/13-foro-escrito-y-nucleo-reutilizable.md.
//
// Agregar una actividad nueva es crear su carpeta en src/actividades/, definirla con
// `definirActividad` y sumarla a esta lista. El núcleo y el motor base no cambian.

import { debateHablado, ID_DEBATE_HABLADO } from './debateHablado/definicion.js';
import { foroEscrito } from './foroEscrito/definicion.js';

export const ACTIVIDADES_REGISTRADAS = [debateHablado, foroEscrito];

// Un Programa sin campo `actividad` (todos los anteriores a octubre de 2026) es un debate hablado.
export const ID_DE_ACTIVIDAD_POR_DEFECTO = ID_DEBATE_HABLADO;

export function buscarActividadPorId(idDeActividad) {
  return ACTIVIDADES_REGISTRADAS.find((actividad) => actividad.id === idDeActividad) ?? null;
}

export function resolverActividadDelPrograma(programa) {
  return buscarActividadPorId(programa?.actividad) ?? buscarActividadPorId(ID_DE_ACTIVIDAD_POR_DEFECTO);
}

export function listarActividadesHabilitadas() {
  return ACTIVIDADES_REGISTRADAS.filter((actividad) => actividad.habilitada);
}
