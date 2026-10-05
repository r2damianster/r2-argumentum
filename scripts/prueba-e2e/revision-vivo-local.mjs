// Prueba EN VIVO, EN LOCAL, de la revisión entre pares del control de lectura según el modo de ahorro (4-oct-2026).
// Mismas condiciones que lectura-vivo-local.mjs (ver su encabezado y el de foro-vivo-local.mjs): Chrome real + /api local
// + Ably real. 1 host + 3 participantes (el mínimo para repartir revisiones).
//
//   MODO_DE_AHORRO=pequena|moderada|ahorro|masivo|automatico node revision-vivo-local.mjs
//
// Comprueba que cada estudiante recibe sus 2 textos sin autor, envía sus 2 revisiones, y que el aviso «revisión enviada»
// viaja SUELTO por la sala (pequeña y moderada) o EN LOTE desde el host (ahorro y masivo).
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const MODO = process.env.MODO_DE_AHORRO ?? 'automatico';
const ETIQUETA_DEL_MODO = {
  automatico: 'Automático',
  pequena: 'Sala pequeña',
  moderada: 'Sala grande (moderado)',
  ahorro: 'Sala grande (ahorro)',
  masivo: 'Sala masiva',
};
const AGRUPA_TODO = MODO === 'ahorro' || MODO === 'masivo';
for (const linea of readFileSync('C:/Users/User/Documents/Desarrollo Web/Debate/.env.local', 'utf-8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const BASE = 'http://localhost:5173';
const resultados = [];
const anotar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre} ${detalle}`);
};
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const errores = [];

async function contarEventosDeLaSala(sala) {
  const credencial = Buffer.from(process.env.ABLY_API_KEY).toString('base64');
  const respuesta = await fetch(`https://rest.ably.io/channels/${encodeURIComponent(`debate:sala:${sala}`)}/messages?limit=1000`, {
    headers: { Authorization: `Basic ${credencial}` },
  });
  const mensajes = await respuesta.json();
  const cuenta = {};
  for (const mensaje of Array.isArray(mensajes) ? mensajes : []) cuenta[mensaje.name] = (cuenta[mensaje.name] ?? 0) + 1;
  return cuenta;
}

const navegador = await chromium.launch({ channel: 'chrome', headless: true });
async function nuevaPagina(ancho = 390) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
  const pagina = await contexto.newPage();
  pagina.on('dialog', (dialogo) => dialogo.accept());
  pagina.on('pageerror', (error) => errores.push(error.message));
  return pagina;
}

const host = await nuevaPagina(1100);
await host.goto(`${BASE}/host.html`);
await host.locator('input').nth(0).fill('prueba');
await host.locator('input[type=password]').fill('prueba-local');
await host.getByRole('button', { name: 'Entrar' }).click();
await host.getByText('Control de lectura').first().click();
await host.getByRole('button', { name: /Control de lectura:/ }).click();
if (MODO !== 'automatico') {
  await host.locator(`label:has(strong:text-is("${ETIQUETA_DEL_MODO[MODO]}"))`).click();
}
// Revisión entre pares: 2 textos por persona, 5 minutos (sin sugerencias de la IA que gasten cuota: no se piden)
await host.getByText('Revisión entre pares después de escribir').click();
await host.getByRole('button', { name: /Confirmar configuración/ }).click();
await host.locator('.codigo-de-sala').waitFor();
const sala = (await host.locator('.codigo-de-sala').innerText()).trim();
anotar('sala abierta con revisión entre pares', /^\d{4}$/.test(sala), `sala ${sala}`);

const nombres = ['Ana', 'Beto', 'Carla'];
const participantes = [];
for (const [indice, nombre] of nombres.entries()) {
  const pagina = await nuevaPagina();
  await pagina.goto(`${BASE}/player.html?sala=${sala}`);
  await pagina.locator('input[placeholder="Ej. Arturo"]').fill(nombre);
  await pagina.locator('.grilla-de-emojis button').nth(indice * 4).click();
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.getByText('Para entrar al control de lectura').waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  participantes.push({ nombre, pagina });
}
await esperar(1500);
await host.getByRole('button', { name: /Iniciar control de lectura/ }).click();
await esperar(2500);

