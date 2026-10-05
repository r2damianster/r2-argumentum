// Prueba de CARGA, EN LOCAL, con Ably y Groq reales (4-oct-2026). No usa navegador: clientes de Ably sin interfaz.
//
//   node scripts/prueba-e2e/carga-ably-y-groq.mjs [--clientes=200] [--groq=40] [--solo=ably|groq] [--mitigaciones]
//
// Con --mitigaciones los clientes simulados usan lo mismo que la app desde el 4-oct-2026: publican con
// `publicarConReintentos` (reintento con espera aleatoria ante 42913/42917) y, en la ráfaga C, escalonan el envío con
// `esperaAleatoriaDelEnvioMs` (src/shared/ably/ y src/shared/nucleo/entregas/). Sin la bandera se mide el comportamiento
// sin mitigar, para comparar. Para la cola de Groq no hace falta bandera: la pausa por 429 está en la app.
//
// Necesita ABLY_API_KEY y GROQ_API_KEY en .env.local. Usa canales propios (`debate:sala:carga-…`), nunca los de una
// sala real. OJO: abre hasta N conexiones de Ably a la vez y gasta mensajes de la cuota mensual (con 200 clientes,
// unos 130.000 entregas). Si usas la misma cuenta de Ably en producción, no la corras durante una clase.
//
// Qué mide:
//   Con --masivo se mide además el modo masivo (docs/06-pendientes.md): los clientes NO publican en la sala; mandan su ingreso
//   y su texto por REST a un canal que lee solo el host, y un «host» simulado anuncia lo nuevo en lote cada 5 s. Se
//   comprueba que cada cliente recibe todos los anuncios y se cuentan las entregas de mensaje (comparar con A y C).
//   Con --solomasivo se corre solo ese escenario (sin A, B, C).
//   Con --presencia se mide además el costo de la presencia (cada cliente entra y se suscribe a la de los demás),
//   para decidir si conviene que solo el host la observe (docs/06-pendientes.md).
//   Ably: cuántas conexiones se sostienen (rampa) y, con ese número de clientes, tres patrones de tráfico:
//     A «lectura»: cada cliente publica 1 evento en la sala y 1 texto en un canal privado (repartidos en 10 s).
//     B «foro»:    cada cliente publica 3 posts en la sala (repartidos en 30 s). Cada post lo reciben todos.
//     C «ráfaga»:  todos publican a la vez (lo que pasa cuando vence el tiempo y se envían todos los borradores).
//   Groq: límites que informa la cuenta (cabeceras), una ráfaga de N peticiones de ~2.000 tokens sin reintentos
//   (cuántas dan 429) y la misma carga con la concurrencia de la app (2 a la vez).
import { readFileSync } from 'node:fs';
import Ably from 'ably';
import { publicarConReintentos } from '../../src/shared/ably/reintentarPublicacion.js';
import { esperaAleatoriaDelEnvioMs, ventanaDelEscalonadoMs } from '../../src/shared/nucleo/entregas/escalonadoDelEnvio.js';

const argumentos = Object.fromEntries(
  process.argv.slice(2).map((texto) => {
    const [clave, valor] = texto.replace(/^--/, '').split('=');
    return [clave, valor ?? true];
  })
);
const MAXIMO_DE_CLIENTES = Number(argumentos.clientes ?? 200);
const PETICIONES_A_GROQ = Number(argumentos.groq ?? 40);
const SOLO = argumentos.solo ?? null;
const CON_MITIGACIONES = Boolean(argumentos.mitigaciones);
const CON_PRESENCIA = Boolean(argumentos.presencia);
const SOLO_MASIVO = Boolean(argumentos.solomasivo);
const CON_MASIVO = Boolean(argumentos.masivo) || SOLO_MASIVO;

for (const linea of readFileSync(new URL('../../.env.local', import.meta.url), 'utf-8').split(/\r?\n/)) {
  const coincidencia = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (coincidencia && !(coincidencia[1] in process.env)) {
    process.env[coincidencia[1]] = coincidencia[2].replace(/^"|"$/g, '');
  }
}

