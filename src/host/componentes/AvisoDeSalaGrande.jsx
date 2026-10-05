import { avisoDeSalaGrande } from '../../shared/nucleo/capacidad/avisoDeSalaGrande.js';

// En la sala de espera: avisa al docente cuando hay muchas personas conectadas (ver avisoDeSalaGrande.js).
export function AvisoDeSalaGrande({ presencia = [] }) {
  const conectados = presencia.filter((presente) => presente.conectado !== false && presente.participantId !== 'host').length;
  const aviso = avisoDeSalaGrande(conectados);
  if (!aviso) {
    return null;
  }
  return (
    <div className={`aviso-de-sala-grande aviso-de-sala-grande--${aviso.nivel}`} role="status">
      <p>
        <strong>{aviso.titulo}</strong>
      </p>
      <p className="texto-de-ayuda">{aviso.texto}</p>
    </div>
  );
}