const TEXTOS = {
  Ana: 'La formación en investigación sirve para decidir con evidencia. Según la lectura, un equipo que midió el problema antes de actuar redujo sus errores. Esto explica que el método evita soluciones improvisadas. Por eso justificaré mis propuestas con datos.',
  Beto: 'Investigar ayuda a entender los problemas antes de resolverlos. La lectura menciona que medir primero evita errores. Eso importa porque las decisiones tienen consecuencias. Así conecto el tema con mi carrera.',
  Carla: 'El método científico enseña a dudar de lo que parece obvio. Según el texto, quienes cuestionan sus supuestos corrigen antes. Por eso investigar desarrolla el pensamiento crítico y mejora mi trabajo futuro.',
};
for (const { nombre, pagina } of participantes) {
  await pagina.locator('textarea').waitFor({ timeout: 30000 });
  await pagina.locator('textarea').fill(TEXTOS[nombre]);
  await pagina.getByRole('button', { name: 'Enviar mi texto' }).click();
  await pagina.getByRole('button', { name: 'Sí, enviar' }).click();
  await esperar(1500);
  const igual = pagina.getByRole('button', { name: 'Enviar igual' });
  if (await igual.count()) await igual.click();
}
await esperar(AGRUPA_TODO || MODO === 'moderada' ? 8000 : 3000);

// Cerrar la escritura: empieza la revisión entre pares y el host reparte los textos
await host.getByRole('button', { name: /Cerrar la escritura ahora/ }).click();
await esperar(4000);
let conTextosParaRevisar = 0;
for (const { pagina } of participantes) {
  await pagina.getByText(/Texto 1/).first().waitFor({ timeout: 30000 }).catch(() => {});
  if ((await pagina.getByText(/Texto 2/).count()) > 0) conTextosParaRevisar += 1;
}
anotar('cada estudiante recibe sus 2 textos para revisar', conTextosParaRevisar === 3, `${conTextosParaRevisar}/3`);

// Cada estudiante envía sus 2 revisiones (nivel «Bueno» en todos los criterios)
for (const { pagina } of participantes) {
  for (let intento = 0; intento < 2; intento += 1) {
    const secciones = pagina.locator('.revision-de-un-texto').filter({ has: pagina.getByRole('button', { name: 'Enviar esta revisión' }) });
    if ((await secciones.count()) === 0) break;
    const seccion = secciones.first();
    const grupos = seccion.locator('.niveles-de-la-rubrica');
    for (let indice = 0; indice < (await grupos.count()); indice += 1) {
      await grupos.nth(indice).getByRole('radio').nth(1).click();
    }
    await seccion.getByRole('button', { name: 'Enviar esta revisión' }).click();
    await esperar(1200);
  }
}
let conAmbasEnviadas = 0;
for (const { pagina } of participantes) {
  if ((await pagina.getByText('Enviaste tu revisión de este texto').count()) === 2) conAmbasEnviadas += 1;
}
anotar('cada estudiante ve sus 2 revisiones como enviadas al instante', conAmbasEnviadas === 3, `${conAmbasEnviadas}/3`);

await esperar(AGRUPA_TODO ? 9000 : 3000);
const eventos = await contarEventosDeLaSala(sala);
const sueltas = eventos['lectura.revision_enviada'] ?? 0;
const enLote = eventos['lectura.revisiones_registradas'] ?? 0;
console.log(`     modo ${MODO}: avisos de revisión en la sala → sueltos ${sueltas} · lotes ${enLote}`);
if (AGRUPA_TODO) {
  anotar('ahorro/masivo: ninguna revisión se avisó suelta y el host las anunció en lote', sueltas === 0 && enLote >= 1);
} else {
  anotar('pequeña/moderada: las 6 revisiones se avisaron sueltas, sin lotes', sueltas === 6 && enLote === 0);
}

// El docente ve las revisiones recibidas por su canal privado (panel de revisiones de cada entrega)
const textoDelHost = await host.locator('body').innerText();
anotar('el docente ve el avance: 6 de 6 revisiones enviadas', /6 de 6 revisiones enviadas/.test(textoDelHost), textoDelHost.match(/\d+ de \d+ revisiones enviadas/)?.[0] ?? '');

anotar('ninguna página lanzó errores de ejecución', errores.length === 0, errores.slice(0, 2).join(' | '));
await navegador.close();
console.log(resultados.every(Boolean) ? 'TODO OK' : `HAY FALLOS (${resultados.filter((r) => !r).length})`);
process.exit(resultados.every(Boolean) ? 0 : 1);