const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));
const percentil = (valores, proporcion) => {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.floor(proporcion * ordenados.length))];
};
const resumirLatencias = (latencias) =>
  latencias.length
    ? `p50 ${percentil(latencias, 0.5)} ms · p95 ${percentil(latencias, 0.95)} ms · máx ${Math.max(...latencias)} ms`
    : 'sin datos';
const titulo = (texto) => console.log(`\n=== ${texto}`);

// ------------------------------------------------------------------------------------------------ Ably
async function pruebaDeAbly() {
  const identificadorDeLaCarga = `carga-${Date.now().toString(36)}`;
  const canalDeLaSala = `debate:sala:${identificadorDeLaCarga}`;
  const canalDeLasEntregas = `debate:entrega:${identificadorDeLaCarga}`;
  const clientes = [];
  const erroresDeConexion = [];

  titulo(`Ably · rampa de conexiones hasta ${MAXIMO_DE_CLIENTES}`);
  const etapas = [25, 50, 100, 150, 200, 300, 500].filter((numero) => numero <= MAXIMO_DE_CLIENTES);
  if (etapas[etapas.length - 1] !== MAXIMO_DE_CLIENTES) etapas.push(MAXIMO_DE_CLIENTES);

  async function conectarUno(indice) {
    const cliente = new Ably.Realtime({ key: process.env.ABLY_API_KEY, clientId: `p-carga-${indice}`, autoConnect: true });
    const inicio = Date.now();
    await new Promise((resolver) => {
      const limite = setTimeout(() => {
        erroresDeConexion.push({ indice, motivo: 'tiempo agotado (10 s)' });
        resolver();
      }, 10000);
      cliente.connection.once('connected', () => {
        clearTimeout(limite);
        resolver();
      });
      cliente.connection.once('failed', (cambio) => {
        clearTimeout(limite);
        erroresDeConexion.push({ indice, motivo: cambio.reason?.message ?? 'failed', codigo: cambio.reason?.code });
        resolver();
      });
    });
    return { cliente, indice, msConexion: Date.now() - inicio };
  }

  let siguienteIndice = 0;
  for (const meta of etapas) {
    const nuevos = [];
    while (siguienteIndice < meta) {
      nuevos.push(conectarUno(siguienteIndice));
      siguienteIndice += 1;
      if (nuevos.length % 25 === 0) await esperar(300);
    }
    const resultados = await Promise.all(nuevos);
    clientes.push(...resultados);
    const conectados = clientes.filter(({ cliente }) => cliente.connection.state === 'connected').length;
    const tiempos = resultados.map((resultado) => resultado.msConexion);
    console.log(`  ${meta} pedidos → ${conectados} conectados · conexión ${resumirLatencias(tiempos)} · errores ${erroresDeConexion.length}`);
    if (conectados < meta) {
      console.log(`  ✋ La rampa se detiene: no se sostienen más de ${conectados} conexiones.`);
      console.log('  Primeros errores:', JSON.stringify(erroresDeConexion.slice(0, 3)));
      break;
    }
  }

  const activos = clientes.filter(({ cliente }) => cliente.connection.state === 'connected');
  const totalActivos = activos.length;
  console.log(`  Clientes activos para los patrones de tráfico: ${totalActivos}`);
  if (totalActivos < 3) return;

  // Todos escuchan la sala; el primero hace de host y escucha también el canal de entregas.
  const recibidos = new Map(); // clientId → latencias de lo recibido
  const erroresDePublicacion = [];
  let recibidoPorElHost = 0;
  const latenciasDelHost = [];
  for (const { cliente, indice } of activos) {
    const latencias = [];
    recibidos.set(indice, latencias);
    await cliente.channels.get(canalDeLaSala).subscribe((mensaje) => {
      latencias.push(Date.now() - mensaje.data.t);
    });
  }
  await activos[0].cliente.channels.get(canalDeLasEntregas).subscribe((mensaje) => {
    recibidoPorElHost += 1;
    latenciasDelHost.push(Date.now() - mensaje.data.t);
  });

  let reintentosHechos = 0;
  async function publicar(cliente, nombreDelCanal, nombre, datos) {
    try {
      const publicarUnaVez = () => cliente.channels.get(nombreDelCanal).publish(nombre, { ...datos, t: Date.now() });
      if (CON_MITIGACIONES) {
        await publicarConReintentos(async () => {
          try {
            return await publicarUnaVez();
          } catch (error) {
            reintentosHechos += 1;
            throw error;
          }
        });
      } else {
        await publicarUnaVez();
      }
    } catch (error) {
      erroresDePublicacion.push(`${error.code ?? ''} ${error.message}`.trim());
    }
  }
  const reiniciarMedicion = () => {
    for (const latencias of recibidos.values()) latencias.length = 0;
    latenciasDelHost.length = 0;
    recibidoPorElHost = 0;
    erroresDePublicacion.length = 0;
    reintentosHechos = 0;
  };
  function informe(nombre, publicadosEnLaSala, publicadosEnEntregas = 0) {
    const todas = [...recibidos.values()].flat();
    const esperadoPorCliente = publicadosEnLaSala;
    const clientesCompletos = [...recibidos.values()].filter((latencias) => latencias.length >= esperadoPorCliente).length;
    console.log(`  ${nombre}`);
    console.log(`    publicados en la sala: ${publicadosEnLaSala} · entregas esperadas: ${publicadosEnLaSala * totalActivos} · recibidas: ${todas.length}`);
    console.log(`    clientes que recibieron TODO: ${clientesCompletos}/${totalActivos}`);
    console.log(`    latencia de entrega ${resumirLatencias(todas)}`);
    if (publicadosEnEntregas) {
      console.log(`    canal privado de entregas (host): ${recibidoPorElHost}/${publicadosEnEntregas} · ${resumirLatencias(latenciasDelHost)}`);
    }
    if (CON_MITIGACIONES) console.log(`    publicaciones rechazadas que se reintentaron: ${reintentosHechos}`);
    console.log(`    errores al publicar (definitivos): ${erroresDePublicacion.length}${erroresDePublicacion.length ? ' · ' + [...new Set(erroresDePublicacion)].slice(0, 3).join(' | ') : ''}`);
  }

  if (CON_MASIVO) {
    titulo(`Ably · M «masivo»: ${totalActivos} clientes (ingreso y entrega por canal privado) y un host que anuncia en lote`);
    const canalPublico = `debate:sala:${identificadorDeLaCarga}-masivo`;
    const canalPrivado = `debate:entrega:${identificadorDeLaCarga}-masivo`;
    const anunciosPorCliente = new Map(activos.map(({ indice }) => [indice, { lotes: 0, ingresos: 0, entregas: 0, latencias: [] }]));
    for (const { cliente, indice } of activos) {
      await cliente.channels.get(canalPublico).subscribe((mensaje) => {
        const resumen = anunciosPorCliente.get(indice);
        resumen.lotes += 1;
        resumen.ingresos += mensaje.data.ingresos?.length ?? 0;
        resumen.entregas += mensaje.data.entregas?.length ?? 0;
        resumen.latencias.push(Date.now() - mensaje.data.t);
      });
    }
    // El host simulado: recibe por el canal privado y anuncia en lote cada 5 s.
    const clienteDelHost = new Ably.Realtime({ key: process.env.ABLY_API_KEY, clientId: 'host-simulado' });
    const recibidoPorElHost = { ingresos: [], entregas: [] };
    await clienteDelHost.channels.get(canalPrivado).subscribe((mensaje) => {
      (mensaje.name === 'entrega.ingreso' ? recibidoPorElHost.ingresos : recibidoPorElHost.entregas).push({ participantId: mensaje.data.indice });
    });
    let anunciados = { ingresos: 0, entregas: 0 };
    let lotesPublicados = 0;
    const erroresDelHost = [];
    const temporizadorDelHost = setInterval(async () => {
      const ingresos = recibidoPorElHost.ingresos.slice(anunciados.ingresos);
      const entregas = recibidoPorElHost.entregas.slice(anunciados.entregas);
      anunciados = { ingresos: recibidoPorElHost.ingresos.length, entregas: recibidoPorElHost.entregas.length };
      for (const [lista, campo] of [[ingresos, 'ingresos'], [entregas, 'entregas']]) {
        if (lista.length === 0) continue;
        lotesPublicados += 1;
        try {
          await publicarConReintentos(() => clienteDelHost.channels.get(canalPublico).publish(`lote.${campo}`, { [campo]: lista, t: Date.now() }));
        } catch (error) {
          erroresDelHost.push(`${error.code ?? ''} ${error.message}`.trim());
        }
      }
    }, 5000);
    const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    const erroresDeLosClientes = [];
    let reintentosDeLosClientes = 0;
    const publicarPrivado = async (nombre, datos) => {
      try {
        await publicarConReintentos(async () => {
          try {
            return await rest.channels.get(canalPrivado).publish(nombre, datos);
          } catch (error) {
            reintentosDeLosClientes += 1;
            throw error;
          }
        });
      } catch (error) {
        erroresDeLosClientes.push(`${error.code ?? ''} ${error.message}`.trim());
      }
    };
    const inicio = Date.now();
    await Promise.all(
      activos.map(async ({ indice }) => {
        await esperar(Math.random() * 10000); // entran en 10 s (escanear el QR)
        await publicarPrivado('entrega.ingreso', { indice, nombre: `p${indice}` });
        await esperar(Math.random() * ventanaDelEscalonadoMs(totalActivos)); // y entregan escalonados
        await publicarPrivado('entrega.texto', { indice, texto: 'x'.repeat(1200) });
      })
    );
    await esperar(12000);
    clearInterval(temporizadorDelHost);
    const resumenes = [...anunciosPorCliente.values()];
    const completos = resumenes.filter((r) => r.ingresos >= totalActivos && r.entregas >= totalActivos).length;
    const entregasDeMensaje = resumenes.reduce((suma, r) => suma + r.lotes, 0);
    const latencias = resumenes.flatMap((r) => r.latencias);
    console.log(`  host simulado recibió ${recibidoPorElHost.ingresos.length} ingresos y ${recibidoPorElHost.entregas.length} textos de ${totalActivos}`);
    console.log(`  lotes publicados por el host: ${lotesPublicados} · entregas de mensaje a los clientes: ${entregasDeMensaje} (en A+C eran ~${totalActivos * totalActivos * 2})`);
    console.log(`  clientes que vieron a TODOS ingresar y entregar: ${completos}/${totalActivos} · latencia del anuncio ${resumirLatencias(latencias)}`);
    console.log(`  duración ${((Date.now() - inicio) / 1000).toFixed(0)} s · reintentos por tasa de los clientes ${reintentosDeLosClientes} · errores definitivos: clientes ${erroresDeLosClientes.length}, host ${erroresDelHost.length}${erroresDeLosClientes.length ? ' · ' + [...new Set(erroresDeLosClientes)].slice(0, 2).join(' | ') : ''}`);
    clienteDelHost.close();
  }

  if (SOLO_MASIVO) {
    for (const { cliente } of clientes) cliente.close();
    await esperar(1500);
    return;
  }

  if (CON_PRESENCIA) {
    titulo(`Ably · P «presencia»: ${totalActivos} clientes se suscriben a la presencia y entran en 10 s`);
    const canalDePresencia = `debate:sala:${identificadorDeLaCarga}-presencia`;
    const eventosDePresencia = new Map(activos.map(({ indice }) => [indice, 0]));
    const erroresDePresencia = [];
    for (const { cliente, indice } of activos) {
      await cliente.channels.get(canalDePresencia).presence.subscribe(() => {
        eventosDePresencia.set(indice, eventosDePresencia.get(indice) + 1);
      });
    }
    const inicioDePresencia = Date.now();
    await Promise.all(
      activos.map(async ({ cliente, indice }) => {
        await esperar(Math.random() * 10000);
        try {
          await cliente.channels.get(canalDePresencia).presence.enter({ nombre: `p${indice}`, emoji: '🦊' });
        } catch (error) {
          erroresDePresencia.push(`${error.code ?? ''} ${error.message}`.trim());
        }
      })
    );
    await esperar(6000);
    const recibidos = [...eventosDePresencia.values()];
    console.log(`  eventos de presencia esperados por cliente: ${totalActivos} · promedio recibido ${Math.round(recibidos.reduce((a, b) => a + b, 0) / recibidos.length)} · clientes completos ${recibidos.filter((n) => n >= totalActivos).length}/${totalActivos}`);
    console.log(`  total de entregas de presencia: ${recibidos.reduce((a, b) => a + b, 0)} en ${((Date.now() - inicioDePresencia) / 1000).toFixed(1)} s · errores al entrar: ${erroresDePresencia.length}${erroresDePresencia.length ? ' · ' + [...new Set(erroresDePresencia)].slice(0, 2).join(' | ') : ''}`);
  }

  titulo(`Ably · A «lectura»: ${totalActivos} entregas repartidas en 10 s`);
  reiniciarMedicion();
  await Promise.all(
    activos.map(async ({ cliente, indice }) => {
      await esperar(Math.random() * 10000);
      await publicar(cliente, canalDeLaSala, 'lectura.entrega_registrada', { indice });
      await publicar(cliente, canalDeLasEntregas, 'entrega.texto', { indice, texto: 'x'.repeat(1200) });
    })
  );
  await esperar(5000);
  informe('Resultado A', totalActivos, totalActivos);

  titulo(`Ably · B «foro»: ${totalActivos} personas × 3 posts en 30 s (cada post lo reciben todos)`);
  reiniciarMedicion();
  await Promise.all(
    activos.map(async ({ cliente, indice }) => {
      for (let numeroDePost = 0; numeroDePost < 3; numeroDePost += 1) {
        await esperar(Math.random() * 10000);
        await publicar(cliente, canalDeLaSala, 'aporte.publicado', { indice, texto: 'y'.repeat(300) });
      }
    })
  );
  await esperar(8000);
  informe('Resultado B', totalActivos * 3);

  titulo(`Ably · C «ráfaga»: ${totalActivos} publican a la vez (vence el tiempo y se envían todos los borradores)`);
  reiniciarMedicion();
  if (CON_MITIGACIONES) console.log(`  (envío escalonado en una ventana de ${(ventanaDelEscalonadoMs(totalActivos) / 1000).toFixed(1)} s)`);
  await Promise.all(
    activos.map(async ({ cliente, indice }) => {
      if (CON_MITIGACIONES) await esperar(esperaAleatoriaDelEnvioMs(totalActivos));
      await publicar(cliente, canalDeLaSala, 'lectura.entrega_registrada', { indice });
      await publicar(cliente, canalDeLasEntregas, 'entrega.texto', { indice, texto: 'z'.repeat(1200) });
    })
  );
  await esperar(CON_MITIGACIONES ? 20000 : 8000);
  informe('Resultado C', totalActivos, totalActivos);

  titulo('Ably · cierre');
  for (const { cliente } of clientes) cliente.close();
  await esperar(1500);
  console.log('  Conexiones cerradas.');
}

