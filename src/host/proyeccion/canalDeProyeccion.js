// Proyección en una ventana aparte, sin segunda conexión a Ably.
//
// La consola del host es la única que corre el motor de turnos (ver useMotorDeSesion): si la
// ventana del proyector abriera su propia sesión completa habría dos motores publicando eventos
// a la vez. En cambio esa ventana es solo una pantalla: el host le manda su estado ya calculado
// por un BroadcastChannel (mismo navegador, mismo origen) y ella lo dibuja. Cero mensajes extra
// en Ably y cero decisiones duplicadas.
//
// Limitación conocida: solo funciona entre pestañas del mismo navegador, que es justo el caso
// del docente con una laptop y un proyector como segunda pantalla.

import { useEffect, useRef, useState } from 'react';

const MILISEGUNDOS_ENTRE_ENVIOS = 120;
const MILISEGUNDOS_ENTRE_SALUDOS = 1500;

export function nombreDelCanalDeProyeccion(codigoDeSala) {
  return `r2-argumentum-proyeccion:${codigoDeSala}`;
}

export function urlDeLaVentanaDeProyeccion(codigoDeSala) {
  return `${window.location.origin}/host.html?proyeccion=${encodeURIComponent(codigoDeSala)}`;
}

// Devuelve la ventana abierta, o null si el navegador bloqueó la ventana emergente.
export function abrirVentanaDeProyeccion(codigoDeSala) {
  const ventana = window.open(
    urlDeLaVentanaDeProyeccion(codigoDeSala),
    'r2-argumentum-proyeccion',
    'popup=yes,width=1280,height=720'
  );
  return ventana ?? null;
}

// Lado del host: publica el estado cada vez que cambia, y a pedido cuando se abre una ventana.
export function useEmisorDeProyeccion({ codigoDeSala, estado, presencia, programa, conexion }) {
  const canalRef = useRef(null);
  const ultimoPaqueteRef = useRef(null);
  const temporizadorRef = useRef(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return undefined;
    }
    const canal = new BroadcastChannel(nombreDelCanalDeProyeccion(codigoDeSala));
    canalRef.current = canal;
    canal.onmessage = (mensaje) => {
      if (mensaje.data?.tipo === 'hola' && ultimoPaqueteRef.current) {
        canal.postMessage(ultimoPaqueteRef.current);
      }
    };
    return () => {
      canal.close();
      canalRef.current = null;
    };
  }, [codigoDeSala]);

  useEffect(() => {
    ultimoPaqueteRef.current = { tipo: 'estado', estado, presencia, programa, conexion };
    if (temporizadorRef.current) {
      return undefined;
    }
    // Se agrupan los cambios que llegan en ráfaga (un turno publica varios eventos seguidos)
    // para no clonar el estado completo por cada uno.
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;
      try {
        canalRef.current?.postMessage(ultimoPaqueteRef.current);
      } catch (error) {
        // La proyección es un extra: si el estado no se pudo clonar, la consola sigue funcionando.
        console.error('[r2-argumentum] no se pudo enviar el estado a la ventana de proyección', error);
      }
    }, MILISEGUNDOS_ENTRE_ENVIOS);
    return undefined;
  }, [estado, presencia, programa, conexion]);

  useEffect(
    () => () => {
      if (temporizadorRef.current) {
        clearTimeout(temporizadorRef.current);
      }
    },
    []
  );
}

// Lado de la ventana del proyector: pide el estado hasta recibirlo y luego lo va actualizando.
export function useReceptorDeProyeccion(codigoDeSala) {
  const [paquete, setPaquete] = useState(null);
  const [sinSoporte] = useState(() => typeof BroadcastChannel === 'undefined');

  useEffect(() => {
    if (sinSoporte) {
      return undefined;
    }
    const canal = new BroadcastChannel(nombreDelCanalDeProyeccion(codigoDeSala));
    let recibioAlgo = false;
    canal.onmessage = (mensaje) => {
      if (mensaje.data?.tipo === 'estado') {
        recibioAlgo = true;
        setPaquete(mensaje.data);
      }
    };
    canal.postMessage({ tipo: 'hola' });
    // Si el host todavía no tenía la consola lista, se insiste hasta que conteste.
    const intervalo = setInterval(() => {
      if (!recibioAlgo) {
        canal.postMessage({ tipo: 'hola' });
      }
    }, MILISEGUNDOS_ENTRE_SALUDOS);
    return () => {
      clearInterval(intervalo);
      canal.close();
    };
  }, [codigoDeSala, sinSoporte]);

  return { paquete, sinSoporte };
}
