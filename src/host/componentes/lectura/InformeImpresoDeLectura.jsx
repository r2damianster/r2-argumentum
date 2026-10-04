import { construirInformeDeLectura } from '../../../actividades/controlDeLectura/informeDeLectura.js';
import { DECISIONES_DE_CONFIRMACION } from '../../../shared/eventos/nombresDeEventos.js';
import { imprimirInformeComoPDF } from '../../imprimirInforme.js';

const ETIQUETA_DE_LA_ENTREGA = {
  sin_entrega: 'Sin entrega',
  entregada: 'Entregada',
  enviada_por_tiempo: 'Enviada al terminar el tiempo',
};

const ETIQUETA_DE_LA_RESPUESTA = {
  [DECISIONES_DE_CONFIRMACION.DE_ACUERDO]: 'De acuerdo',
  [DECISIONES_DE_CONFIRMACION.EN_DESACUERDO]: 'En desacuerdo',
  [DECISIONES_DE_CONFIRMACION.AUTOMATICA]: 'Sin responder (confirmada sola)',
};

// El resumen de notas del control de lectura, en pantalla y listo para «Guardar como PDF» (misma técnica que
// el informe del debate: el diálogo de impresión del navegador, sin librerías). Trae notas: es solo para el
// docente y nunca se proyecta (la proyección es otra vista).
export function InformeImpresoDeLectura({ estado, estadoPrivado, programa, presencia }) {
  const informe = construirInformeDeLectura({ estado, estadoPrivado, programa, presencia });

  return (
    <section className="informe-impreso-de-lectura">
      <div className="acciones-del-informe">
        <button type="button" className="boton-primario" onClick={() => imprimirInformeComoPDF(informe.programa.titulo)}>
          🖨️ Resumen de notas (PDF)
        </button>
      </div>
      <h3>{informe.programa.titulo}</h3>
      <p>{informe.consigna}</p>
      <p className="texto-de-ayuda">
        {informe.estructura} · {informe.numeroDeParrafos} párrafo(s) · {informe.resumen.entregaron} de {informe.resumen.participantes}{' '}
        entregaron · {informe.resumen.calificadas} calificadas
        {informe.resumen.promedio !== null ? ` · promedio ${informe.resumen.promedio}` : ''} · {informe.exportadoEn.slice(0, 10)}
      </p>
      <table className="tabla-de-notas-de-lectura">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Entrega</th>
            <th>Nota / 10</th>
            <th>Respuesta a la devolución</th>
          </tr>
        </thead>
        <tbody>
          {informe.personas.map((persona) => (
            <tr key={persona.participantId}>
              <td>{persona.nombre}</td>
              <td>{ETIQUETA_DE_LA_ENTREGA[persona.estadoDeLaEntrega]}</td>
              <td>
                {persona.nota ?? '—'}
                {persona.descuentoPorIntegridad > 0 ? ` (−${persona.descuentoPorIntegridad})` : ''}
              </td>
              <td>{persona.confirmacion ? ETIQUETA_DE_LA_RESPUESTA[persona.confirmacion] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="texto-de-ayuda">Confidencial: contiene notas. Solo para el docente.</p>
    </section>
  );
}
