import { ESTADOS_DE_CONEXION } from '../estado/useEstadoDeSesion.js';

// Barra de estado de la conexión con el canal. Existe por un caso concreto de aula: un celular
// que se bloquea o una pestaña que queda en segundo plano unos minutos pierde la conexión, y
// Ably solo reenvía lo perdido si la vuelta ocurre dentro de su ventana de recuperación. Más
// allá de eso el cliente se reengancha y sigue recibiendo lo nuevo sin avisar que hubo un
// hueco: esa persona seguía el debate con menos argumentos y menos puntos que el resto, sin
// ninguna señal en pantalla. Callarlo es peor que mostrarlo.
export function AvisoDeConexion({ conexion }) {
  if (!conexion) {
    return null;
  }

  if (conexion.estado === ESTADOS_DE_CONEXION.RECONECTANDO) {
    return (
      <p className="aviso-de-conexion aviso-de-conexion-caida">
        📡 Se cortó la conexión con la sala. Reintentando… No cierres esta pestaña.
      </p>
    );
  }

  if (conexion.estado === ESTADOS_DE_CONEXION.RECUPERANDO) {
    return <p className="aviso-de-conexion">🔄 Conexión recuperada, poniéndote al día…</p>;
  }

  if (conexion.huecoEnElHistorial) {
    return (
      <p className="aviso-de-conexion aviso-de-conexion-incompleta">
        ⚠️ Estuviste desconectado más tiempo del que la sala guarda: puede faltar parte de lo que pasó mientras
        tanto. Lo que siga ocurriendo sí se ve normalmente.
      </p>
    );
  }

  return null;
}
