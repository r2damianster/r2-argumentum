import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { EVENTOS } from '../../eventos/nombresDeEventos.js';
import {
  MODOS_DE_AHORRO,
  PERFILES_DE_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_EL_MODO_MASIVO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO,
  describirElModoDeAhorro,
  normalizarModoDeAhorro,
  perfilDeAhorro,
  recomendarModoDeAhorro,
  resolverModoDeAhorro,
} from './modosDeAhorro.js';

describe('normalizarModoDeAhorro', () => {
  it('acepta los modos conocidos y lo demás vuelve a automático', () => {
    for (const modo of Object.values(MODOS_DE_AHORRO)) {
      expect(normalizarModoDeAhorro(modo)).toBe(modo);
    }
    expect(normalizarModoDeAhorro('inventado')).toBe('automatico');
    expect(normalizarModoDeAhorro(undefined)).toBe('automatico');
  });
});

describe('recomendarModoDeAhorro', () => {
  it('pequeña, moderada y ahorro según cuántas personas hay', () => {
    expect(recomendarModoDeAhorro(0)).toBe(MODOS_DE_AHORRO.PEQUENA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO - 1)).toBe(MODOS_DE_AHORRO.PEQUENA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO)).toBe(MODOS_DE_AHORRO.MODERADA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO - 1)).toBe(MODOS_DE_AHORRO.MODERADA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_AHORRO)).toBe(MODOS_DE_AHORRO.AHORRO);
    expect(recomendarModoDeAhorro(undefined)).toBe(MODOS_DE_AHORRO.PEQUENA);
  });

  it('el modo automático nunca elige el masivo: el ingreso ya ocurrió en la sala de espera', () => {
    expect(recomendarModoDeAhorro(5000)).toBe(MODOS_DE_AHORRO.AHORRO);
  });
});

describe('resolverModoDeAhorro', () => {
  it('un Programa sin el campo conserva el comportamiento de siempre (sala pequeña)', () => {
    expect(resolverModoDeAhorro({ programa: {}, estado: { sesion: {} } })).toBe('pequena');
    expect(resolverModoDeAhorro()).toBe('pequena');
  });

  it('un modo concreto elegido por el docente manda, aunque el host haya fijado otro', () => {
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'moderada' }, estado: { sesion: { modoDeAhorro: 'pequena' } } })).toBe('moderada');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'masivo' }, estado: { sesion: {} } })).toBe('masivo');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'ahorro' }, estado: { sesion: { modoDeAhorro: 'pequena' } } })).toBe('ahorro');
  });

  it('en automático rige lo que fijó el host al iniciar; antes de iniciar, sala pequeña', () => {
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: 'ahorro' } } })).toBe('ahorro');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: null } } })).toBe('pequena');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: 'automatico' } } })).toBe('pequena');
  });
});

