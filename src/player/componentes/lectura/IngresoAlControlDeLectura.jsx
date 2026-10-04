import { useState } from 'react';
import { EVENTOS } from '../../../shared/eventos/nombresDeEventos.js';
import { AvisoDeIntegridad } from '../../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';
import { resolverNivelDeIntegridad } from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { penalizacionPorPegadoEstaActiva } from '../../../shared/nucleo/integridad/penalizacionPorPegado.js';

// Ingreso al control de lectura: nombre y avatar ya están; aquí solo se confirma la entrada. No hay
// posturas ni argumento previo, y se puede entrar en cualquier momento mientras la escritura siga abierta.
export function IngresoAlControlDeLectura({ programa, participantId, nombre, emoji, publicar }) {
  const [confirmando, setConfirmando] = useState(false);

  function confirmarIngreso() {
    setConfirmando(true);
    publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: null, argumentId: null, nombre, emoji });
  }

  return (
    <section className="tarjeta-de-ingreso">
      <h2>Para entrar al control de lectura</h2>
      <GuiaDeLaConsigna programa={programa} conPartes={false} />
      {programa.instruccionesParaEstudiantes && <p className="texto-de-ayuda">{programa.instruccionesParaEstudiantes}</p>}
      <AvisoDeIntegridad nivel={resolverNivelDeIntegridad(programa)} conDescuento={penalizacionPorPegadoEstaActiva(programa)} />
      <div className="paso-de-ingreso">
        <button type="button" className="boton-exito" disabled={confirmando} onClick={confirmarIngreso}>
          {confirmando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </section>
  );
}
