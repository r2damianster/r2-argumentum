import { avisoDeSalaGrande } from '../../shared/nucleo/capacidad/avisoDeSalaGrande.js';
import { describirElModoDeAhorro } from '../../shared/nucleo/capacidad/modosDeAhorro.js';

// En la sala de espera: avisa al docente cuando hay muchas personas conectadas (ver avisoDeSalaGrande.js) y qué modo de
// ahorro rige (ver modosDeAhorro.js).
export function AvisoDeSalaGrande({ presencia = [], estado = null, programa = null }) {
  // En el modo masivo nadie entra a la presencia: se cuenta también a quienes ya ingresaron en el estado de la sesión.
  const enPresencia = presencia.filter((presente) => presente.conectado !== false && presente.participantId !== 'host').length;
  const ingresaron = Object.values(estado?.participantes ?? {}).filter((participante) => participante.ingresoConfirmado).length;
  const conectados = Math.max(enPresencia, ingresaron);
  const aviso = avisoDeSalaGrande(conectados);
  const modo = describirElModoDeAhorro({ programa, conectados });
  if (!aviso && !modo) {
    return null;
  }
  const nivel = aviso?.nivel ?? (modo.conviene ? 'atencion' : 'informativo');
  return (
    <div className={`aviso-de-sala-grande aviso-de-sala-grande--${nivel}`} role="status">
      {aviso && (
        <>
          <p>
            <strong>{aviso.titulo}</strong>
          </p>
          <p className="texto-de-ayuda">{aviso.texto}</p>
        </>
      )}
      {modo && <p className="texto-de-ayuda">{modo.texto}</p>}
    </div>
  );
}
