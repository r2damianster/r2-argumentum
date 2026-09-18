import { describe, it, expect } from 'vitest';
import { estadoInicial, reducirEventos } from './reducirEventos.js';
import { EVENTOS } from '../eventos/nombresDeEventos.js';
import { calcularInstruccionesDelParticipante } from '../instrucciones/calcularInstrucciones.js';
import { calcularAvisosParaElModerador } from '../instrucciones/calcularAvisos.js';
import { esOyente, seAlcanzoElMinimoDeParticipacion } from '../ingreso/reglasDeIngreso.js';
import { calcularRankingPorPostura } from './seleccionesDerivadas.js';
import { exportarSesion } from './exportarSesion.js';

// Recorrido completo de una sesión real, de punta a punta: ingreso con argumento, sorteo de
// co-moderador, ruleta de turnos sobre argumentos ya preparados, intervención hablada de quien
// no preparó nada, cierre y ranking. Sirve para detectar que las fases encajan entre sí, no
// solo que cada una funciona aislada.

const PROGRAMA = {
  programId: 'prueba',
  titulo: 'Debate de prueba',
  temaCentral: '¿Tema de prueba?',
  perfilDePuntaje: 'estandar',
  posturas: [
    { id: 'izquierda', etiqueta: 'Más estado', color: '#d1495b' },
    { id: 'derecha', etiqueta: 'Más mercado', color: '#1f77b4' },
  ],
};

const PRESENCIA = [
  { participantId: 'ana', nombre: 'Ana', emoji: '🦊', conectado: true },
  { participantId: 'luis', nombre: 'Luis', emoji: '🐼', conectado: true },
  { participantId: 'marta', nombre: 'Marta', emoji: '🦉', conectado: true },
];

function evento(name, data = {}) {
  return { name, data: { timestamp: Date.now(), ...data } };
}

function aplicar(estado, eventos) {
  return eventos.reduce((acumulado, unEvento) => reducirEventos(acumulado, unEvento), estado);
}

function ingresarConArgumento(participantId, stanceId, argumentId, texto) {
  return [
    evento(EVENTOS.POSTURA_ASIGNADA, { participantId, stanceId, metodo: 'libre' }),
    evento(EVENTOS.ARGUMENTO_PUBLICADO, {
      argumentId,
      participantId,
      turnId: `ingreso-${participantId}`,
      ronda: 1,
      posicionEnRonda: 1,
      tipoDeclarado: 'nuevo',
      texto,
      stanceId,
      viaCoModerador: false,
    }),
    evento(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId, argumentId }),
  ];
}

