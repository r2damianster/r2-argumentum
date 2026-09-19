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

  it('avisa cuando quien tiene la palabra se quedó sin conexión', () => {
    const conTurno = [
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 1000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
    ].reduce((estado, siguiente) => reducirEventos(estado, siguiente), construirEstado('escritura_argumentos'));
    const presenciaConAnaCaida = [{ ...PRESENCIA[0], conectado: false }, PRESENCIA[1]];

    const avisos = calcularAvisosParaElModerador(conTurno, presenciaConAnaCaida);
    expect(avisos.map((aviso) => aviso.id)).toContain('turno-sin-conexion');

    const sinCaida = calcularAvisosParaElModerador(conTurno, PRESENCIA);
    expect(sinCaida.map((aviso) => aviso.id)).not.toContain('turno-sin-conexion');
  });

  it('en el cierre y ranking no muestra avisos de la ruleta ni de co-moderación', () => {
    const avisos = calcularAvisosParaElModerador(construirEstado('cierre_y_ranking'), PRESENCIA);

    expect(avisos).toEqual([]);
  });
});
