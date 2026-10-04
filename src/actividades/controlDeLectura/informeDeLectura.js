// Informe del control de lectura — ver docs/14-control-de-lectura.md.
//
// Lo arma el host con su estado privado (texto, niveles y nota de cada entrega) y lo descarga el docente.
// La nota aparece AQUÍ y solo aquí: nunca viaja a la sala ni a los estudiantes. Funciones puras.

import { DECISIONES_DE_CONFIRMACION } from '../../shared/eventos/nombresDeEventos.js';
import { resolverEstructuraDelPrograma, resolverNumeroDeParrafos } from '../../shared/nucleo/escritura/estructurasDeEscritura.js';
import { resolverIdiomaDelDebate } from '../../shared/programa/idiomaDelDebate.js';
import { ESTADOS_DE_CALIFICACION, construirColaDelDocente } from '../../shared/nucleo/entregas/estadoPrivadoDelDocente.js';
import { etiquetaDelNivel, resolverRubricaDelPrograma } from '../../shared/nucleo/rubrica/rubrica.js';
import { hayAlgoQueRevisar } from '../../shared/nucleo/entregas/integridadDeLasEntregas.js';
import { resolverUmbralesDeSimilitud } from '../../shared/nucleo/integridad/similitudDeTextos.js';

export const ESTADOS_DE_LA_ENTREGA = {
  SIN_ENTREGA: 'sin_entrega',
  ENTREGADA: 'entregada',
  ENVIADA_POR_TIEMPO: 'enviada_por_tiempo',
};

const ETIQUETA_DE_CONFIRMACION = {
  [DECISIONES_DE_CONFIRMACION.DE_ACUERDO]: 'De acuerdo',
  [DECISIONES_DE_CONFIRMACION.EN_DESACUERDO]: 'En desacuerdo',
  [DECISIONES_DE_CONFIRMACION.AUTOMATICA]: 'Confirmada sola (sin responder)',
};

function nombreSinEmoji(presencia, participantId) {
  return presencia.find((presente) => presente.participantId === participantId)?.nombre ?? participantId;
}

export function construirInformeDeLectura({ estado, estadoPrivado, programa, presencia = [] }) {
  const programaVigente = estado.programa ?? programa;
  const rubrica = resolverRubricaDelPrograma(programaVigente);
  const idioma = resolverIdiomaDelDebate(programaVigente);
  const cola = construirColaDelDocente({ estadoPrivado, estado, rubrica });
  const colaPorParticipante = Object.fromEntries(cola.map((item) => [item.participantId, item]));

  const personas = Object.values(estado.participantes)
    .filter((participante) => participante.ingresoConfirmado)
    .map((participante) => {
      const item = colaPorParticipante[participante.participantId] ?? null;
      const calificada = item?.estadoDeCalificacion === ESTADOS_DE_CALIFICACION.APROBADA;
      return {
        participantId: participante.participantId,
        nombre: nombreSinEmoji(presencia, participante.participantId),
        estadoDeLaEntrega: !item
          ? ESTADOS_DE_LA_ENTREGA.SIN_ENTREGA
          : item.enviadaPorTiempo
            ? ESTADOS_DE_LA_ENTREGA.ENVIADA_POR_TIEMPO
            : ESTADOS_DE_LA_ENTREGA.ENTREGADA,
        palabras: item?.palabras ?? 0,
        parrafos: item?.parrafos ?? 0,
        texto: item?.texto ?? null,
        estadoDeLaCalificacion: item?.estadoDeCalificacion ?? ESTADOS_DE_CALIFICACION.SIN_CALIFICAR,
        // Un borrador del docente no es una nota: solo cuenta la calificación aprobada. Con descuento por
        // integridad, la nota final es la de la rúbrica menos lo que el docente decidió descontar.
        nota: calificada ? item.nota : null,
        notaDeLaRubrica: calificada ? item.notaDeLaRubrica : null,
        descuentoPorIntegridad: calificada ? item.descuentoDeIntegridad : 0,
        niveles: calificada ? item.calificacion.niveles : {},
        comentariosPorCriterio: calificada ? item.calificacion.comentariosPorCriterio : {},
        comentarioGeneral: calificada ? item.calificacion.comentarioGeneral : '',
        devuelta: Boolean(item?.devuelta),
        confirmacion: item?.confirmacion?.decision ?? null,
        motivoDeDesacuerdo: item?.motivoDeDesacuerdo ?? '',
        reconsideracion: item?.reconsideracion?.resultado ?? null,
      };
    })
    .sort((personaA, personaB) => personaA.nombre.localeCompare(personaB.nombre));

  const notas = personas.map((persona) => persona.nota).filter((nota) => nota !== null);

  return {
    exportadoEn: new Date().toISOString(),
    confidencial: true,
    aviso: 'Este informe contiene notas y textos de estudiantes: solo para el docente.',
    actividad: 'control_de_lectura',
    programa: { programId: programaVigente.programId, titulo: programaVigente.titulo },
    consigna: programaVigente.consigna,
    estructura: resolverEstructuraDelPrograma(programaVigente, idioma).nombre,
    numeroDeParrafos: resolverNumeroDeParrafos(programaVigente, idioma),
    idioma,
    rubrica: rubrica.map((criterio) => ({ id: criterio.id, nombre: criterio.nombre, peso: criterio.peso })),
    resumen: {
      participantes: personas.length,
      entregaron: personas.filter((persona) => persona.estadoDeLaEntrega !== ESTADOS_DE_LA_ENTREGA.SIN_ENTREGA).length,
      calificadas: notas.length,
      promedio: notas.length > 0 ? Math.round((notas.reduce((suma, nota) => suma + nota, 0) / notas.length) * 100) / 100 : null,
    },
    personas,
    podio: (estado.lectura?.podio ?? []).map((lugar) => ({
      lugar: lugar.lugar,
      participantes: lugar.participantIds.map((participantId) => nombreSinEmoji(presencia, participantId)),
    })),
  };
}