// ------------------------------------------------------------------------------------------------ Groq
const TEXTO_DE_RELLENO =
  'La formación en investigación permite decidir con evidencia. Según la lectura, un equipo que midió el problema antes de actuar redujo sus errores. Esto explica que el método evita soluciones improvisadas, y por eso en mi carrera justificaré mis propuestas con datos. '.repeat(
    6
  );

function cuerpoDeLaPeticion(indice) {
  return JSON.stringify({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content:
          'Eres un evaluador de textos. Evalúa el texto del estudiante contra una rúbrica de cinco criterios (pertinencia, estructura, desarrollo, claridad, corrección) con niveles 0 a 3. Responde SOLO JSON: {"niveles":{"pertinencia":0,"estructura":0,"desarrollo":0,"claridad":0,"correccion":0},"comentario":"máximo 25 palabras"}. ' +
          'Contexto adicional de la rúbrica: '.concat('el texto debe seguir la estructura Punto, Evidencia, Explicación y Enlace. '.repeat(20)),
      },
      { role: 'user', content: `${TEXTO_DE_RELLENO} (entrega ${indice})` },
    ],
    temperature: 0,
    max_tokens: 700,
    response_format: { type: 'json_object' },
  });
}

async function llamarAGroq(indice) {
  const inicio = Date.now();
  try {
    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: cuerpoDeLaPeticion(indice),
    });
    const datos = await respuesta.json().catch(() => null);
    return {
      estado: respuesta.status,
      ms: Date.now() - inicio,
      tokens: datos?.usage?.total_tokens ?? 0,
      reintentarEn: respuesta.headers.get('retry-after'),
      cabeceras: {
        peticionesPorDia: respuesta.headers.get('x-ratelimit-limit-requests'),
        peticionesRestantes: respuesta.headers.get('x-ratelimit-remaining-requests'),
        tokensPorMinuto: respuesta.headers.get('x-ratelimit-limit-tokens'),
        tokensRestantes: respuesta.headers.get('x-ratelimit-remaining-tokens'),
        reinicioDeTokens: respuesta.headers.get('x-ratelimit-reset-tokens'),
        reinicioDePeticiones: respuesta.headers.get('x-ratelimit-reset-requests'),
      },
      mensaje: respuesta.ok ? null : (datos?.error?.message ?? '').slice(0, 160),
    };
  } catch (error) {
    return { estado: 0, ms: Date.now() - inicio, tokens: 0, mensaje: String(error).slice(0, 120), cabeceras: {} };
  }
}

