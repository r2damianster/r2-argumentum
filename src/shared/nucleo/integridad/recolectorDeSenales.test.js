import { describe, expect, it } from 'vitest';
import {
  GRAVEDADES,
  TIPOS_DE_ENTRADA,
  TIPOS_DE_SENAL,
  clasificarEntrada,
  crearRecolectorDeSenales,
} from './recolectorDeSenales.js';

function crearRecolectorConReloj() {
  const reloj = { ahora: 1_000_000 };
  const recolector = crearRecolectorDeSenales({ ahora: () => reloj.ahora });
  return { recolector, reloj };
}

function tipos(resumen) {
  return resumen.senales.map((senal) => senal.tipo);
}

describe('clasificarEntrada', () => {
  it('distingue pegar, arrastrar, borrar y escribir', () => {
    expect(clasificarEntrada('insertFromPaste')).toBe(TIPOS_DE_ENTRADA.PEGADO);
    expect(clasificarEntrada('insertFromPasteAsQuotation')).toBe(TIPOS_DE_ENTRADA.PEGADO);
    expect(clasificarEntrada('insertFromDrop')).toBe(TIPOS_DE_ENTRADA.ARRASTRE);
    expect(clasificarEntrada('deleteContentBackward')).toBe(TIPOS_DE_ENTRADA.BORRADO);
    expect(clasificarEntrada('insertText', 'a')).toBe(TIPOS_DE_ENTRADA.ESCRITURA);
    expect(clasificarEntrada('insertLineBreak')).toBe(TIPOS_DE_ENTRADA.ESCRITURA);
  });

  it('un texto que entra de golpe sin ser pegado es un «bloque» (dictado, autocompletado)', () => {
    expect(clasificarEntrada('insertText', 'hola mundo, esto entro de una sola vez')).toBe(TIPOS_DE_ENTRADA.BLOQUE);
  });

  it('la composición y el autocorrector cuentan como escritura, no como bloque', () => {
    expect(clasificarEntrada('insertCompositionText', 'palabralarga')).toBe(TIPOS_DE_ENTRADA.ESCRITURA);
    expect(clasificarEntrada('insertReplacementText', 'corregida')).toBe(TIPOS_DE_ENTRADA.ESCRITURA);
  });

  it('un tipo desconocido es «otra»', () => {
    expect(clasificarEntrada('formatBold')).toBe(TIPOS_DE_ENTRADA.OTRA);
    expect(clasificarEntrada(undefined)).toBe(TIPOS_DE_ENTRADA.OTRA);
  });
});

describe('crearRecolectorDeSenales: escribir con normalidad', () => {
  it('quien teclea a un ritmo humano no genera ninguna señal', () => {
    const { recolector, reloj } = crearRecolectorConReloj();
    for (let tecla = 0; tecla < 200; tecla += 1) {
      recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 1 });
      reloj.ahora += 250; // 4 caracteres por segundo
    }
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(200) });
    expect(resumen.senales).toEqual([]);
    expect(resumen.requiereAdvertencia).toBe(false);
    expect(resumen.gravedadMaxima).toBeNull();
  });

  it('sin ninguna entrada no hay señales', () => {
    const { recolector } = crearRecolectorConReloj();
    expect(recolector.resumir({ textoFinal: '' }).senales).toEqual([]);
  });
});

describe('crearRecolectorDeSenales: pegado', () => {
  it('pegar casi todo el texto es una señal alta y pide advertencia', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 412 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(430) });
    const senal = resumen.senales.find((candidata) => candidata.tipo === TIPOS_DE_SENAL.PEGADO);
    expect(senal.gravedad).toBe(GRAVEDADES.ALTA);
    expect(senal.detalle).toContain('412 caracteres');
    expect(senal.detalle).toContain('96 %');
    expect(resumen.requiereAdvertencia).toBe(true);
  });

  it('pegar una parte menor es una señal media', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 60 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(300) });
    expect(resumen.senales[0].gravedad).toBe(GRAVEDADES.MEDIA);
  });

  it('pegar una cita corta de menos de 20 caracteres no se marca', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 15 });
    expect(recolector.resumir({ textoFinal: 'x'.repeat(300) }).senales).toEqual([]);
  });

  it('pegar una fracción pequeña de un texto largo es una señal baja y no interrumpe el envío', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 30 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(600) });
    expect(resumen.senales[0].gravedad).toBe(GRAVEDADES.BAJA);
    expect(resumen.requiereAdvertencia).toBe(false);
  });
});

