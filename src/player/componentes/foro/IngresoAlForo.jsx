import { useEffect, useState } from 'react';
import { EVENTOS } from '../../../shared/eventos/nombresDeEventos.js';
import { elegirPosturaMenosRepresentada, verificarCupoDePostura } from '../../../shared/ingreso/reglasDeIngreso.js';
import { AvisoDeIntegridad } from '../../../shared/componentes/foro/AdvertenciaDeIntegridad.jsx';
import { resolverNivelDeIntegridad } from '../../../shared/nucleo/integridad/nivelesDeIntegridad.js';

// Ingreso al foro: nombre y avatar ya están; aquí solo se elige o se recibe la postura. No se
// exige un argumento previo (el foro arranca vacío) y se puede entrar en cualquier momento,
// también con el foro ya abierto.
export function IngresoAlForo({ estado, programa, presencia, participantId, nombre, emoji, publicar }) {
  const posturas = programa.posturas;
  // «Por argumento» necesita un texto para clasificar la postura: en el foro no hay argumento
  // previo, así que se trata como elección libre.
  const asignacionEsAleatoria = (programa.asignacionPostura ?? 'aleatoria') === 'aleatoria';
  const participantesEnLaSala = (presencia ?? [])
    .filter((presente) => presente.conectado !== false)
    .map((presente) => presente.participantId);

  const [stanceElegido, setStanceElegido] = useState(() =>
    asignacionEsAleatoria
      ? elegirPosturaMenosRepresentada(estado, posturas, { participantId, participantesEnLaSala })
      : ''
  );
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState('');

  // Mientras no confirmes, la postura asignada se recalcula con la sala al día.
  useEffect(() => {
    if (!asignacionEsAleatoria || confirmando) {
      return;
    }
    const posturaAlDia = elegirPosturaMenosRepresentada(estado, posturas, { participantId, participantesEnLaSala });
    if (posturaAlDia && posturaAlDia !== stanceElegido) {
      setStanceElegido(posturaAlDia);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignacionEsAleatoria, estado.participantes, posturas, participantesEnLaSala.join(',')]);

  const posturaElegida = posturas.find((postura) => postura.id === stanceElegido);

  function confirmarIngreso() {
    if (asignacionEsAleatoria) {
      const cupo = verificarCupoDePostura(estado, posturas, stanceElegido, { participantId, participantesEnLaSala });
      if (!cupo.permitida) {
        const posturaNueva = posturas.find((postura) => postura.id === cupo.posturaSugerida);
        setStanceElegido(cupo.posturaSugerida);
        setAviso(
          `Mientras esperabas, otras personas confirmaron esa postura. Para que los bandos queden parejos, ahora te toca «${posturaNueva?.etiqueta}». Confirma de nuevo.`
        );
        return;
      }
    }
    setConfirmando(true);
    publicar(EVENTOS.POSTURA_ASIGNADA, {
      participantId,
      stanceId: stanceElegido,
      metodo: asignacionEsAleatoria ? 'aleatoria' : 'libre',
    });
    publicar(EVENTOS.INGRESO_CONFIRMADO, { participantId, stanceId: stanceElegido, argumentId: null, nombre, emoji });
  }

  return (
    <section className="tarjeta-de-ingreso">
      <h2>Para entrar al foro</h2>
      {programa.preguntaGuia && <p className="cita-de-argumento">{programa.preguntaGuia}</p>}
      {programa.instruccionesParaEstudiantes && (
        <p className="texto-de-ayuda">{programa.instruccionesParaEstudiantes}</p>
      )}

      <AvisoDeIntegridad nivel={resolverNivelDeIntegridad(programa)} />

      <div className="paso-de-ingreso">
        <h3>Tu postura</h3>
        {asignacionEsAleatoria ? (
          <p>
            Te toca defender: <strong style={{ color: posturaElegida?.color }}>{posturaElegida?.etiqueta}</strong>
            <br />
            <span className="texto-de-ayuda">
              La asignación es al azar a propósito: defender una postura que no elegiste es parte del ejercicio.
            </span>
          </p>
        ) : (
          <ul className="lista-de-posturas-para-elegir">
            {posturas.map((postura) => (
              <li key={postura.id}>
                <button
                  type="button"
                  style={{ borderColor: stanceElegido === postura.id ? postura.color : undefined }}
                  onClick={() => {
                    setStanceElegido(postura.id);
                    setAviso('');
                  }}
                >
                  {postura.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {aviso && <p className="mensaje-de-error">{aviso}</p>}

      <div className="paso-de-ingreso">
        <button type="button" className="boton-exito" disabled={confirmando || !stanceElegido} onClick={confirmarIngreso}>
          {confirmando ? 'Entrando…' : 'Entrar al foro'}
        </button>
      </div>
    </section>
  );
}
