// Motor de sesión — corre SOLO en el cliente del host (autoridad única, ver plan de
// implementación). Es el motor BASE: lleva el estado vigente, la idempotencia de las acciones, el
// avance de fases, el sorteo de co-moderadores, el puntaje provisional de cada argumento y el
// cierre con sus ajustes. Lo propio de cada actividad (la ruleta de turnos del debate hablado, por
// ejemplo) lo aporta la actividad del Programa (ver src/actividades/ y docs/13). El resto de
// clientes solo publican eventos "de intención" y reconstruyen su vista con el reducer (ver
// useEstadoDeSesion).

import { EVENTOS, TIPOS_DE_FASE } from '../shared/eventos/nombresDeEventos.js';
import { resolverParametrosDePuntaje } from '../shared/puntaje/formulaDePuntaje.js';
import {
  calcularCantidadSegunElPrograma,
  normalizarModeracion,
  sortearCoModeradores,
  validarDesignacionManual,
} from '../shared/nucleo/coModeracion/calcularCoModeradores.js';
import { resolverActividadDelPrograma } from '../actividades/registroDeActividades.js';

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// El puntaje acumulado nunca baja de cero: una penalidad puede consumir lo que la persona
// tenía, no dejarla en deuda. Observado en prueba en vivo (alguien con 10 puntos rechazó un
// turno y quedó en −10): proyectado en el aula se lee como un castigo desproporcionado, y no
// cambia el ranking, que ordena por percentiles dentro de cada postura. El desincentivo real
// de rechazar sigue existiendo por otro lado: a los N rechazos consecutivos el turno se
// fuerza y hay que hablar igual (ver docs/04).
//
// El `delta` publicado conserva el valor nominal de la regla — así el export muestra la
// penalidad completa que se aplicó y el tope que la cortó, en vez de esconderla.
function crearAcumuladorDePuntaje(estado) {
  const totales = {};
  return function aplicarDelta(participantId, delta) {
    if (totales[participantId] === undefined) {
      totales[participantId] = estado.participantes[participantId]?.puntajeTotal ?? 0;
    }
    totales[participantId] = Math.max(0, totales[participantId] + delta);
    return totales[participantId];
  };
}

