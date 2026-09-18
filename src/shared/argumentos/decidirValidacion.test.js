import { describe, it, expect } from 'vitest';
import { decidirValidacion, DECISIONES } from './decidirValidacion.js';

const POSTURAS = [
  { id: 'izquierda', etiqueta: 'Más estado / redistribución' },
  { id: 'derecha', etiqueta: 'Más mercado / libertad individual' },
];

function respuestaDeGroq(sobreescrituras = {}) {
  return {
    aprobado: true,
    motivo: '',
    sugerenciaDeCorreccion: '',
    posturaDetectada: 'izquierda',
    esPosturaNueva: false,
    posturaSugerida: '',
    confianza: 0.9,
    ...sobreescrituras,
  };
}

describe('forma del argumento', () => {
  it('un argumento sin razón se rechaza, sin mirar la postura', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ aprobado: false, motivo: 'Falta una razón.' }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.FORMA_INVALIDA);
    expect(resultado.mensaje).toBe('Falta una razón.');
  });
});

describe('postura que no está en el debate', () => {
  it('con posturas nuevas permitidas, se ofrece proponerla al moderador', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({
        posturaDetectada: null,
        esPosturaNueva: true,
        posturaSugerida: 'anarquismo de mercado',
      }),
      stanceElegido: 'izquierda',
      permitirPosturasNuevas: true,
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.POSTURA_NUEVA_PROPUESTA);
    expect(resultado.posturaSugerida).toBe('anarquismo de mercado');
  });

  it('con posturas nuevas bloqueadas (el default), se pide reescribir', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({
        posturaDetectada: null,
        esPosturaNueva: true,
        posturaSugerida: 'anarquismo de mercado',
      }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.POSTURA_FUERA_DEL_DEBATE);
  });
});

describe('postura distinta a la elegida', () => {
  it('avisa cuando Groq clasificó con seguridad en otra postura', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ posturaDetectada: 'derecha', confianza: 0.95 }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.POSTURA_DISTINTA);
    expect(resultado.mensaje).toContain('Más mercado / libertad individual');
  });

  it('con asignación aleatoria no ofrece cambiar de postura, solo reescribir', () => {
    // Bug real reportado en prueba en vivo: el mensaje decía "puedes cambiar tu postura a
    // esa" pero la pantalla de ingreso con asignación aleatoria no tiene ningún control para
    // hacerlo — ahí no se "eligió" nada, se asignó.
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ posturaDetectada: 'derecha', confianza: 0.95 }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
      permiteCambioDePostura: false,
    });

    expect(resultado.decision).toBe(DECISIONES.POSTURA_DISTINTA);
    expect(resultado.mensaje).not.toContain('elegiste');
    expect(resultado.sugerencia).not.toContain('cambiar');
  });

  it('NO contradice al estudiante si la clasificación viene con poca confianza', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ posturaDetectada: 'derecha', confianza: 0.3 }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.APROBADO);
  });
});

describe('casos límite: ante la duda, aprueba', () => {
  it('aprueba si Groq no pudo clasificar pero la forma está bien', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ posturaDetectada: null, esPosturaNueva: false }),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.APROBADO);
    expect(resultado.posturaDetectada).toBe('izquierda');
  });

  it('aprueba cuando la postura detectada coincide con la elegida', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq(),
      stanceElegido: 'izquierda',
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.APROBADO);
  });

  it('no inventa conflicto si el estudiante todavía no eligió postura', () => {
    const resultado = decidirValidacion({
      resultadoDeGroq: respuestaDeGroq({ posturaDetectada: 'derecha' }),
      stanceElegido: null,
      posturas: POSTURAS,
    });

    expect(resultado.decision).toBe(DECISIONES.APROBADO);
    expect(resultado.posturaDetectada).toBe('derecha');
  });
});
