import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from '../estado/reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { calcularAvisosParaElModerador } from './calcularAvisos.js';

const PROGRAMA = {
  titulo: 'Debate de prueba',
  posturas: [
    { id: 'izquierda', etiqueta: 'Más estado' },
    { id: 'derecha', etiqueta: 'Más mercado' },
  ],
  perfilDePuntaje: 'estandar',
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', conectado: true },
  { participantId: 'luis', nombre: 'Luis', conectado: true },
];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function construirEstado(tipoDeFase) {
  return [
    evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'luis', stanceId: 'derecha' }),
    evento(EVENTOS.FASE_INICIADA, { phaseType: tipoDeFase, ronda: 1 }),
  ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), estadoInicial());
}

describe('avisos operativos del moderador', () => {
  it('durante la escritura avisa de quien no tiene argumento preparado', () => {
    const avisos = calcularAvisosParaElModerador(construirEstado('escritura_argumentos'), PRESENCIA);

    expect(avisos.map((aviso) => aviso.id)).toContain('sin-argumento-preparado');
  });

  it('en el cierre y ranking no muestra avisos de la ruleta ni de co-moderación', () => {
    const avisos = calcularAvisosParaElModerador(construirEstado('cierre_y_ranking'), PRESENCIA);

    expect(avisos).toEqual([]);
  });
});