export function crearMotorDeSesion({ programa }) {
  // El perfil de puntaje lo elige el docente en la configuración, DESPUÉS de que el motor se
  // creó, y viaja en el Programa que se republica al iniciar sesión. Por eso los parámetros se
  // resuelven contra el Programa del canal en cada uso, no una sola vez al construir el motor.
  function parametrosDePuntajeVigentes() {
    return resolverParametrosDePuntaje(contexto.estado?.programa ?? programa);
  }
  // Cada acción irrepetible del motor (puntuar un argumento, resolver un bid, cerrar una
  // ronda) tiene una clave estable. El conjunto local cubre el lapso entre publicar y que el
  // evento vuelva por el canal; el log del estado cubre el caso grande: un host que refresca
  // la pestaña a mitad del debate y crea un motor nuevo, que sin esto volvía a puntuar todo
  // y a republicar el argumento de cada bid aprobado.
  const accionesDeEsteMotor = new Set();

  function yaSeHizo(clave) {
    return accionesDeEsteMotor.has(clave) || Boolean(contexto.estado?.accionesDelMotor?.[clave]);
  }

  // Marca la acción y devuelve un publicador que le pega la clave al PRIMER evento que emita
  // (una acción puede publicar varios eventos, o ninguno).
  function comenzarAccion(clave) {
    accionesDeEsteMotor.add(clave);
    let claveYaAdjuntada = false;
    return function publicarDeLaAccion(nombreDeEvento, datos) {
      const datosFinales = claveYaAdjuntada ? datos : { ...datos, claveDeIdempotencia: clave };
      claveYaAdjuntada = true;
      contexto.publicar(nombreDeEvento, datosFinales);
    };
  }

  let contexto = { estado: null, presencia: [], publicar: () => {} };

  function estaCerrada() {
    return Boolean(contexto.estado?.sesion?.cerrada);
  }

  // Lo que el motor base pone a disposición de la actividad. Se entrega el acceso al estado
  // vigente como función porque `contexto` se reemplaza en cada sincronización.
  const servicios = {
    programa,
    obtenerContexto: () => contexto,
    parametrosDePuntajeVigentes,
    yaSeHizo,
    comenzarAccion,
    estaCerrada,
    generarId,
    crearAcumuladorDePuntaje,
    cerrarFaseActual: () => cerrarFaseActual(),
  };
  const actividad = resolverActividadDelPrograma(programa);
  const proceso = actividad.crearProcesosDelMotor(servicios);

  // Mismo criterio que usa el host para mostrar la sala de configuración previa. Antes de que
  // arranque la primera fase, el perfil de puntaje elegido por el docente todavía puede no
  // estar publicado (se republica recién al hacer clic en "Iniciar sesión", ver ControlDeFases)
  // — puntuar un argumento de ingreso antes de eso lo deja fijado con parámetros por defecto
  // para siempre, aunque el docente después elija otro perfil. Bug real reportado en prueba en
  // vivo: el argumento de ingreso quedaba en la escala Liviana aunque se hubiera elegido
  // Estándar, porque se puntuaba en cuanto llegaba, no cuando el perfil ya era definitivo.
  function sesionIniciada() {
    const { estado } = contexto;
    return Boolean(estado?.fase.actual) || (estado?.fase.historial.length ?? 0) > 0;
  }

  function esLaMismaEntradaDeFase(entradaDelPrograma, faseDelEstado) {
    return (
      entradaDelPrograma.tipo === faseDelEstado.tipo &&
      (entradaDelPrograma.ronda ?? null) === (faseDelEstado.ronda ?? null)
    );
  }

  // En qué punto del Programa está el debate, deducido del log de fases y no de un contador en
  // memoria. Con el contador, un host que refrescaba la pestaña arrancaba de nuevo en -1 y la
  // siguiente fase que cerrara mandaba el debate de vuelta a la primera fase del Programa.
  function indiceDeLaFaseMasReciente() {
    const { estado } = contexto;
    const recorridas = [...(estado?.fase.historial ?? [])];
    if (estado?.fase.actual) {
      recorridas.push(estado.fase.actual);
    }

    let indice = -1;
    for (const recorrida of recorridas) {
      indice += 1;
      while (indice < programa.fases.length && !esLaMismaEntradaDeFase(programa.fases[indice], recorrida)) {
        indice += 1;
      }
      if (indice >= programa.fases.length) {
        return programa.fases.length;
      }
    }
    return indice;
  }

  // El puntaje base de un argumento (posición × ronda × vía, ver docs/05) NO depende de que un
  // co-moderador lo revise: se acredita apenas el argumento entra al canal. Antes estaba
  // acoplado a `argument.validated`, así que en una sala sin co-moderadores (n=2, donde el
  // sorteo correctamente asigna 0) nadie podía validar nada y el marcador quedaba en 0 para
  // todos, para siempre. Bug real reportado en prueba en vivo.
  function procesarArgumentosNuevos() {
    const { estado } = contexto;
    if (!estado || !sesionIniciada()) {
      return;
    }
    const aplicarDelta = crearAcumuladorDePuntaje(estado);

    for (const argumento of Object.values(estado.argumentos)) {
      const clave = `puntaje-argumento:${argumento.argumentId}`;
      if (yaSeHizo(clave)) {
        continue;
      }
      const publicar = comenzarAccion(clave);

      // La actividad dice cuánto vale el argumento (posición y ronda en el debate hablado; topes de
      // posts y réplicas en el foro escrito). Sin puntaje que acreditar no se publica nada.
      const puntaje = proceso.calcularPuntajeProvisional(argumento, estado);
      if (!puntaje) {
        continue;
      }
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: argumento.participantId,
        delta: puntaje.delta,
        categoria: 'argumento',
        motivo: puntaje.motivo,
        nuevoTotal: aplicarDelta(argumento.participantId, puntaje.delta),
      });
    }
  }

  function sincronizar({ estado, presencia, publicar }) {
    contexto = { estado, presencia, publicar };
    if (!estado || estaCerrada()) {
      return;
    }
    proceso.alSincronizarAntesDelPuntaje?.();
    procesarArgumentosNuevos();
    proceso.alSincronizarDespuesDelPuntaje?.();
  }

  // Qué viaja en `phase.started`: las fases con tiempo total (el foro) llevan su duración, para que
  // todos los clientes lleven la misma cuenta atrás.
  function datosDeInicioDeFase(entradaDelPrograma) {
    const datos = { phaseType: entradaDelPrograma.tipo, ronda: entradaDelPrograma.ronda ?? null };
    if (actividad.tiposDeFaseConTiempoTotal.includes(entradaDelPrograma.tipo) && entradaDelPrograma.duracionMin) {
      datos.duracionMin = entradaDelPrograma.duracionMin;
    }
    return datos;
  }

  // Quién puede ser co-moderador: quien está conectado Y ya confirmó su ingreso. Quien solo mira
  // (oyente) no entra al sorteo: si no, quedaba como co-moderador y oyente a la vez.
  function listarParticipantesElegiblesParaCoModerar() {
    const { estado, presencia } = contexto;
    return (presencia ?? [])
      .filter((presente) => presente.conectado !== false)
      .map((presente) => presente.participantId)
      .filter((participantId) => estado?.participantes[participantId]?.ingresoConfirmado);
  }

  // El moderador puede designar a los co-moderadores en la sala de espera, cuando ya ingresó la
  // gente (sorteo o a mano). Esa designación se respeta al iniciar; si no hizo ninguna, el sorteo
  // se hace al iniciar según el modo elegido (docs/13).
  const ORIGENES_DE_DESIGNACION_DEL_MODERADOR = ['sorteo_del_moderador', 'manual'];

  function designarCoModeradores({ modo, idsElegidos = [] }) {
    const { estado, publicar } = contexto;
    if (!estado || estaCerrada()) {
      return null;
    }
    const programaVigente = estado.programa ?? programa;
    const elegibles = listarParticipantesElegiblesParaCoModerar();

    if (modo === 'manual') {
      const validacion = validarDesignacionManual({
        idsElegidos,
        idsElegibles: elegibles,
        totalDeParticipantes: elegibles.length,
      });
      publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
        participantIds: validacion.idsValidos,
        formulaUsada: 'manual',
        totalParticipantes: elegibles.length,
        origen: 'manual',
      });
      return validacion;
    }

    const cantidad = calcularCantidadSegunElPrograma(programaVigente, elegibles.length);
    const sorteados = sortearCoModeradores(elegibles, cantidad);
    publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
      participantIds: sorteados,
      formulaUsada: normalizarModeracion(programaVigente.moderacion).modo,
      totalParticipantes: elegibles.length,
      origen: 'sorteo_del_moderador',
    });
    return { idsValidos: sorteados, idsRechazados: [], superaElMaximo: false };
  }

  // Deshace la designación: al iniciar, el sorteo vuelve a hacerse según el modo elegido.
  function quitarDesignacionDeCoModeradores() {
    const { estado, publicar } = contexto;
    if (!estado || estaCerrada()) {
      return;
    }
    publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
      participantIds: [],
      formulaUsada: 'sin_designar',
      totalParticipantes: listarParticipantesElegiblesParaCoModerar().length,
      origen: 'automatico',
    });
  }

  function iniciarSesion() {
    const { estado, publicar } = contexto;
    const programaVigente = estado?.programa ?? programa;
    const participantesElegibles = listarParticipantesElegiblesParaCoModerar();

    if (ORIGENES_DE_DESIGNACION_DEL_MODERADOR.includes(estado?.coModeradores?.origen)) {
      // Ya los designó el moderador: no se vuelve a sortear, solo se confirma la lista en el log.
    } else {
      // Con pocos participantes no hay co-moderadores (con 3 debatientes, ninguno) y la sala nunca
      // se queda con menos de 3 personas debatiendo: ver nucleo/coModeracion.
      const cantidad = calcularCantidadSegunElPrograma(programaVigente, participantesElegibles.length);
      publicar(EVENTOS.COMODERADORES_SELECCIONADOS, {
        participantIds: sortearCoModeradores(participantesElegibles, cantidad),
        formulaUsada: normalizarModeracion(programaVigente.moderacion).modo,
        totalParticipantes: participantesElegibles.length,
        origen: 'automatico',
      });
    }

    // La postura ya se asignó al confirmar el ingreso (ver IngresoConArgumento.jsx): con
    // asignación aleatoria, `elegirPosturaMenosRepresentada` la fijó de forma balanceada antes
    // de escribir el argumento; con "libre", el estudiante la eligió. Reasignarla aquí por
    // round-robin (como se hacía antes de que el ingreso incluyera la postura) le pisaba la
    // postura ya elegida sin avisar — el argumento de ingreso quedaba con un stanceId y el
    // participante con otro distinto, y el ranking/informe los mostraban en columnas
    // contradictorias. Bug real reportado en prueba en vivo.

    const primeraFase = programa.fases[0];
    publicar(EVENTOS.FASE_INICIADA, datosDeInicioDeFase(primeraFase));
  }

  // Manda TODO el pool de argumentos acumulado hasta ahora (no solo los de la fase que se
  // cierra) — así Groq también puede encontrar conexiones entre una reacción nueva y un
  // argumento de ingreso, no solo entre argumentos de la misma fase.
  async function dispararSugerenciasDeConexion(publicarDeLaAccion = null) {
    const { estado } = contexto;
    const publicar = publicarDeLaAccion ?? contexto.publicar;
    const todosLosArgumentos = Object.values(estado.argumentos);
    if (todosLosArgumentos.length < 2) {
      return;
    }
    try {
      const respuesta = await fetch('/api/groq-sugerir-conexiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argumentos: todosLosArgumentos.map((argumento) => ({ argumentId: argumento.argumentId, texto: argumento.texto })),
        }),
      });
      if (!respuesta.ok) {
        return;
      }
      const { sugerencias } = await respuesta.json();
      // Segunda red, además de la del endpoint: una sugerencia que nombra un argumento
      // inexistente no se puede dibujar como arista ni aceptar, y publicarla solo ensucia el
      // canal y el mapa.
      const idsDeArgumentos = new Set(todosLosArgumentos.map((argumento) => argumento.argumentId));
      const sugerenciasUtilizables = (sugerencias || []).filter(
        (sugerencia) =>
          idsDeArgumentos.has(sugerencia.sourceArgumentId) &&
          idsDeArgumentos.has(sugerencia.targetArgumentId) &&
          sugerencia.sourceArgumentId !== sugerencia.targetArgumentId
      );
      for (const sugerencia of sugerenciasUtilizables) {
        publicar(EVENTOS.CONEXION_SUGERIDA, { suggestionId: generarId('sugerencia'), ronda: 1, ...sugerencia });
      }
    } catch {
      // Sin sugerencias de Groq esta ronda: no bloquea el avance de fase.
    }
  }

  async function cerrarFaseActual() {
    const { estado, publicar } = contexto;
    const faseActual = estado.fase.actual;
    if (!faseActual) {
      return;
    }
    // Se resuelve ANTES del await: mientras Groq responde, el phase.closed de abajo puede
    // volver por el canal y dejar `fase.actual` en null, y entonces el índice deducido del log
    // ya no sería el de la fase que se está cerrando.
    let indiceSiguiente = indiceDeLaFaseMasReciente() + 1;

    publicar(EVENTOS.FASE_CERRADA, { phaseType: faseActual.tipo, ronda: faseActual.ronda });

    const claveDeAnalisis = `sugerencias-groq:${faseActual.tipo}:${faseActual.iniciadaEn}`;
    const esFaseQueDisparaGroq =
      faseActual.tipo === TIPOS_DE_FASE.ESCRITURA_ARGUMENTOS;
    if (esFaseQueDisparaGroq && !yaSeHizo(claveDeAnalisis)) {
      await dispararSugerenciasDeConexion(comenzarAccion(claveDeAnalisis));
    }

    while (
      indiceSiguiente < programa.fases.length &&
      programa.fases[indiceSiguiente].tipo === TIPOS_DE_FASE.CONEXION_SUGERIDA
    ) {
      // El disparo de Groq ya ocurrió automáticamente arriba (ver decisión de diseño #4
      // del plan) — esta entrada de `fases` no necesita su propio phase.started.
      indiceSiguiente += 1;
    }

    if (indiceSiguiente < programa.fases.length) {
      const siguienteFase = programa.fases[indiceSiguiente];
      publicar(EVENTOS.FASE_INICIADA, datosDeInicioDeFase(siguienteFase));
    }
  }

  // Las revisiones (calificar exposiciones, decidir si un aporte cuenta, votar bids) ajustan el
  // puntaje una sola vez, al cerrar: para entonces el moderador ya pudo revisarlas o descartarlas
  // (docs/05). Se publican ANTES de `session.closed`, porque el motor deja de sincronizar apenas la
  // sesión queda cerrada y los ajustes se perderían. Hasta aquí el marcador es provisional. Qué
  // ajustes hay lo decide la actividad.
  function aplicarAjustesDeCierre() {
    const { estado } = contexto;
    const clave = 'evaluaciones-finales';
    if (!estado || yaSeHizo(clave)) {
      return;
    }
    const ajustes = proceso.calcularAjustesAlCierre(estado);
    if (ajustes.length === 0) {
      return;
    }
    const publicar = comenzarAccion(clave);
    const aplicarDelta = crearAcumuladorDePuntaje(estado);
    for (const ajuste of ajustes) {
      publicar(EVENTOS.PUNTAJE_ACTUALIZADO, {
        participantId: ajuste.participantId,
        delta: ajuste.delta,
        categoria: ajuste.categoria,
        motivo: ajuste.motivo,
        nuevoTotal: aplicarDelta(ajuste.participantId, ajuste.delta),
      });
    }
  }

  function cerrarSesion() {
    aplicarAjustesDeCierre();
    contexto.publicar(EVENTOS.SESION_CERRADA, {});
  }

  // Reasigna las posturas de los participantes confirmados de forma intercalada 50/50 entre las
  // posturas activas del Programa (para equilibrar un desbalance monopostura 100%).
  function reasignarRolplayEquilibrado() {
    const confirmados = (contexto.presencia ?? [])
      .filter((p) => p.conectado !== false)
      .filter((p) => contexto.estado?.participantes[p.participantId]?.ingresoConfirmado);

    const posturasActivas = programa.posturas ?? [];
    if (confirmados.length === 0 || posturasActivas.length < 2) {
      return;
    }

    confirmados.forEach((c, index) => {
      const stanceId = posturasActivas[index % posturasActivas.length].id;
      contexto.publicar(EVENTOS.POSTURA_ASIGNADA, {
        participantId: c.participantId,
        stanceId,
        metodo: 'rolplay_rebalanceo',
      });
    });
  }

  function destruir() {
    proceso.destruir?.();
  }

  return {
    sincronizar,
    iniciarSesion,
    cerrarFaseActual,
    cerrarSesion,
    reasignarRolplayEquilibrado,
    designarCoModeradores,
    quitarDesignacionDeCoModeradores,
    ...proceso.acciones,
    destruir,
  };
}
