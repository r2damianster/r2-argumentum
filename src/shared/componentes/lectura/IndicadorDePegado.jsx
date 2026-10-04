import { colorDelIndicadorDePegado } from '../../nucleo/integridad/penalizacionPorPegado.js';

// Lo que ve quien escribe APENAS pega texto: un aviso y un color de verde a rojo. Nunca un número ni el
// descuento (docs/14-control-de-lectura.md). Borrar lo pegado baja el color pero no lo devuelve a verde:
// queda un porcentaje del antecedente.
export function IndicadorDePegado({ proporcion, activo = true }) {
  if (!activo || !(proporcion > 0)) {
    return null;
  }
  const color = colorDelIndicadorDePegado(proporcion);
  return (
    <div className="indicador-de-pegado" role="status" aria-live="polite" style={{ borderColor: color }}>
      <span className="indicador-de-pegado-color" style={{ background: color }} aria-hidden="true" />
      <p>
        <strong>Detectamos texto pegado.</strong> Escribe con tus propias palabras: pegar descuenta puntos de tu nota. Si lo borras,
        el aviso baja pero no desaparece.
      </p>
    </div>
  );
}
