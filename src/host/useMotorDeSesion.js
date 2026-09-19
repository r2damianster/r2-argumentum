import { useEffect, useRef } from 'react';
import { crearMotorDeSesion } from './motorDeSesion.js';

const MILISEGUNDOS_ENTRE_LATIDOS = 5000;

export function useMotorDeSesion({ estado, presencia, publicar, programa }) {
  const motorRef = useRef(null);
  if (!motorRef.current) {
    motorRef.current = crearMotorDeSesion({ programa });
  }

  // El latido necesita el estado más reciente sin volver a crear el intervalo en cada render.
  const contextoRef = useRef({ estado, presencia, publicar });
  contextoRef.current = { estado, presencia, publicar };

  useEffect(() => {
    motorRef.current.sincronizar(contextoRef.current);
  });

  // Hay decisiones del motor que dependen del reloj y no de un evento nuevo del canal — por
  // ejemplo la espera antes de ofrecer el turno hablado de respaldo (ver motorDeSesion.js).
  // Sin este latido, un canal en silencio no produce re-render, el motor nunca vuelve a
  // mirar y el debate queda esperando para siempre.
  useEffect(() => {
    const intervalo = setInterval(
      () => motorRef.current.sincronizar(contextoRef.current),
      MILISEGUNDOS_ENTRE_LATIDOS
    );
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const motor = motorRef.current;
    return () => motor.destruir();
  }, []);

  return motorRef.current;
}
