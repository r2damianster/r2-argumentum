// Prueba de CARGA, EN LOCAL, con Ably y Groq reales (4-oct-2026). No usa navegador: clientes de Ably sin interfaz.
//
//   node scripts/prueba-e2e/carga-ably-y-groq.mjs [--clientes=200] [--groq=40] [--solo=ably|groq]
//
// Necesita ABLY_API_KEY y GROQ_API_KEY en .env.local. Usa canales propios (`debate:sala:carga-…`), nunca los de una
// sala real. OJO: abre hasta N conexiones de Ably a la vez y gasta mensajes de la cuota mensual (con 200 clientes,
// unos 130.000 entregas). Si usas la misma cuenta de Ably en producción, no la corras durante una clase.
//
// Qué mide:
//   Ably: cuántas conexiones se sostienen (rampa) y, con ese número de clientes, tres patrones de tráfico:
//     A «lectura»: cada cliente publica 1 evento en la sala y 1 texto en un canal privado (repartidos en 10 s).
//     B «foro»:    cada cliente publica 3 posts en la sala (repartidos en 30 s). Cada post lo reciben todos.
//     C «ráfaga»:  todos publican a la vez (lo que pasa cuando vence el tiempo y se envían todos los borradores).
//   Groq: límites que informa la cuenta (cabeceras), una ráfaga de N peticiones de ~2.000 tokens sin reintentos
//   (cuántas dan 429) y la misma carga con la concurrencia de la app (2 a la vez).
import { readFileSync } from 'node:fs';
import Ably from 'ably';

const argumentos = Object.fromEntries(
  process.argv.slice(2).map((texto) => {
    const [clave, valor] = texto.replace(/^--/, '').split('=');
    return [clave, valor ?? true];
  })
);
const MAXIMO_DE_CLIENTES = Number(argumentos.clientes ?? 200);
const PETICIONES_A_GROQ = Number(argumentos.groq ?? 40);
const SOLO = argumentos.solo ?? null;

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

  async function publicar(cliente, nombreDelCanal, nombre, datos) {
    try {
      await cliente.channels.get(nombreDelCanal).publish(nombre, { ...datos, t: Date.now() });
    } catch (error) {
      erroresDePublicacion.push(`${error.code ?? ''} ${error.message}`.trim());
    }
  }
  const reiniciarMedicion = () => {
    for (const latencias of recibidos.values()) latencias.length = 0;
    latenciasDelHost.length = 0;
    recibidoPorElHost = 0;
    erroresDePublicacion.length = 0;
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
    console.log(`    errores al publicar: ${erroresDePublicacion.length}${erroresDePublicacion.length ? ' · ' + [...new Set(erroresDePublicacion)].slice(0, 3).join(' | ') : ''}`);
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
  await Promise.all(
    activos.map(async ({ cliente, indice }) => {
      await publicar(cliente, canalDeLaSala, 'lectura.entrega_registrada', { indice });
      await publicar(cliente, canalDeLasEntregas, 'entrega.texto', { indice, texto: 'z'.repeat(1200) });
    })
  );
  await esperar(8000);
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
console.log(`Prueba de carga · clientes ${MAXIMO_DE_CLIENTES} · peticiones a Groq ${PETICIONES_A_GROQ}${SOLO ? ' · solo ' + SOLO : ''}`);
if (SOLO !== 'groq') await pruebaDeAbly();
if (SOLO !== 'ably') await pruebaDeGroq();
console.log('\nFin.');
process.exit(0);
