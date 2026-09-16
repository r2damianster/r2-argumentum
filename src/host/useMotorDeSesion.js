import { useEffect, useRef } from 'react';
import { crearMotorDeSesion } from './motorDeSesion.js';

export function useMotorDeSesion({ estado, presencia, publicar, programa }) {
  const motorRef = useRef(null);
  if (!motorRef.current) {
    motorRef.current = crearMotorDeSesion({ programa });
  }

  useEffect(() => {
    motorRef.current.sincronizar({ estado, presencia, publicar });
  });

  useEffect(() => {
    const motor = motorRef.current;
    return () => motor.destruir();
  }, []);

  return motorRef.current;
}
