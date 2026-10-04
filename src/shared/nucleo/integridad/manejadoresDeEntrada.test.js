import { describe, expect, it, vi } from 'vitest';
import { crearRecolectorDeSenales, TIPOS_DE_SENAL } from './recolectorDeSenales.js';
import { crearManejadoresDeEntrada, senalDeParecidoAEjemplos } from './manejadoresDeEntrada.js';
import {
  NIVELES_DE_INTEGRIDAD,
  avisoDeIntegridadAlIngresar,
  integridadBloqueaPegar,
  integridadEstaActiva,
  normalizarIntegridad,
  resolverNivelDeIntegridad,
} from './nivelesDeIntegridad.js';

function eventoDePegar(texto) {
  return { clipboardData: { getData: () => texto }, preventDefault: vi.fn() };
}

function eventoDeEscribir(inputType, data) {
  return { nativeEvent: { inputType, data } };
}

describe('manejadores de entrada: nivel con advertencias', () => {
  it('pegar registra la cantidad exacta y NO bloquea', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector });
    const evento = eventoDePegar('x'.repeat(200));
    manejadores.alPegar(evento);
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(recolector.resumir({ textoFinal: 'x'.repeat(220) }).estadisticas.pegadoCaracteres).toBe(200);
  });

  it('el `input` que sigue a un pegado no se cuenta otra vez como escritura', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector });
    manejadores.alPegar(eventoDePegar('x'.repeat(100)));
    manejadores.alEscribir(eventoDeEscribir('insertFromPaste', null));
    const { estadisticas } = recolector.resumir({ textoFinal: 'x'.repeat(100) });
    expect(estadisticas.tecleadoCaracteres).toBe(0);
    expect(estadisticas.pegadoCaracteres).toBe(100);
  });

  it('arrastrar texto se registra como arrastre', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector });
    manejadores.alSoltar({ dataTransfer: { getData: () => 'y'.repeat(50) }, preventDefault: vi.fn() });
    expect(recolector.resumir({ textoFinal: 'y'.repeat(60) }).estadisticas.arrastradoCaracteres).toBe(50);
  });

  it('escribir letra por letra cuenta un carácter por pulsación', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector });
    for (const letra of 'hola') {
      manejadores.alEscribir(eventoDeEscribir('insertText', letra));
    }
    expect(recolector.resumir({ textoFinal: 'hola' }).estadisticas.tecleadoCaracteres).toBe(4);
  });

  it('la composición (autocorrector) cuenta un carácter por evento aunque reenvíe la palabra entera', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector });
    manejadores.alEscribir(eventoDeEscribir('insertCompositionText', 'argumentacion'));
    expect(recolector.resumir({ textoFinal: 'argumentacion' }).estadisticas.tecleadoCaracteres).toBe(1);
  });

  it('el cambio de visibilidad de la pestaña llega al recolector', () => {
    const reloj = { ahora: 0 };
    const recolector = crearRecolectorDeSenales({ ahora: () => reloj.ahora });
    const manejadores = crearManejadoresDeEntrada({ recolector });
    manejadores.alEscribir(eventoDeEscribir('insertText', 'a'));
    for (let salida = 0; salida < 3; salida += 1) {
      manejadores.alCambiarLaVisibilidad(false);
      reloj.ahora += 2000;
      manejadores.alCambiarLaVisibilidad(true);
    }
    expect(recolector.resumir({ textoFinal: 'a' }).estadisticas.salidasDePestana).toBe(3);
  });
});

describe('manejadores de entrada: nivel restrictivo', () => {
  it('bloquea pegar y registra el intento', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector, bloquearPegado: true });
    const evento = eventoDePegar('texto de otro sitio');
    manejadores.alPegar(evento);
    expect(evento.preventDefault).toHaveBeenCalledTimes(1);
    expect(recolector.resumir({ textoFinal: '' }).senales[0].tipo).toBe(TIPOS_DE_SENAL.INTENTO_BLOQUEADO);
  });

  it('bloquea arrastrar y registra el intento', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector, bloquearPegado: true });
    const evento = { dataTransfer: { getData: () => 'algo' }, preventDefault: vi.fn() };
    manejadores.alSoltar(evento);
    expect(evento.preventDefault).toHaveBeenCalledTimes(1);
    expect(recolector.resumir({ textoFinal: '' }).estadisticas.intentosBloqueados).toBe(1);
  });

  it('escribir sigue funcionando con normalidad', () => {
    const recolector = crearRecolectorDeSenales();
    const manejadores = crearManejadoresDeEntrada({ recolector, bloquearPegado: true });
    manejadores.alEscribir(eventoDeEscribir('insertText', 'a'));
    expect(recolector.resumir({ textoFinal: 'a' }).estadisticas.tecleadoCaracteres).toBe(1);
  });
});

describe('senalDeParecidoAEjemplos', () => {
  const EJEMPLOS = [
    {
      malo: 'Es malo.',
      bueno:
        'En metodología aprendí a formular una pregunta de investigación, y eso me sirvió en mis prácticas preprofesionales porque tuve que proponer cómo recoger datos',
      porque: 'x',
    },
  ];

  it('marca como señal media copiar el ejemplo del Programa', () => {
    const senales = senalDeParecidoAEjemplos(EJEMPLOS[0].bueno, EJEMPLOS);
    expect(senales).toHaveLength(1);
    expect(senales[0]).toMatchObject({ tipo: TIPOS_DE_SENAL.PARECIDO_A_EJEMPLO, gravedad: 'media' });
  });

  it('un texto distinto no genera señal', () => {
    expect(senalDeParecidoAEjemplos('La inteligencia artificial cambia cómo estudiamos porque permite practicar con retroalimentación inmediata', EJEMPLOS)).toEqual([]);
  });

  it('sin ejemplos no hay señal', () => {
    expect(senalDeParecidoAEjemplos('cualquier texto con suficientes palabras para comparar bien', [])).toEqual([]);
  });
});

describe('niveles de integridad', () => {
  it('sin configuración está apagada por defecto', () => {
    expect(resolverNivelDeIntegridad({})).toBe(NIVELES_DE_INTEGRIDAD.NINGUNA);
    expect(integridadEstaActiva({})).toBe(false);
    expect(integridadBloqueaPegar({})).toBe(false);
  });

  it('con advertencias está activa pero no bloquea', () => {
    const programa = { integridad: { nivel: 'advertencias' } };
    expect(integridadEstaActiva(programa)).toBe(true);
    expect(integridadBloqueaPegar(programa)).toBe(false);
  });

  it('la restrictiva está activa y bloquea', () => {
    const programa = { integridad: { nivel: 'restrictiva' } };
    expect(integridadEstaActiva(programa)).toBe(true);
    expect(integridadBloqueaPegar(programa)).toBe(true);
  });

  it('un nivel inventado cae en el valor por defecto', () => {
    expect(normalizarIntegridad({ nivel: 'paranoica' }).nivel).toBe('ninguna');
  });

  it('el aviso al ingresar solo existe cuando hay algo que avisar', () => {
    expect(avisoDeIntegridadAlIngresar('ninguna')).toBe('');
    expect(avisoDeIntegridadAlIngresar('advertencias')).toContain('Solo las ve el moderador');
    expect(avisoDeIntegridadAlIngresar('restrictiva')).toContain('no se puede pegar');
  });
});
