import { useEffect, useState } from 'react';
import { calcularInstruccionesDelParticipante } from '../instrucciones/calcularInstrucciones.js';

// Bloque siempre visible que responde, en todo momento, "¿qué está pasando y qué tengo que
// hacer?" (ver docs/07). En vertical queda pegado arriba y se colapsa a una línea al scrollear,
// porque las tres capas fijas se comerían media pantalla de un celular. La línea colapsada
// muestra lo más urgente: TIENES QUE → AHORA.
//
// `soloLectura` lo usa la vista espejo del moderador: mismo cálculo, otro participantId.
export function CapaInstruccional({ estado, presencia, participantId, soloLectura = false }) {
  const [colapsada, setColapsada] = useState(false);
  const [expandidaAMano, setExpandidaAMano] = useState(false);

  useEffect(() => {
    if (soloLectura) {
      return undefined;
    }
    // Se escucha en captura sobre el documento y no solo en `window`: según el alto de la
    // pantalla, lo que scrollea puede ser la ventana o un contenedor interno, y en ese caso el
    // evento nunca llegaba a `window`. Al volver arriba también se suelta la expansión manual,
    // que si no quedaba pegada para el resto de la sesión.
    function alScrollear(evento) {
      const contenedor = evento.target;
      const desplazamiento =
        contenedor && contenedor !== document && contenedor !== document.documentElement && contenedor !== document.body
          ? contenedor.scrollTop ?? window.scrollY
          : window.scrollY;
      const estaArriba = desplazamiento <= 120;
      setColapsada(!estaArriba);
      if (estaArriba) {
        setExpandidaAMano(false);
      }
    }
    document.addEventListener('scroll', alScrollear, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', alScrollear, { capture: true });
  }, [soloLectura]);

  const instrucciones = calcularInstruccionesDelParticipante(estado, participantId, presencia);
  const mostrarCompacta = colapsada && !expandidaAMano && !soloLectura;

  if (mostrarCompacta) {
    const urgente = instrucciones.tienesQue;
    return (
      <div
        className={`capa-instruccional capa-compacta ${urgente ? 'capa-con-pendiente' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => setExpandidaAMano(true)}
        onKeyDown={(evento) => evento.key === 'Enter' && setExpandidaAMano(true)}
      >
        <span>{urgente ? `⚠️ ${urgente.texto}` : instrucciones.ahora}</span>
      </div>
    );
  }

  return (
    <div
      className={`capa-instruccional ${soloLectura ? 'capa-espejo' : ''}`}
      onClick={() => setExpandidaAMano(false)}
    >
      <div className="bloque-instruccional">
        <p className="etiqueta-instruccional">Ahora</p>
        <p className="texto-instruccional">{instrucciones.ahora}</p>
      </div>

      {instrucciones.puedes.length > 0 && (
        <div className="bloque-instruccional">
          <p className="etiqueta-instruccional">Puedes</p>
          <ul className="lista-instruccional">
            {instrucciones.puedes.map((accion) => (
              <li key={accion}>{accion}</li>
            ))}
          </ul>
        </div>
      )}

      {instrucciones.tienesQue && (
        <div className="bloque-instruccional bloque-obligatorio">
          <p className="etiqueta-instruccional">Tienes que ⚠️</p>
          <p className="texto-instruccional">{instrucciones.tienesQue.texto}</p>
          {instrucciones.tienesQue.consecuencia && (
            <p className="consecuencia-instruccional">{instrucciones.tienesQue.consecuencia}</p>
          )}
        </div>
      )}
    </div>
  );
}
