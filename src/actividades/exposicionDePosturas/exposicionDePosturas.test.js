import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../shared/estado/reducirEventos.js';
import { EVENTOS } from '../../shared/eventos/nombresDeEventos.js';
import { calcularInstruccionesDelParticipante } from '../../shared/instrucciones/calcularInstrucciones.js';
import { PROGRAMAS_DE_EJEMPLO } from '../../shared/programa/ejemplos/index.js';
import { buscarActividadPorId, resolverActividadDelPrograma } from '../registroDeActividades.js';
import {
  ID_EXPOSICION_DE_POSTURAS,
  esExposicionDePosturas,
  posicionesQueSePuedenCompletar,
} from './reglasDeLaExposicion.js';

const PRESENCIA = [{ participantId: 'ana', nombre: 'Ana', conectado: true }];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

// Ana ya expuso su postura de ingreso: completó la posición 1 y no tiene argumento esperando turno.
function estadoConPosturaExpuesta(actividad) {
  const programa = {
    titulo: 'Prueba',
    actividad,
    posturas: [
      { id: 'a_favor', etiqueta: 'A favor' },
      { id: 'en_contra', etiqueta: 'En contra' },
    ],
    perfilDePuntaje: 'estandar',
  };
  return [
    evento(EVENTOS.PROGRAMA_PUBLICADO, { programa }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'a_favor' }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      participantId: 'ana',
      argumentId: 'arg-ana',
      texto: 'Estoy a favor porque ya está en el celular de todos.',
      stanceId: 'a_favor',
      posicionEnRonda: 1,
      ronda: 1,
      esArgumentoDeIngreso: true,
    }),
  ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), estadoInicial());
}

describe('actividad «exposición de posturas»', () => {
  it('está registrada y reconoce los Programas que la declaran', () => {
    expect(buscarActividadPorId(ID_EXPOSICION_DE_POSTURAS)?.etiqueta).toBe('Exposición de posturas');
    expect(resolverActividadDelPrograma({ actividad: ID_EXPOSICION_DE_POSTURAS }).id).toBe(ID_EXPOSICION_DE_POSTURAS);
    expect(esExposicionDePosturas({ actividad: ID_EXPOSICION_DE_POSTURAS })).toBe(true);
    expect(esExposicionDePosturas({})).toBe(false);
  });

  it('solo entiende una fase de turnos y el cierre: sin conexiones ni segunda ronda', () => {
    const { tiposDeFase } = buscarActividadPorId(ID_EXPOSICION_DE_POSTURAS);
    expect(tiposDeFase).toEqual(['escritura_argumentos', 'cierre_y_ranking']);
  });

  it('los Programas de ejemplo de la actividad usan solo fases que entiende y una sola fase de turnos', () => {
    const { tiposDeFase } = buscarActividadPorId(ID_EXPOSICION_DE_POSTURAS);
    const programas = PROGRAMAS_DE_EJEMPLO.filter((programa) => esExposicionDePosturas(programa));
    expect(programas.length).toBeGreaterThan(0);
    for (const programa of programas) {
      expect(programa.fases.every((fase) => tiposDeFase.includes(fase.tipo))).toBe(true);
      expect(programa.fases.filter((fase) => fase.tipo === 'escritura_argumentos')).toHaveLength(1);
    }
  });

  it('solo cuenta una posición por persona, sin pasar de las que tiene el perfil', () => {
    const programa = { actividad: ID_EXPOSICION_DE_POSTURAS };
    expect(posicionesQueSePuedenCompletar(programa, 3)).toBe(1);
    expect(posicionesQueSePuedenCompletar(programa, 0)).toBe(0);
    expect(posicionesQueSePuedenCompletar({}, 3)).toBe(3);
  });

  it('tras exponer su postura no le pide preparar otro argumento', () => {
    const estado = estadoConPosturaExpuesta(ID_EXPOSICION_DE_POSTURAS);
    const estadoSinListo = {
      ...estado,
      participantes: { ...estado.participantes, ana: { ...estado.participantes.ana, argumentoListo: false } },
    };
    expect(calcularInstruccionesDelParticipante(estadoSinListo, 'ana', PRESENCIA).tienesQue).toBeNull();
  });

  it('en el debate hablado completo, en cambio, sí le pide preparar el siguiente', () => {
    const estado = estadoConPosturaExpuesta(undefined);
    const estadoSinListo = {
      ...estado,
      participantes: { ...estado.participantes, ana: { ...estado.participantes.ana, argumentoListo: false } },
    };
    expect(calcularInstruccionesDelParticipante(estadoSinListo, 'ana', PRESENCIA).tienesQue?.texto).toContain('Prepara');
  });

  it('con su postura lista solo puede esperar su turno: no ofrece bids ni conexiones', () => {
    const estado = estadoConPosturaExpuesta(ID_EXPOSICION_DE_POSTURAS);
    const estadoConListo = {
      ...estado,
      participantes: { ...estado.participantes, ana: { ...estado.participantes.ana, argumentoListo: true } },
    };
    const { puedes } = calcularInstruccionesDelParticipante(estadoConListo, 'ana', PRESENCIA);
    expect(puedes).toEqual(['Esperar tu turno: tu postura ya está lista']);
  });
});
