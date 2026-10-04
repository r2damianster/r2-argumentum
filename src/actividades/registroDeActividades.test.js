import { describe, expect, it } from 'vitest';
import { definirActividad } from './definirActividad.js';
import { PROGRAMAS_DE_EJEMPLO } from '../shared/programa/ejemplos/index.js';
import { cargarPrograma } from '../shared/programa/cargarPrograma.js';
import {
  ACTIVIDADES_REGISTRADAS,
  ID_DE_ACTIVIDAD_POR_DEFECTO,
  buscarActividadPorId,
  listarActividadesHabilitadas,
  resolverActividadDelPrograma,
} from './registroDeActividades.js';

describe('definirActividad', () => {
  const definicionMinima = {
    id: 'prueba',
    etiqueta: 'Prueba',
    descripcion: 'Actividad de prueba',
    crearProcesosDelMotor: () => ({}),
  };

  it('rellena los campos opcionales con valores por defecto', () => {
    const actividad = definirActividad(definicionMinima);
    expect(actividad.habilitada).toBe(true);
    expect(actividad.modulosQueUsa).toEqual([]);
    expect(actividad.tiposDeFase).toEqual([]);
    expect(actividad.reductorDeEventos).toBeNull();
  });

  it('rechaza una definición sin campos obligatorios', () => {
    expect(() => definirActividad({ id: 'sin-nombre' })).toThrow(/etiqueta/);
  });

  it('rechaza un motor que no es una función', () => {
    expect(() => definirActividad({ ...definicionMinima, crearProcesosDelMotor: {} })).toThrow(/función/);
  });

  it('devuelve una definición congelada: nadie la modifica en caliente', () => {
    const actividad = definirActividad(definicionMinima);
    expect(Object.isFrozen(actividad)).toBe(true);
  });
});

describe('registroDeActividades', () => {
  it('no repite identificadores', () => {
    const identificadores = ACTIVIDADES_REGISTRADAS.map((actividad) => actividad.id);
    expect(new Set(identificadores).size).toBe(identificadores.length);
  });

  it('todas las actividades registradas cumplen el contrato', () => {
    for (const actividad of ACTIVIDADES_REGISTRADAS) {
      expect(typeof actividad.crearProcesosDelMotor).toBe('function');
      expect(actividad.etiqueta).toBeTruthy();
    }
  });

  it('un Programa sin actividad es un debate hablado, como todos los anteriores', () => {
    expect(resolverActividadDelPrograma({}).id).toBe(ID_DE_ACTIVIDAD_POR_DEFECTO);
    expect(resolverActividadDelPrograma(null).id).toBe('debate_hablado');
  });

  it('una actividad desconocida cae en la actividad por defecto en vez de romper la sesión', () => {
    expect(resolverActividadDelPrograma({ actividad: 'no_existe' }).id).toBe('debate_hablado');
  });

  it('encuentra una actividad por su id', () => {
    expect(buscarActividadPorId('debate_hablado')?.etiqueta).toBe('Debate hablado');
    expect(buscarActividadPorId('no_existe')).toBeNull();
  });

  it('solo ofrece al moderador las actividades habilitadas', () => {
    const habilitadas = listarActividadesHabilitadas();
    expect(habilitadas.length).toBeGreaterThan(0);
    expect(habilitadas.every((actividad) => actividad.habilitada)).toBe(true);
  });
});

describe('procesos del debate hablado', () => {
  it('exponen los ganchos y las acciones que usa la consola del host', () => {
    const procesos = resolverActividadDelPrograma({}).crearProcesosDelMotor({
      programa: { fases: [], posturas: [] },
      obtenerContexto: () => ({ estado: null, presencia: [], publicar: () => {} }),
      parametrosDePuntajeVigentes: () => ({ valoresBasePosicion: [10, 8, 3] }),
      yaSeHizo: () => false,
      comenzarAccion: () => () => {},
      estaCerrada: () => false,
      generarId: (prefijo) => `${prefijo}-1`,
      crearAcumuladorDePuntaje: () => () => 0,
    });

    expect(typeof procesos.alSincronizarAntesDelPuntaje).toBe('function');
    expect(typeof procesos.alSincronizarDespuesDelPuntaje).toBe('function');
    expect(Object.keys(procesos.acciones).sort()).toEqual(
      ['cerrarTopicoDeBids', 'decidirBid', 'pausarRuleta', 'reanudarRuleta', 'terminarTurnoEnCurso'].sort()
    );
    procesos.destruir();
  });

  it('el puntaje provisional de un argumento sale de su posición y ronda', () => {
    const procesos = resolverActividadDelPrograma({}).crearProcesosDelMotor({
      programa: { fases: [], posturas: [] },
      obtenerContexto: () => ({ estado: null, presencia: [], publicar: () => {} }),
      parametrosDePuntajeVigentes: () => ({
        valoresBasePosicion: [10, 8, 3],
        descuentoRonda2: 0.7,
        descuentoViaCoModerador: 0.5,
      }),
      yaSeHizo: () => false,
      comenzarAccion: () => () => {},
      estaCerrada: () => false,
      generarId: (prefijo) => `${prefijo}-1`,
      crearAcumuladorDePuntaje: () => () => 0,
    });

    expect(procesos.calcularPuntajeProvisional({ posicionEnRonda: 2, ronda: 1, viaCoModerador: false })).toEqual({
      delta: 8,
      motivo: 'Argumento posición 2, ronda 1',
    });
    procesos.destruir();
  });
});

describe('Programas de ejemplo', () => {
  it('cada uno es válido y solo usa fases que su actividad entiende', () => {
    for (const programa of PROGRAMAS_DE_EJEMPLO) {
      expect(() => cargarPrograma(JSON.stringify(programa)), programa.programId).not.toThrow();
      const actividad = resolverActividadDelPrograma(programa);
      for (const fase of programa.fases) {
        expect(actividad.tiposDeFase, `${programa.programId}: fase ${fase.tipo}`).toContain(fase.tipo);
      }
    }
  });

  it('los foros declaran su actividad y una duración total en la fase de escritura', () => {
    const foros = PROGRAMAS_DE_EJEMPLO.filter((programa) => programa.actividad === 'foro_escrito');
    expect(foros.length).toBeGreaterThan(0);
    for (const foro of foros) {
      const faseDelForo = foro.fases.find((fase) => fase.tipo === 'foro_escrito');
      expect(faseDelForo?.duracionMin, foro.programId).toBeGreaterThan(0);
    }
  });

  it('no repiten identificador de Programa', () => {
    const identificadores = PROGRAMAS_DE_EJEMPLO.map((programa) => programa.programId);
    expect(new Set(identificadores).size).toBe(identificadores.length);
  });
});
