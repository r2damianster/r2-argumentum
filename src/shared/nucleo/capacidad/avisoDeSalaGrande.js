// Aviso al docente cuando la sala es grande. La prueba de carga del 4-oct-2026 (docs/06-pendientes.md) mostró que
// con 40 personas todo funciona sin cambios y que desde ~80 el servicio de mensajes (Ably, plan gratuito) puede
// rechazar parte de los envíos simultáneos y la IA (Groq, plan gratuito, ~8.000 tokens por minuto) alcanza su límite.
// La plataforma se defiende sola (reintentos, envío escalonado, cola de Groq en pausa), pero el docente tiene que
// saber qué esperar. Función pura.

export const PERSONAS_DESDE_LAS_QUE_SE_AVISA = 60;
export const PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_DIVIDIR = 150;

export function avisoDeSalaGrande(numeroDePersonas) {
  const personas = Math.max(0, Math.floor(Number(numeroDePersonas) || 0));
  if (personas >= PERSONAS_DESDE_LAS_QUE_SE_RECOMIENDA_DIVIDIR) {
    return {
      nivel: 'alta',
      titulo: `Sala muy grande (${personas} conectados)`,
      texto:
        'Con tantas personas es probable que parte de los envíos simultáneos tarde o se pierda, y que casi ninguna entrega reciba sugerencia de la IA en el plan gratuito. Conviene dividir al grupo en varias salas de unas 40 a 60 personas, cada una con su código, o calificar a mano.',
    };
  }
  if (personas >= PERSONAS_DESDE_LAS_QUE_SE_AVISA) {
    return {
      nivel: 'atencion',
      titulo: `Sala grande (${personas} conectados)`,
      texto:
        'La plataforma escalona los envíos y reintenta sola, pero el servicio de mensajes y la IA tienen límites por segundo y por minuto: puede haber retrasos de unos segundos y las sugerencias de calificación llegarán despacio (algunas entregas las calificarás a mano).',
    };
  }
  return null;
}