describe('perfiles de ahorro', () => {
  it('sala pequeña: todo suelto e inmediato, IA sugiere sola con razonamiento normal', () => {
    expect(PERFILES_DE_AHORRO.pequena).toEqual({
      avisoDeEntregas: 'individual',
      avisosDeLaLectura: 'sueltos',
      ingreso: 'publico',
      sugerenciasDeLaIA: 'automaticas',
      razonamientoDeGroq: 'normal',
      consultarReplicasCortasALaIA: true,
      consultarReplicasALaIA: true,
      maximoDeConsultasALaIAPorAporte: 2,
    });
  });

  it('moderada: entregas en lote, razonamiento bajo y réplicas cortas sin IA; lo demás como la pequeña', () => {
    expect(PERFILES_DE_AHORRO.moderada).toMatchObject({
      avisoDeEntregas: 'lote',
      avisosDeLaLectura: 'sueltos',
      ingreso: 'publico',
      sugerenciasDeLaIA: 'automaticas',
      razonamientoDeGroq: 'bajo',
      consultarReplicasCortasALaIA: false,
      consultarReplicasALaIA: true,
      maximoDeConsultasALaIAPorAporte: 2,
    });
  });

  it('ahorro: todo en lote, la IA solo a pedido y en el foro una consulta por aporte y ninguna por réplicas', () => {
    expect(PERFILES_DE_AHORRO.ahorro).toMatchObject({
      avisoDeEntregas: 'lote',
      avisosDeLaLectura: 'lote',
      ingreso: 'publico',
      sugerenciasDeLaIA: 'por_demanda',
      consultarReplicasALaIA: false,
      maximoDeConsultasALaIAPorAporte: 1,
    });
  });

  it('masivo: igual que ahorro, pero el ingreso va por el canal privado (sin presencia ni nada en la sala)', () => {
    expect(PERFILES_DE_AHORRO.masivo).toMatchObject({ ...PERFILES_DE_AHORRO.ahorro, ingreso: 'privado' });
  });

  it('perfilDeAhorro toma el modo vigente de la sesión', () => {
    expect(perfilDeAhorro({ programa: { modoDeAhorro: 'masivo' } })).toBe(PERFILES_DE_AHORRO.masivo);
    expect(perfilDeAhorro({ programa: {} })).toBe(PERFILES_DE_AHORRO.pequena);
  });
});

describe('describirElModoDeAhorro', () => {
  it('el debate hablado no usa el modo: no se dice nada', () => {
    expect(describirElModoDeAhorro({ programa: {}, conectados: 80 })).toBeNull();
  });

  it('en automático explica qué se usaría con los conectados de ahora', () => {
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: 20 }).texto).toContain('Sala pequeña');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: 80 }).texto).toContain('Sala grande (moderado)');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: 150 }).texto).toContain('Sala grande (ahorro)');
  });

  it('con un modo fijo que no corresponde al tamaño de la sala avisa que conviene cambiarlo', () => {
    const aviso = describirElModoDeAhorro({ programa: { modoDeAhorro: 'pequena' }, conectados: 120 });
    expect(aviso.conviene).toBe(true);
    expect(aviso.texto).toContain('Volver a configuración');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'ahorro' }, conectados: 120 }).conviene).toBe(false);
  });

  it('con muchísimas personas recomienda el modo masivo, y no lo discute si ya está elegido', () => {
    const muchas = PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_EL_MODO_MASIVO;
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: muchas }).texto).toContain('Sala masiva');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'ahorro' }, conectados: muchas }).conviene).toBe(true);
    const yaMasivo = describirElModoDeAhorro({ programa: { modoDeAhorro: 'masivo' }, conectados: muchas });
    expect(yaMasivo.conviene).toBe(false);
    expect(yaMasivo.texto).not.toContain('conviene');
  });
});

describe('el modo fijado por el host en el estado de la sesión', () => {
  const fijar = (estado, modo, clientId) => reducirEventos(estado, { name: EVENTOS.MODO_DE_AHORRO_FIJADO, data: { modo }, ...(clientId ? { clientId } : {}) });

  it('lo fija el host y el primero que llega es el que rige', () => {
    let estado = fijar(estadoInicial(), 'moderada', 'host');
    expect(estado.sesion.modoDeAhorro).toBe('moderada');
    estado = fijar(estado, 'pequena', 'host');
    expect(estado.sesion.modoDeAhorro).toBe('moderada');
  });

  it('un participante no puede fijarlo ni se acepta un modo inválido', () => {
    expect(fijar(estadoInicial(), 'moderada', 'ana').sesion.modoDeAhorro).toBeNull();
    expect(fijar(estadoInicial(), 'automatico', 'host').sesion.modoDeAhorro).toBeNull();
    expect(fijar(estadoInicial(), 'inventado', 'host').sesion.modoDeAhorro).toBeNull();
  });

  it('con el Programa en automático el modo efectivo sale del estado', () => {
    const estado = fijar(estadoInicial(), 'ahorro', 'host');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado })).toBe('ahorro');
  });
});