describe('sesión completa de punta a punta', () => {
  it('recorre ingreso, debate, intervención hablada y cierre sin perder consistencia', () => {
    let estado = aplicar(estadoInicial(), [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA })]);

    // --- Ingreso: Ana y Luis confirman con argumento; Marta se queda escribiendo ---
    estado = aplicar(estado, [
      ...ingresarConArgumento('ana', 'izquierda', 'arg-ana', 'El estado corrige fallas de mercado porque…'),
      ...ingresarConArgumento('luis', 'derecha', 'arg-luis', 'El mercado asigna mejor los recursos porque…'),
    ]);

    expect(esOyente(estado, 'marta')).toBe(true);
    expect(esOyente(estado, 'ana')).toBe(false);

    // El moderador ve que falta gente por confirmar antes de iniciar.
    const avisosAntesDeIniciar = calcularAvisosParaElModerador(estado, PRESENCIA);
    expect(avisosAntesDeIniciar.some((aviso) => aviso.id === 'ingresos-pendientes')).toBe(true);

    // --- Inicio: Marta queda como oyente, Luis sale sorteado co-moderador ---
    estado = aplicar(estado, [
      evento(EVENTOS.COMODERADORES_SELECCIONADOS, { participantIds: ['luis'], totalParticipantes: 3 }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ]);

    // Marta ya no puede entrar: es oyente y no recibe tareas obligatorias.
    const instruccionesDeMarta = calcularInstruccionesDelParticipante(estado, 'marta', PRESENCIA);
    expect(instruccionesDeMarta.tienesQue).toBeNull();
    expect(instruccionesDeMarta.puedes).toEqual(['Seguir el debate como oyente']);

    // A Ana se le exige preparar un argumento para entrar a la ruleta.
    expect(calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA).tienesQue.texto).toContain(
      'Prepara un argumento'
    );

    // --- Ana prepara, le ofrecen la palabra, la acepta y expone ---
    estado = aplicar(estado, [evento(EVENTOS.ARGUMENTO_LISTO, { participantId: 'ana' })]);
    expect(estado.participantes.ana.argumentoListo).toBe(true);

    estado = aplicar(estado, [
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 't1', candidateId: 'ana', expiraEn: Date.now() + 20000 }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 't1', participantId: 'ana' }),
      evento(EVENTOS.ARGUMENTO_PUBLICADO, {
        argumentId: 'arg-ana-2',
        participantId: 'ana',
        turnId: 't1',
        ronda: 1,
        posicionEnRonda: 2,
        tipoDeclarado: 'contraargumento',
        argumentoObjetivoId: 'arg-luis',
        texto: 'Pero ese mecanismo falla cuando hay monopolio, porque…',
        stanceId: 'izquierda',
        viaCoModerador: false,
      }),
    ]);

    expect(estado.participantes.ana.argumentoListo).toBe(false);
    expect(estado.participantes.ana.posicionesCompletadas).toBe(2);
    expect(estado.turnos.turnoEnCurso).toBeNull();

    // --- Nadie más tiene argumento listo: a Marta no le corresponde turno por ser oyente ---
    // El mínimo de participación solo mira a quienes entraron al debate.
    expect(seAlcanzoElMinimoDeParticipacion(estado, PRESENCIA)).toBe(true);

    // --- Luis, co-moderador, valida el argumento de Ana ---
    estado = aplicar(estado, [
      evento(EVENTOS.ARGUMENTO_VALIDADO, {
        argumentId: 'arg-ana-2',
        coModeradorId: 'luis',
        tipoFinal: 'contraargumento',
        nota: '',
        faltaMarcada: false,
      }),
    ]);

    expect(estado.argumentos['arg-ana-2'].validacion.coModeradorId).toBe('luis');

    // --- Cierre ---
    estado = aplicar(estado, [
      evento(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: 'ana',
        delta: 100,
        categoria: 'argumento',
        nuevoTotal: 100,
      }),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'cierre_y_ranking' }),
      evento(EVENTOS.SESION_CERRADA, {}),
    ]);

    expect(calcularInstruccionesDelParticipante(estado, 'ana', PRESENCIA).ahora).toContain('terminó');

    const ranking = calcularRankingPorPostura(estado, PROGRAMA, PRESENCIA);
    expect(ranking.izquierda.find((p) => p.participantId === 'ana').puntajeTotal).toBe(100);

    const exportado = exportarSesion({ eventos: [], estado, programa: PROGRAMA, presencia: PRESENCIA });
    expect(exportado.mapaArgumental).toHaveLength(3);
    expect(exportado.perfilPorEstudiante.find((perfil) => perfil.nombre === 'Ana').argumentosEscritos).toBe(2);
  });

  it('la intervención hablada deja intervenir a quien nunca preparó un argumento', () => {
    let estado = aplicar(estadoInicial(), [evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: PROGRAMA })]);
    estado = aplicar(estado, [
      ...ingresarConArgumento('ana', 'izquierda', 'arg-ana', 'Razón A porque…'),
      ...ingresarConArgumento('luis', 'derecha', 'arg-luis', 'Razón B porque…'),
      evento(EVENTOS.FASE_INICIADA, { phaseType: 'escritura_argumentos', ronda: 1 }),
    ]);

    const puntajeAntes = estado.participantes.luis.intervenciones;

    estado = aplicar(estado, [
      evento(EVENTOS.TURNO_OFRECIDO, { turnId: 'tv', candidateId: 'luis', expiraEn: 1, modo: 'verbal' }),
      evento(EVENTOS.TURNO_ACEPTADO, { turnId: 'tv', participantId: 'luis' }),
      evento(EVENTOS.INTERVENCION_VERBAL_REGISTRADA, {
        intervencionId: 'v1',
        participantId: 'luis',
        turnId: 'tv',
        resumen: 'Agregó un matiz sobre regulación.',
      }),
      evento(EVENTOS.INTERVENCION_VERBAL_CALIFICADA, {
        intervencionId: 'v1',
        coModeradorId: 'ana',
        calidad: 'buena',
      }),
    ]);

    expect(estado.participantes.luis.intervenciones).toBe(puntajeAntes + 1);
    expect(estado.intervencionesVerbales.v1.calificacion.calidad).toBe('buena');
    expect(estado.turnos.turnoEnCurso).toBeNull();
  });

  it('una postura propuesta y aceptada queda disponible para el resto del debate', () => {
    let estado = aplicar(estadoInicial(), [
      evento(EVENTOS.PROGRAMA_PUBLICADO, { programa: { ...PROGRAMA, permitirPosturasNuevas: true } }),
      evento(EVENTOS.POSTURA_PROPUESTA, {
        propuestaId: 'p1',
        participantId: 'marta',
        etiquetaPropuesta: 'Economía mixta condicionada',
        textoDelArgumento: 'Ninguna de las dos alcanza porque…',
      }),
    ]);

    // El moderador acepta: republica el Programa con la postura nueva y resuelve la propuesta.
    estado = aplicar(estado, [
      evento(EVENTOS.PROGRAMA_PUBLICADO, {
        programa: {
          ...PROGRAMA,
          permitirPosturasNuevas: true,
          posturas: [...PROGRAMA.posturas, { id: 'mixta', etiqueta: 'Economía mixta condicionada', color: '#0891B2' }],
        },
      }),
      evento(EVENTOS.POSTURA_DECISION_MODERADOR, { propuestaId: 'p1', decision: 'aceptada', stanceId: 'mixta' }),
    ]);

    expect(estado.programa.posturas).toHaveLength(3);
    expect(estado.posturasPropuestas.p1.decision).toBe('aceptada');

    // Y ahora Marta puede ingresar defendiéndola.
    estado = aplicar(estado, ingresarConArgumento('marta', 'mixta', 'arg-marta', 'La mezcla funciona porque…'));
    expect(estado.participantes.marta.ingresoConfirmado).toBe(true);
    expect(estado.participantes.marta.stanceId).toBe('mixta');
  });
});