function informeDeGroq(nombre, resultados, duracionTotalMs) {
  const porEstado = {};
  for (const { estado } of resultados) porEstado[estado] = (porEstado[estado] ?? 0) + 1;
  const buenos = resultados.filter((resultado) => resultado.estado === 200);
  console.log(`  ${nombre}`);
  console.log(`    estados: ${JSON.stringify(porEstado)} · duración total ${(duracionTotalMs / 1000).toFixed(1)} s`);
  console.log(`    tokens consumidos: ${resultados.reduce((suma, resultado) => suma + resultado.tokens, 0)} · latencia de las exitosas ${resumirLatencias(buenos.map((resultado) => resultado.ms))}`);
  const rechazadas = resultados.filter((resultado) => resultado.estado === 429);
  if (rechazadas.length) {
    console.log(`    429: ${rechazadas.length} · retry-after típico ${rechazadas[0].reintentarEn ?? 'n/d'} s · «${rechazadas[0].mensaje}»`);
  }
  const otrosErrores = resultados.filter((resultado) => resultado.estado !== 200 && resultado.estado !== 429);
  if (otrosErrores.length) console.log(`    otros errores: ${JSON.stringify(otrosErrores.slice(0, 2).map((r) => [r.estado, r.mensaje]))}`);
}

async function pruebaDeGroq() {
  titulo('Groq · límites que informa la cuenta (1 petición)');
  const sonda = await llamarAGroq(0);
  console.log(`  estado ${sonda.estado} · ${sonda.tokens} tokens en esa petición · ${sonda.ms} ms`);
  console.log(`  cabeceras: ${JSON.stringify(sonda.cabeceras)}`);

  titulo(`Groq · ráfaga de ${PETICIONES_A_GROQ} peticiones a la vez, sin reintentos`);
  let inicio = Date.now();
  const rafaga = await Promise.all(Array.from({ length: PETICIONES_A_GROQ }, (_, indice) => llamarAGroq(indice + 1)));
  informeDeGroq('Ráfaga', rafaga, Date.now() - inicio);

  await esperar(65000); // deja que se reinicie la ventana por minuto antes de medir la cola de la app

  titulo(`Groq · ${PETICIONES_A_GROQ} peticiones con la concurrencia de la app (2 a la vez, como la cola del docente), sin reintentos`);
  inicio = Date.now();
  const resultados = [];
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (siguiente < PETICIONES_A_GROQ) {
        const mio = siguiente;
        siguiente += 1;
        resultados.push(await llamarAGroq(1000 + mio));
      }
    })
  );
  informeDeGroq('Cola de 2 a la vez', resultados, Date.now() - inicio);
}

// ------------------------------------------------------------------------------------------------ ejecución
console.log(
  `Prueba de carga · clientes ${MAXIMO_DE_CLIENTES} · peticiones a Groq ${PETICIONES_A_GROQ}${SOLO ? ' · solo ' + SOLO : ''} · ${CON_MITIGACIONES ? 'CON mitigaciones' : 'sin mitigaciones'}`
);
if (SOLO !== 'groq') await pruebaDeAbly();
if (SOLO !== 'ably') await pruebaDeGroq();
console.log('\nFin.');
process.exit(0);
