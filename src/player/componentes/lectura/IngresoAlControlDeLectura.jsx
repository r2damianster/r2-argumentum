import { useState } from 'react';
import { EVENTOS } from '../../../shared/eventos/nombresDeEventos.js';
import { EVENTOS_PRIVADOS } from '../../../shared/nucleo/entregas/canalesPrivados.js';
import { perfilDeAhorro } from '../../../shared/nucleo/capacidad/modosDeAhorro.js';
import { AvisoDeIntegridad } from '../../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { GuiaDeLaConsigna } from '../../../shared/componentes/lectura/GuiaDeLaConsigna.jsx';
import { MuestraPedagogicaDeLaEstructura } from '../../../shared/componentes/lectura/MuestraPedagogicaDeLaEstructura.jsx';
import { resolverIdiomaDelDebate } from '../../../shared/programa/idiomaDelDebate.js';
import { resolverNivelDeIntegridad } from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';
import { penalizacionPorPegadoEstaActiva } from '../../../shared/nucleo/integridad/penalizacionPorPegado.js';

// Ingreso al control de lectura: nombre y avatar ya están; aquí solo se confirma la entrada. No hay
// posturas ni argumento previo, y se puede entrar en cualquier momento mientras la escritura siga abierta.
export function IngresoAlControlDeLectura({ estado, programa, participantId, nombre, emoji, publicar, publicarEntregaPrivada }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const ingresoPrivado = perfilDeAhorro({ programa, estado }).ingreso === 'privado';

  async function confirmarIngreso() {
    setConfirmando(true);
    setError('');
    if (!ingresoPrivado) {
      publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: null, argumentId: null, nombre, emoji });
      return;
    }
    // Modo masivo: nada se publica en la sala. El ingreso va por el canal privado y el host lo anuncia en lote, así que
    // la pantalla cambia unos segundos después.
    try {
      await publicarEntregaPrivada(EVENTOS_PRIVADOS.ENTREGA_INGRESO, { nombre, emoji });
    } catch (fallo) {
      console.warn('[r2-argumentum] no se pudo enviar el ingreso', fallo);
      setError('No se pudo entrar. Revisa tu conexión y vuelve a intentarlo.');
      setConfirmando(false);
    }
  }

  return (
    <section className="tarjeta-de-ingreso">
      <h2>Para entrar al control de lectura</h2>
      <GuiaDeLaConsigna programa={programa} conPartes={false} />
      <MuestraPedagogicaDeLaEstructura programa={programa} idioma={resolverIdiomaDelDebate(programa)} />
      {programa.instruccionesParaEstudiantes && <p className="texto-de-ayuda">{programa.instruccionesParaEstudiantes}</p>}
      <AvisoDeIntegridad nivel={resolverNivelDeIntegridad(programa)} conDescuento={penalizacionPorPegadoEstaActiva(programa)} />
      <div className="paso-de-ingreso">
        <button type="button" className="boton-exito" disabled={confirmando} onClick={confirmarIngreso}>
          {confirmando ? 'Entrando…' : 'Entrar'}
        </button>
        {confirmando && ingresoPrivado && <p className="texto-de-ayuda">Tu docente te deja pasar en unos segundos.</p>}
        {error && <p className="mensaje-de-error">{error}</p>}
      </div>
    </section>
  );
}