function celdaCsv(valor) {
  const texto = String(valor ?? '');
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Una fila por persona, lista para abrir en una hoja de cálculo. Los niveles de cada criterio van como
// texto (Excelente, Bueno…) y la nota sobre 10.
export function construirCsvDeLectura(informe) {
  const encabezados = [
    'Nombre',
    'Entrega',
    'Calificación',
    'Nota sobre 10',
    'Descuento por integridad',
    ...informe.rubrica.map((criterio) => criterio.nombre),
    'Palabras',
    'Párrafos',
    'Devuelta',
    'Respuesta del estudiante',
    'Motivo del desacuerdo',
    'Comentario general',
  ];
  const etiquetaDeEntrega = {
    [ESTADOS_DE_LA_ENTREGA.SIN_ENTREGA]: 'Sin entrega',
    [ESTADOS_DE_LA_ENTREGA.ENTREGADA]: 'Entregada',
    [ESTADOS_DE_LA_ENTREGA.ENVIADA_POR_TIEMPO]: 'Enviada al terminar el tiempo',
  };
  const etiquetaDeCalificacion = {
    [ESTADOS_DE_CALIFICACION.SIN_CALIFICAR]: 'Sin calificar',
    [ESTADOS_DE_CALIFICACION.BORRADOR]: 'En borrador',
    [ESTADOS_DE_CALIFICACION.APROBADA]: 'Aprobada',
  };
  const filas = informe.personas.map((persona) => [
    persona.nombre,
    etiquetaDeEntrega[persona.estadoDeLaEntrega],
    etiquetaDeCalificacion[persona.estadoDeLaCalificacion],
    persona.nota ?? '',
    persona.descuentoPorIntegridad > 0 ? persona.descuentoPorIntegridad : '',
    ...informe.rubrica.map((criterio) => (persona.niveles[criterio.id] ? etiquetaDelNivel(persona.niveles[criterio.id]) : '')),
    persona.palabras,
    persona.parrafos,
    persona.devuelta ? 'Sí' : 'No',
    persona.confirmacion ? ETIQUETA_DE_CONFIRMACION[persona.confirmacion] : '',
    persona.motivoDeDesacuerdo,
    persona.comentarioGeneral,
  ]);
  // El BOM al inicio hace que Excel abra el archivo en UTF-8 (tildes y ñ).
  return `﻿${[encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(',')).join('\r\n')}\r\n`;
}

// Las advertencias de integridad son confidenciales y van en su propio archivo, aparte del informe general
// (que se comparte o se proyecta con más facilidad). No son pruebas: el dictado por voz, el autocorrector y
// el celular pueden generar señales, y con la misma consigna los textos cortos se parecen.
export function construirAnexoDeIntegridadDeLectura({ estado, cola, integridadPorEntrega, programa, presencia = [] }) {
  const programaVigente = estado.programa ?? programa;
  return {
    exportadoEn: new Date().toISOString(),
    confidencial: true,
    advertencia:
      'Son señales que ayudan a revisar, no pruebas de nada: el dictado por voz, el autocorrector y el uso del celular pueden generarlas, y con la misma consigna los textos cortos se parecen. Decide con criterio y conversa con la persona antes de actuar.',
    actividad: 'control_de_lectura',
    programa: { programId: programaVigente.programId, titulo: programaVigente.titulo },
    umbralesDeSimilitud: resolverUmbralesDeSimilitud(programa),
    personas: cola
      .filter((item) => hayAlgoQueRevisar(integridadPorEntrega[item.participantId]) || item.decisionDeIntegridad)
      .map((item) => ({
        participantId: item.participantId,
        nombre: nombreSinEmoji(presencia, item.participantId),
        codigoAnonimo: item.etiqueta,
        banda: integridadPorEntrega[item.participantId]?.banda ?? null,
        similitud: integridadPorEntrega[item.participantId]?.similitud ?? null,
        senales: integridadPorEntrega[item.participantId]?.senales ?? [],
        decisionDelDocente: item.decisionDeIntegridad,
        descuentoAplicado: item.descuentoDeIntegridad,
      })),
  };
}
