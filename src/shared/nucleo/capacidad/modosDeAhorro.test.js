import { describe, expect, it } from 'vitest';
import { estadoInicial, reducirEventos } from '../../estado/reducirEventos.js';
import { EVENTOS } from '../../eventos/nombresDeEventos.js';
import {
  MODOS_DE_AHORRO,
  PERFILES_DE_AHORRO,
  PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO,
  describirElModoDeAhorro,
  normalizarModoDeAhorro,
  perfilDeAhorro,
  recomendarModoDeAhorro,
  resolverModoDeAhorro,
} from './modosDeAhorro.js';

describe('normalizarModoDeAhorro', () => {
  it('acepta los modos conocidos y lo demás vuelve a automático', () => {
    expect(normalizarModoDeAhorro('pequena')).toBe('pequena');
    expect(normalizarModoDeAhorro('moderada')).toBe('moderada');
    expect(normalizarModoDeAhorro('automatico')).toBe('automatico');
    expect(normalizarModoDeAhorro('inventado')).toBe('automatico');
    expect(normalizarModoDeAhorro(undefined)).toBe('automatico');
  });
});

describe('recomendarModoDeAhorro', () => {
  it('sala pequeña por debajo del umbral y moderada desde él', () => {
    expect(recomendarModoDeAhorro(0)).toBe(MODOS_DE_AHORRO.PEQUENA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO - 1)).toBe(MODOS_DE_AHORRO.PEQUENA);
    expect(recomendarModoDeAhorro(PERSONAS_DESDE_LAS_QUE_SE_USA_EL_MODO_MODERADO)).toBe(MODOS_DE_AHORRO.MODERADA);
    expect(recomendarModoDeAhorro(200)).toBe(MODOS_DE_AHORRO.MODERADA);
    expect(recomendarModoDeAhorro(undefined)).toBe(MODOS_DE_AHORRO.PEQUENA);
  });
});

describe('resolverModoDeAhorro', () => {
  it('un Programa sin el campo conserva el comportamiento de siempre (sala pequeña)', () => {
    expect(resolverModoDeAhorro({ programa: {}, estado: { sesion: {} } })).toBe('pequena');
    expect(resolverModoDeAhorro()).toBe('pequena');
  });

  it('un modo concreto elegido por el docente manda, aunque el host haya fijado otro', () => {
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'moderada' }, estado: { sesion: { modoDeAhorro: 'pequena' } } })).toBe('moderada');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'pequena' }, estado: { sesion: { modoDeAhorro: 'moderada' } } })).toBe('pequena');
  });

  it('en automático rige lo que fijó el host al iniciar; antes de iniciar, sala pequeña', () => {
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: 'moderada' } } })).toBe('moderada');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: null } } })).toBe('pequena');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado: { sesion: { modoDeAhorro: 'automatico' } } })).toBe('pequena');
  });
});

describe('perfilDeAhorro', () => {
  it('sala pequeña: aviso individual, razonamiento normal y réplicas cortas con IA', () => {
    expect(perfilDeAhorro({ programa: { modoDeAhorro: 'pequena' } })).toEqual(PERFILES_DE_AHORRO.pequena);
    expect(PERFILES_DE_AHORRO.pequena).toEqual({ avisoDeEntregas: 'individual', razonamientoDeGroq: 'normal', consultarReplicasCortasALaIA: true });
  });

  it('moderada: lote, razonamiento bajo y réplicas cortas sin IA', () => {
    expect(perfilDeAhorro({ programa: { modoDeAhorro: 'moderada' } })).toEqual({
      avisoDeEntregas: 'lote',
      razonamientoDeGroq: 'bajo',
      consultarReplicasCortasALaIA: false,
    });
  });
});

describe('describirElModoDeAhorro', () => {
  it('el debate hablado no usa el modo: no se dice nada', () => {
    expect(describirElModoDeAhorro({ programa: {}, conectados: 80 })).toBeNull();
  });

  it('en automático explica qué se usaría con los conectados de ahora', () => {
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: 20 }).texto).toContain('Sala pequeña');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, conectados: 80 }).texto).toContain('Sala grande');
  });

  it('con un modo fijo que no corresponde al tamaño de la sala avisa que conviene cambiarlo', () => {
    const aviso = describirElModoDeAhorro({ programa: { modoDeAhorro: 'pequena' }, conectados: 120 });
    expect(aviso.conviene).toBe(true);
    expect(aviso.texto).toContain('Volver a configuración');
    expect(describirElModoDeAhorro({ programa: { modoDeAhorro: 'moderada' }, conectados: 120 }).conviene).toBe(false);
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
    const estado = fijar(estadoInicial(), 'moderada', 'host');
    expect(resolverModoDeAhorro({ programa: { modoDeAhorro: 'automatico' }, estado })).toBe('moderada');
  });
});
