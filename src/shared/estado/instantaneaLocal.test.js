import { describe, it, expect, beforeEach } from 'vitest';
import { guardarInstantanea, leerInstantanea, borrarInstantanea } from './instantaneaLocal.js';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';

// La copia local existe para que un F5 o una pestaña cerrada no dependan de que el historial
// de Ably siga vivo (retiene pocos minutos). Ver instantaneaLocal.js.

function crearAlmacenamientoDePrueba() {
  const datos = new Map();
  return {
    get length() {
      return datos.size;
    },
    key: (indice) => [...datos.keys()][indice] ?? null,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };
}

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

describe('copia local del estado de la sesión', () => {
  beforeEach(() => {
    globalThis.localStorage = crearAlmacenamientoDePrueba();
  });

  it('guarda y recupera el estado de una sala', () => {
    guardarInstantanea('7531', { estado: estadoInicial(), eventos: [], idsProcesados: ['m1'] });

    const recuperada = leerInstantanea('7531');

    expect(recuperada.idsProcesados).toEqual(['m1']);
    expect(recuperada.estado.participantes).toEqual({});
  });

  it('no devuelve la copia de otra sala', () => {
    guardarInstantanea('7531', { estado: estadoInicial(), eventos: [] });

    expect(leerInstantanea('9999')).toBeNull();
  });

  it('descarta una copia vencida', () => {
    guardarInstantanea('7531', { estado: estadoInicial(), eventos: [] });
    const guardada = JSON.parse(globalThis.localStorage.getItem('r2-argumentum-instantanea:7531'));
    globalThis.localStorage.setItem(
      'r2-argumentum-instantanea:7531',
      JSON.stringify({ ...guardada, guardadaEn: Date.now() - 13 * 60 * 60 * 1000 })
    );

    expect(leerInstantanea('7531')).toBeNull();
  });

  it('no explota con una copia corrupta', () => {
    globalThis.localStorage.setItem('r2-argumentum-instantanea:7531', 'esto no es json');

    expect(leerInstantanea('7531')).toBeNull();
  });

  it('borrarInstantanea la elimina', () => {
    guardarInstantanea('7531', { estado: estadoInicial(), eventos: [] });
    borrarInstantanea('7531');

    expect(leerInstantanea('7531')).toBeNull();
  });

  it('el estado de una sesión real sobrevive intacto a la ida y vuelta por JSON', () => {
    // Si el reducer guardara un Set o un Map, la copia local lo perdería en silencio y el
    // estado restaurado sería sutilmente distinto del original.
    const eventos = [
      evento(EVENTOS.PROGRAMA_PUBLICADO, {
        programa: { posturas: [{ id: 'izquierda' }, { id: 'derecha' }] },
        identificadorDeSesion: 'sesion-1',
      }),
      evento(EVENTOS.INGRESO_CONFIRMADO, { participantId: 'ana', stanceId: 'izquierda' }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', ofrecidoEn: 1, expiraEn: 2 }),
      evento(EVENTOS.TURNO_RECHAZADO, { turnId: 't1', participantId: 'ana', totalRechazosDelParticipante: 1 }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'a1',
        participantId: 'ana',
        posicionEnRonda: 1,
        ronda: 1,
        claveDeIdempotencia: 'puntaje-argumento:a1',
      }),
    ];
    const estado = eventos.reduce((acumulado, siguiente) => reducirEventos(acumulado, siguiente), estadoInicial());

    guardarInstantanea('7531', { estado, eventos: [], idsProcesados: [] });

    expect(leerInstantanea('7531').estado).toEqual(estado);
    expect(estado.accionesDelMotor['puntaje-argumento:a1']).toBe(true);
    expect(estado.sesion.identificador).toBe('sesion-1');
  });
});
