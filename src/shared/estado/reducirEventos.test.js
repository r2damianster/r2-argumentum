import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

function reducirTodos(eventos) {
  return eventos.reduce((estado, evento) => reducirEventos(estado, evento), estadoInicial());
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('apertura — máquina de rondas', () => {
  it('registra la ronda vigente con su plazo', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
    ]);

    expect(estado.apertura).toMatchObject({ ronda: 1, expiraEn: 4000, cerrada: false });
  });

  it('la extensión mueve el plazo de la ronda en curso', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_EXTENDIDA, { ronda: 1, hasta: 64000 }),
    ]);

    expect(estado.apertura.expiraEn).toBe(64000);
  });

  it('ignora una extensión dirigida a otra ronda', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 2, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_EXTENDIDA, { ronda: 1, hasta: 64000 }),
    ]);

    expect(estado.apertura.expiraEn).toBe(4000);
  });

  it('un cierre no final deja la sesión esperando la decisión del host, sin excluir a nadie', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 1, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_CERRADA, {
        ronda: 1,
        aprobados: ['ana'],
        pendientes: ['luis'],
        esFinal: false,
      }),
    ]);

    expect(estado.apertura.esperandoSegundaOportunidad).toBe(true);
    expect(estado.participantes.luis?.sinArgumentoDeApertura).toBeFalsy();
  });

  it('el cierre final marca a los pendientes como sin argumento', () => {
    const estado = reducirTodos([
      evento(EVENTOS.APERTURA_RONDA_INICIADA, { ronda: 2, iniciadaEn: 1000, expiraEn: 4000 }),
      evento(EVENTOS.APERTURA_RONDA_CERRADA, {
        ronda: 2,
        aprobados: ['ana'],
        pendientes: ['luis'],
        esFinal: true,
      }),
    ]);

    expect(estado.participantes.luis.sinArgumentoDeApertura).toBe(true);
    expect(estado.participantes.ana?.sinArgumentoDeApertura).toBeFalsy();
    expect(estado.apertura.esperandoSegundaOportunidad).toBe(false);
  });
});

describe('argumentos', () => {
  it('posicionesCompletadas nunca retrocede ante eventos fuera de orden', () => {
    const estado = reducirTodos([
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a2',
        participantId: 'ana',
        posicionEnRonda: 2,
        ronda: 1,
      }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
      }),
    ]);

    expect(estado.participantes.ana.posicionesCompletadas).toBe(2);
  });
});