describe('crearRecolectorDeSenales: otras señales', () => {
  it('arrastrar texto desde otra ventana es una señal alta', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ARRASTRE, caracteres: 120 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(200) });
    expect(tipos(resumen)).toContain(TIPOS_DE_SENAL.ARRASTRE);
    expect(resumen.gravedadMaxima).toBe(GRAVEDADES.ALTA);
  });

  it('un bloque grande sin pegar (dictado, autocompletado) es solo una señal baja', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.BLOQUE, caracteres: 90 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(100) });
    expect(resumen.senales[0]).toMatchObject({ tipo: TIPOS_DE_SENAL.BLOQUE, gravedad: GRAVEDADES.BAJA });
    expect(resumen.requiereAdvertencia).toBe(false);
  });

  it('teclear a más de 12 caracteres por segundo es una señal media', () => {
    const { recolector, reloj } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 1 });
    reloj.ahora += 10_000;
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 300 });
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(301) });
    expect(tipos(resumen)).toContain(TIPOS_DE_SENAL.VELOCIDAD);
  });

  it('la velocidad no se mide con textos cortos ni con tiempos de redacción muy breves', () => {
    const { recolector, reloj } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 50 });
    reloj.ahora += 1000;
    expect(tipos(recolector.resumir({ textoFinal: 'x'.repeat(50) }))).not.toContain(TIPOS_DE_SENAL.VELOCIDAD);
  });

  it('salir varias veces de la pestaña es una señal baja, que menciona que en el celular es normal', () => {
    const { recolector, reloj } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 1 });
    for (let salida = 0; salida < 3; salida += 1) {
      recolector.registrarPestanaOculta();
      reloj.ahora += 4000;
      recolector.registrarPestanaVisible();
      reloj.ahora += 1000;
    }
    const resumen = recolector.resumir({ textoFinal: 'x'.repeat(20) });
    const senal = resumen.senales.find((candidata) => candidata.tipo === TIPOS_DE_SENAL.PESTANA);
    expect(senal.gravedad).toBe(GRAVEDADES.BAJA);
    expect(senal.detalle).toContain('celular');
    expect(resumen.requiereAdvertencia).toBe(false);
  });

  it('una sola salida corta de la pestaña no genera señal', () => {
    const { recolector, reloj } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.ESCRITURA, caracteres: 1 });
    recolector.registrarPestanaOculta();
    reloj.ahora += 5000;
    recolector.registrarPestanaVisible();
    expect(tipos(recolector.resumir({ textoFinal: 'hola' }))).toEqual([]);
  });

  it('salir de la pestaña antes de empezar a escribir no cuenta', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarPestanaOculta();
    recolector.registrarPestanaVisible();
    expect(recolector.resumir({ textoFinal: '' }).senales).toEqual([]);
  });

  it('los intentos de pegar bloqueados quedan registrados como señal media', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarIntentoBloqueado();
    recolector.registrarIntentoBloqueado();
    const resumen = recolector.resumir({ textoFinal: 'escrito a mano' });
    expect(resumen.senales[0]).toMatchObject({ tipo: TIPOS_DE_SENAL.INTENTO_BLOQUEADO, gravedad: GRAVEDADES.MEDIA });
    expect(resumen.senales[0].detalle).toContain('2 vez');
  });

  it('suma señales externas y ordena todo de mayor a menor gravedad', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.BLOQUE, caracteres: 100 });
    const resumen = recolector.resumir({
      textoFinal: 'x'.repeat(120),
      senalesExternas: [{ tipo: TIPOS_DE_SENAL.PARECIDO_A_EJEMPLO, gravedad: GRAVEDADES.MEDIA, detalle: 'Parecido' }],
    });
    expect(tipos(resumen)).toEqual([TIPOS_DE_SENAL.PARECIDO_A_EJEMPLO, TIPOS_DE_SENAL.BLOQUE]);
  });

  it('reiniciar borra todo lo registrado', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 500 });
    recolector.reiniciar();
    expect(recolector.resumir({ textoFinal: 'x'.repeat(500) }).senales).toEqual([]);
  });

  it('las estadísticas acompañan al resumen para que el moderador vea la evidencia', () => {
    const { recolector } = crearRecolectorConReloj();
    recolector.registrarEntrada({ tipo: TIPOS_DE_ENTRADA.PEGADO, caracteres: 100 });
    const { estadisticas } = recolector.resumir({ textoFinal: 'x'.repeat(130) });
    expect(estadisticas).toMatchObject({ caracteresFinales: 130, pegadoCaracteres: 100 });
  });
});
