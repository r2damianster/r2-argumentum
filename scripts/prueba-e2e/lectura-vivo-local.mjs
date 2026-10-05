// Prueba EN VIVO del control de lectura, EN LOCAL: Chrome real + /api local + Ably real + Groq real (4-oct-2026).
// Mismas condiciones que foro-vivo-local.mjs (ver su encabezado); además necesita GROQ_API_KEY en .env.local.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

// MODO_DE_AHORRO=pequena|moderada|ahorro|masivo|automatico elige el modo en la configuración (por defecto, automático).
const MODO = process.env.MODO_DE_AHORRO ?? 'automatico';
const AGRUPA_TODO = MODO === 'ahorro' || MODO === 'masivo';
const ETIQUETA_DEL_MODO = {
  automatico: 'Automático',
  pequena: 'Sala pequeña',
  moderada: 'Sala grande (moderado)',
  ahorro: 'Sala grande (ahorro)',
  masivo: 'Sala masiva',
};
for (const linea of readFileSync('C:/Users/User/Documents/Desarrollo Web/Debate/.env.local', 'utf-8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

// Cuántas personas hay en la presencia de la sala (en el modo masivo nadie entra a ella).
async function contarPresenciaDeLaSala(sala) {
  const credencial = Buffer.from(process.env.ABLY_API_KEY).toString('base64');
  const respuesta = await fetch(`https://rest.ably.io/channels/${encodeURIComponent(`debate:sala:${sala}`)}/presence`, {
    headers: { Authorization: `Basic ${credencial}` },
  });
  const miembros = await respuesta.json();
  return Array.isArray(miembros) ? miembros.filter((miembro) => miembro.clientId !== 'host').length : -1;
}

// Cuenta, por el historial REST de Ably, qué eventos de entrega viajaron por el canal público de la sala.
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

const BASE = 'http://localhost:5173';
const resultados = [];
const anotar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre} ${detalle}`);
};
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const errores = [];

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
// La muestra pedagógica de la estructura se ve en la configuración previa
anotar('la configuración muestra qué es PEEL con su ejemplo', /¿qué es peel?/i.test(await host.locator('body').innerText()));
if (MODO !== 'automatico') {
  // Se elige por el título de la opción (el texto de ayuda de «Automático» también nombra a los demás modos).
  await host.locator(`label:has(strong:text-is("${ETIQUETA_DEL_MODO[MODO]}"))`).click();
}
await host.getByRole('button', { name: /Confirmar configuración/ }).click();
await host.locator('.codigo-de-sala').waitFor();
const sala = (await host.locator('.codigo-de-sala').innerText()).trim();
anotar('sala abierta', /^\d{4}$/.test(sala), `sala ${sala}`);
anotar('la sala de espera tiene la muestra pedagógica para el docente', /para explicar a la clase/i.test(await host.locator('body').innerText()));

const nombres = ['Ana', 'Beto', 'Carla'];
const participantes = [];
for (const [indice, nombre] of nombres.entries()) {
  const pagina = await nuevaPagina();
  await pagina.goto(`${BASE}/player.html?sala=${sala}`);
  await pagina.locator('input[placeholder="Ej. Arturo"]').fill(nombre);
  await pagina.locator('.grilla-de-emojis button').nth(indice * 4).click();
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.getByText('Para entrar al control de lectura').waitFor({ timeout: 20000 });
  if (indice === 0) {
    anotar('el estudiante ve la muestra pedagógica antes de ingresar', /¿qué es peel?/i.test(await pagina.locator('body').innerText()));
  }
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  participantes.push({ nombre, pagina });
}
await esperar(1500);
await host.getByRole('button', { name: /Iniciar control de lectura/ }).click();
await esperar(2500);

const TEXTOS = {
  Ana: 'La formación en investigación sirve para decidir con evidencia. Según la lectura, un equipo que midió el problema antes de actuar redujo sus errores a la mitad. Esto explica que el método evita soluciones improvisadas. Por eso, en mi carrera de ingeniería, justificaré mis propuestas con datos.\nAdemás, investigar desarrolla el pensamiento crítico. La lectura muestra que quienes cuestionan sus supuestos corrigen antes. Eso importa porque en el trabajo se toman decisiones con consecuencias. Así conecto el tema con mi futuro profesional.',
  Beto: 'investigar es bueno. sirve para cosas. yo creo que si.',
  Carla: 'Mi equipo favorito jugó anoche y ganó dos a uno con un gol en el último minuto, fue un partido muy emocionante para todos los hinchas del estadio.',
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
await esperar(3000);
let entregados = 0;
for (const { pagina } of participantes) if ((await pagina.locator('body').innerText()).includes('Entregaste tu texto')) entregados += 1;
anotar('los 3 entregaron', entregados === 3, `${entregados}/3`);
{
  await esperar(7000); // deja pasar el intervalo del lote
  const eventos = await contarEventosDeLaSala(sala);
  const sueltos = eventos['lectura.entrega_registrada'] ?? 0;
  const enLote = eventos['lectura.entregas_registradas'] ?? 0;
  console.log(`     modo ${MODO}: eventos de entrega en la sala → sueltos ${sueltos} · lotes ${enLote}`);
  if (MODO === 'pequena' || MODO === 'automatico') {
    anotar('sala pequeña: cada estudiante avisó su entrega al instante (3 avisos sueltos)', sueltos === 3);
  } else {
    anotar('sala grande: ningún aviso suelto de los estudiantes y el host anunció las entregas en lote', sueltos === 0 && enLote >= 1);
  }
  const ingresosSueltos = eventos['ingreso.confirmado'] ?? 0;
  const ingresosEnLote = eventos['sesion.ingresos_registrados'] ?? 0;
  const enPresencia = await contarPresenciaDeLaSala(sala);
  console.log(`     ingresos en la sala → sueltos ${ingresosSueltos} · lotes ${ingresosEnLote} · en presencia ${enPresencia}`);
  if (MODO === 'masivo') {
    anotar('masivo: nadie publicó su ingreso en la sala ni entró a la presencia; el host lo anunció en lote', ingresosSueltos === 0 && enPresencia === 0 && ingresosEnLote >= 1);
  } else {
    anotar('el ingreso se publica en la sala y los 3 entran a la presencia', ingresosSueltos === 3 && enPresencia === 3);
  }
  const conEntrega = (await host.locator('.entrega-de-la-cola').allInnerTexts()).length;
  anotar('el host ve las 3 entregas en su cola', conEntrega === 3, `${conEntrega}/3`);
}

// Groq: las sugerencias llegan solas, en cola, mientras se escribe
await host.waitForFunction(() => document.querySelectorAll('.entrega-de-la-cola').length === 3, null, { timeout: 15000 });
if (AGRUPA_TODO) {
  // En «ahorro» y masivo la IA no sugiere sola: antes de pedir nada no hay ninguna sugerencia.
  await esperar(4000);
  const sinPedir = (await host.locator('.entrega-de-la-cola').allInnerTexts()).filter((texto) => texto.includes('✨')).length;
  anotar('con la IA por demanda no hay sugerencias hasta que el docente las pide', sinPedir === 0, `${sinPedir}/3 con ✨`);
  await host.getByRole('button', { name: /Pedir sugerencia de la IA de las \d+ entregas pendientes/ }).click();
}
await host.waitForFunction(() => [...document.querySelectorAll('.entrega-de-la-cola')].every((e) => e.innerText.includes('✨')), null, { timeout: 120000 }).catch(() => {});
const estadoCola = await host.locator('.entrega-de-la-cola').allInnerTexts();
const conSugerencia = estadoCola.filter((texto) => texto.includes('✨')).length;
anotar('Groq sugirió una calificación para las 3 entregas', conSugerencia === 3, `${conSugerencia}/3 con ✨`);

// Qué sugirió, sin nombres
const resumen = [];
const codigos = await host.locator('.entrega-de-la-cola-codigo').allInnerTexts();
for (let indice = 0; indice < codigos.length; indice += 1) {
  await host.locator('.entrega-de-la-cola').nth(indice).click();
  await esperar(400);
  const bloque = host.locator('.sugerencia-de-la-ia');
  const texto = (await bloque.count()) ? await bloque.innerText() : '';
  const niveles = [...texto.matchAll(/: (Excelente|Bueno|Aceptable|Insuficiente)/g)].map((m) => m[1]);
  const confianza = texto.match(/confianza (\d+) %/)?.[1];
  resumen.push({ palabras: (await host.locator('.calificador-de-entrega p.texto-de-ayuda').first().innerText()).split(' ')[0], niveles, confianza });
}
console.log('     sugerencias:', JSON.stringify(resumen));
const niveles = resumen.map((r) => r.niveles.join(','));
anotar('la sugerencia distingue un texto bueno de uno flojo', new Set(niveles).size >= 2);
anotar('la sugerencia es anónima: el docente no ve nombres antes de aprobar', !/(Ana|Beto|Carla)/.test(await host.locator('.calificador-de-entrega').first().innerText()));

// Los estudiantes NO ven la sugerencia de Groq
let estudianteVeLaSugerencia = false;
for (const { pagina } of participantes) {
  if (/Sugerencia de la IA|orientativa/i.test(await pagina.locator('body').innerText())) estudianteVeLaSugerencia = true;
}
anotar('ningún estudiante ve la sugerencia de la IA', !estudianteVeLaSugerencia);

// Aprobar en lote: solo lo claro (nota sugerida alta, confianza alta, sin marcas de integridad)
const botonLote = host.getByRole('button', { name: /Aprobar las \d+ sugerencias claras/ });
const hayLote = await botonLote.count();
anotar('hay lote para la sugerencia clara (el texto bueno)', hayLote > 0);
if (hayLote) {
  const cuantas = Number((await botonLote.innerText()).match(/Aprobar las (\d+)/)[1]);
  anotar('el lote ofrece solo 1: no incluye las notas bajas aunque Groq esté seguro', cuantas === 1, `ofrece ${cuantas}`);
  await botonLote.click();
  await esperar(3000);
  const aprobadas = (await host.locator('.entrega-de-la-cola').allInnerTexts()).filter((texto) => texto.includes('Aprobada')).length;
  anotar('tras el lote quedan 2 por revisar a mano', aprobadas === 1, `${aprobadas} aprobada(s) de 3`);
}
// Aprobar tal cual la sugerencia de una pendiente (si queda alguna)
const pendiente = host.locator('.entrega-de-la-cola').filter({ hasText: 'Sin calificar' }).first();
if (await pendiente.count()) {
  await pendiente.click();
  await esperar(400);
  const tal = host.getByRole('button', { name: /Aprobar tal cual/ });
  if (await tal.count()) {
    await tal.click();
    await esperar(2000);
    anotar('«Aprobar tal cual» aprueba con lo que sugirió Groq', (await host.locator('.autor-revelado').count()) > 0);
  }
}

// Devolución y respuesta de los estudiantes (los avisos a la sala van sueltos o en lote según el modo)
{
  const botonDevolver = host.getByRole('button', { name: /Devolver las \d+ aprobadas/ });
  anotar('el docente puede devolver las aprobadas', (await botonDevolver.count()) > 0);
  if (await botonDevolver.count()) {
    await botonDevolver.click();
    await esperar(AGRUPA_TODO ? 9000 : 4000);
    let respondieron = 0;
    for (const { pagina } of participantes) {
      const botonDeAcuerdo = pagina.getByRole('button', { name: /De acuerdo/ });
      if (await botonDeAcuerdo.count()) {
        await botonDeAcuerdo.click();
        respondieron += 1;
      }
    }
    anotar('los estudiantes con devolución la ven y responden «de acuerdo»', respondieron === 2, `${respondieron}/2`);
    await esperar(AGRUPA_TODO ? 9000 : 3000);
    const eventos = await contarEventosDeLaSala(sala);
    const sueltas = eventos['lectura.devuelta'] ?? 0;
    const devueltasEnLote = eventos['lectura.devueltas_registradas'] ?? 0;
    const confirmadasSueltas = eventos['lectura.confirmada'] ?? 0;
    const confirmadasEnLote = eventos['lectura.confirmaciones_registradas'] ?? 0;
    console.log(`     devoluciones → sueltas ${sueltas} · lotes ${devueltasEnLote}; respuestas → sueltas ${confirmadasSueltas} · lotes ${confirmadasEnLote}`);
    if (AGRUPA_TODO) {
      anotar('ahorro/masivo: devoluciones y respuestas viajan en lote, ninguna suelta', sueltas === 0 && confirmadasSueltas === 0 && devueltasEnLote >= 1 && confirmadasEnLote >= 1);
    } else {
      anotar('sala pequeña/moderada: devoluciones y respuestas viajan sueltas', sueltas === 2 && confirmadasSueltas === 2 && devueltasEnLote === 0 && confirmadasEnLote === 0);
    }
  }
}

// Cerrar: sin revisión de pares en esta corrida
await host.getByRole('button', { name: /Cerrar la escritura ahora/ }).click();
await esperar(3000);
anotar('pasa a Calificación y devolución', (await host.locator('body').innerText()).includes('Calificación y devolución'));
const textoCola = await host.locator('.entrega-de-la-cola').allInnerTexts();
console.log('     cola:', JSON.stringify(textoCola.map((t) => t.replace(/\n/g, ' '))));
anotar('ninguna página lanzó errores de ejecución', errores.length === 0, errores.slice(0, 2).join(' | '));
await navegador.close();
console.log(resultados.every(Boolean) ? 'TODO OK' : `HAY FALLOS (${resultados.filter((r) => !r).length})`);
process.exit(resultados.every(Boolean) ? 0 : 1);
