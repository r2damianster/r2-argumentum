// Prueba EN VIVO del foro escrito, EN LOCAL: Chrome real + servidor /api local + Ably real + Groq real (4-oct-2026).
// No va contra producción. Necesita ABLY_API_KEY, GROQ_API_KEY, HOST_USER y HOST_PASSWORD en .env.local, el servidor
// /api local en el puerto 3001 y `vite` con proxy de /api en el 5173, y `npm i playwright-core` fuera del repo.
// Se corrió con HOST_USER=prueba y HOST_PASSWORD=prueba-local (valores solo locales).
import { chromium } from 'playwright-core';

// MODO_DE_AHORRO=pequena|moderada|ahorro|automatico elige el modo de ahorro en la configuración (por defecto, automático).
const MODO = process.env.MODO_DE_AHORRO ?? 'automatico';
const ETIQUETA_DEL_MODO = { automatico: 'Automático', pequena: 'Sala pequeña', moderada: 'Sala grande (moderado)', ahorro: 'Sala grande (ahorro)' };

const BASE = 'http://localhost:5173';
const resultados = [];
const anotar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre} ${detalle}`);
};
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const consola = [];
const sugerenciasDeLaIA = [];

async function nuevaPagina() {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const pagina = await contexto.newPage();
  pagina.on('dialog', (dialogo) => dialogo.accept());
  pagina.on('pageerror', (error) => consola.push(`pageerror: ${error.message}`));
  return pagina;
}

// --- Host
const host = await nuevaPagina();
await host.setViewportSize({ width: 1100, height: 900 });
await host.goto(`${BASE}/host.html`);
await host.locator('input').nth(0).fill('prueba');
await host.locator('input[type=password]').fill('prueba-local');
await host.getByRole('button', { name: 'Entrar' }).click();
await host.getByText('Foro escrito').first().click();
await host.getByRole('button', { name: /Foro: ¿Ha sido útil/ }).click();
await host.getByText('Con advertencias').first().click();
if (MODO !== 'automatico') {
  // Se elige por el título de la opción (el texto de ayuda de «Automático» también nombra a los demás modos).
  await host.locator(`label:has(strong:text-is("${ETIQUETA_DEL_MODO[MODO]}"))`).click();
}
await host.getByRole('button', { name: /Confirmar configuración/ }).click();
await host.locator('.codigo-de-sala').waitFor();
const sala = (await host.locator('.codigo-de-sala').innerText()).trim();
anotar('el host abre la sala del foro', /^\d{4}$/.test(sala), `sala ${sala}`);

// --- 6 participantes
const nombres = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fito'];
const participantes = [];
for (const [indice, nombre] of nombres.entries()) {
  const pagina = await nuevaPagina();
  await pagina.goto(`${BASE}/player.html?sala=${sala}`);
  await pagina.locator('input[placeholder="Ej. Arturo"]').fill(nombre);
  await pagina.locator('.grilla-de-emojis button').nth(indice * 3).click();
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.locator('.lista-de-posturas-para-elegir button').first().waitFor({ timeout: 20000 });
  await pagina.locator('.lista-de-posturas-para-elegir button').nth(indice % 2).click();
  await pagina.getByRole('button', { name: 'Entrar al foro' }).click();
  participantes.push({ nombre, pagina });
}
await esperar(2500);
const textoIngreso = await participantes[0].pagina.locator('body').innerText();
anotar('el foro no pide argumento previo ni muestra puntaje de debate', !/argumento de ingreso/i.test(textoIngreso));

// --- Sala de espera del host: co-moderadores y arranque
await host.getByRole('button', { name: /Sortear ahora/ }).click();
await esperar(1500);
const textoHostEspera = await host.locator('body').innerText();
anotar('con 6 personas corresponde 1 co-moderador (designado)', /Designados/i.test(textoHostEspera) || /co-moderador/i.test(textoHostEspera));
await host.getByRole('button', { name: /Iniciar foro/ }).click();
await esperar(3000);
anotar('arranca la cuenta atrás en el host', /⏱️\s*\d\d:\d\d/.test(await host.locator('body').innerText()));

// Quién es co-moderador
let coModerador = null;
let quienesEscriben = [];
for (const participante of participantes) {
  const esCo = (await participante.pagina.locator('body').innerText()).includes('Co-moderador');
  if (esCo) coModerador = participante; else quienesEscriben.push(participante);
}
anotar('un participante quedó como co-moderador y no ve el cuadro de publicar', Boolean(coModerador) && (await coModerador.pagina.locator('#compositor-del-foro').count()) === 0);


// Con Groq real el envío tiene pasos: sugerencia de la IA → «Publicar así» → (si hay señales) advertencia → «Enviar igual».
async function terminarEnvio(pagina) {
  for (let intento = 0; intento < 30; intento += 1) {
    const asi = pagina.getByRole('button', { name: /Publicar así|Publicar respuesta así/ });
    if (await asi.count()) {
      sugerenciasDeLaIA.push((await pagina.locator('body').innerText()).match(/(completo|incompleto|sin razón).{0,60}/i)?.[0] ?? 'sugerencia');
      await asi.click();
    }
    const igual = pagina.getByRole('button', { name: 'Enviar igual' });
    if (await igual.count()) await igual.click();
    if ((await pagina.locator('#compositor-del-foro textarea').inputValue().catch(() => '')) === '') return;
    await esperar(500);
  }
}

// --- Publicar posts (teclado simulado con fill) y manejar la advertencia de integridad si sale
async function publicarPost(participante, texto, botonDeEnvio = /Publicar post/) {
  const { pagina } = participante;
  await pagina.locator('#compositor-del-foro textarea').fill(texto);
  await pagina.getByRole('button', { name: botonDeEnvio }).click();
  await terminarEnvio(pagina);
  await esperar(1000);
}

const [p1, p2, p3, p4] = quienesEscriben;
await publicarPost(p1, 'Para mí la formación en investigación sí fue útil porque en metodología aprendí a formular una pregunta y la usé en mis prácticas preprofesionales.');
await publicarPost(p2, 'Yo creo que fue poco útil porque casi todo era teoría y nunca recogimos datos reales de un problema de la institución en ninguna materia.');
await esperar(2000);
const textoP3 = await p3.pagina.locator('body').innerText();
anotar('los posts llegan a los demás en tiempo real', textoP3.includes('formular una pregunta') && textoP3.includes('poco útil'));
anotar('los demás no ven la sugerencia de la IA ni etiquetas de falacia', !/falacia/i.test(textoP3));

anotar('Groq sugirió (completo/incompleto) a quien escribe antes de publicar', sugerenciasDeLaIA.length >= 2, JSON.stringify(sugerenciasDeLaIA));
const sugerenciasAntesDeLaReplica = sugerenciasDeLaIA.length;
// Réplica
await p3.pagina.getByRole('button', { name: /Responder/ }).first().click();
await p3.pagina.locator('#compositor-del-foro textarea').fill('Viví algo parecido: en estadística tampoco analizamos datos reales y por eso me costó aplicarlo después en mi proyecto.');
await p3.pagina.getByRole('button', { name: /Publicar respuesta/ }).click();
await terminarEnvio(p3.pagina);
await esperar(2500);
anotar('la réplica aparece en el hilo para todos', (await p1.pagina.locator('body').innerText()).includes('estadística tampoco analizamos'));

// En el modo «ahorro» las réplicas no consultan a la IA; en los demás, una réplica de 15 palabras o más sí.
{
  await esperar(1500);
  const consultasDeLaReplica = sugerenciasDeLaIA.length - sugerenciasAntesDeLaReplica;
  console.log(`     modo ${MODO}: consultas a la IA por la réplica → ${consultasDeLaReplica}`);
  anotar(
    MODO === 'ahorro' ? 'ahorro: la réplica no consulta a la IA' : 'la réplica larga sí consulta a la IA',
    MODO === 'ahorro' ? consultasDeLaReplica === 0 : consultasDeLaReplica === 1
  );
}

// Reacción
await p4.pagina.getByRole('button', { name: /Me convenció/ }).first().click();
await esperar(1500);
anotar('una reacción suma un conteo visible', /Me convenció\s*·\s*1/.test(await p1.pagina.locator('body').innerText()));

// Pegado: aviso al enviar y marca solo para el host
{
  const { pagina } = p4;
  const textarea = pagina.locator('#compositor-del-foro textarea');
  await textarea.focus();
  const largo = 'La investigación formativa permite que el estudiante aprenda a formular preguntas y a buscar evidencia para responderlas con método en su carrera.';
  await pagina.evaluate((texto) => {
    const campo = document.querySelector('#compositor-del-foro textarea');
    const dt = new DataTransfer();
    dt.setData('text/plain', texto);
    campo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(campo, texto);
    campo.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  }, largo);
  await pagina.getByRole('button', { name: /Publicar post/ }).click();
  let advertencia = '';
  for (let intento = 0; intento < 30 && !/El moderador verá esta marca/.test(advertencia); intento += 1) {
    const asi = pagina.getByRole('button', { name: /Publicar así/ });
    if (await asi.count()) await asi.click();
    await esperar(500);
    advertencia = await pagina.locator('body').innerText();
  }
  anotar('al pegar sale «El moderador verá esta marca» con Enviar igual / Reescribir', /El moderador verá esta marca/.test(advertencia));
  await terminarEnvio(pagina);
  await esperar(3000);
}
const textoHostVivo = await host.locator('body').innerText();
anotar('el host recibe la marca de integridad por el canal privado', /Integridad/i.test(textoHostVivo) && /pegad/i.test(textoHostVivo));
let algunParticipanteVeLaMarca = false;
for (const participante of participantes) {
  if (/solo tú ves esto/i.test(await participante.pagina.locator('body').innerText())) algunParticipanteVeLaMarca = true;
}
anotar('ningún participante ve el panel de integridad', !algunParticipanteVeLaMarca);

// Revisión del co-moderador
if (coModerador) {
  await esperar(1500);
  const textoCo = await coModerador.pagina.locator('body').innerText();
  const botonesDeNivel = coModerador.pagina.getByRole('button', { name: 'Cuenta completo' });
  const cuantos = await botonesDeNivel.count();
  anotar('el co-moderador ve aportes por revisar con sus botones', cuantos > 0 || /revisar/i.test(textoCo), `botones: ${cuantos}`);
  for (let indice = 0; indice < Math.min(cuantos, 3); indice += 1) {
    await botonesDeNivel.nth(0).click().catch(() => {});
    await esperar(800);
  }
}

// Métricas y avisos en el host
const metricas = await host.locator('.franja-de-metricas').first().innerText().catch(() => '');
anotar('el host ve métricas del foro', /posts/i.test(metricas) || /\d/.test(metricas));

// --- Extender, cerrar escritura y cerrar la sesión
await host.getByRole('button', { name: /Extender 5 minutos/ }).first().click();
await esperar(1500);
anotar('extender suma 5 minutos', /Ya extendiste 5 minutos/.test(await host.locator('body').innerText()));
await host.getByRole('button', { name: /Cerrar la escritura ahora/ }).click();
await esperar(3000);
anotar('la escritura queda cerrada para los participantes', /Se acabó el tiempo|La escritura está cerrada/.test(await p1.pagina.locator('body').innerText()));
await host.getByRole('button', { name: /Cerrar y calcular los puntajes/ }).click();
await esperar(5000);
const textoFinal = await host.locator('body').innerText();
anotar('el host ve el ranking final', /ranking|Ranking|podio|Podio/i.test(textoFinal));

// Descargas
const [descarga] = await Promise.all([host.waitForEvent('download', { timeout: 15000 }).catch(() => null), host.getByRole('button', { name: /Descargar sesión/ }).click()]);
if (descarga) {
  const ruta = await descarga.path();
  const { readFileSync } = await import('node:fs');
  const informe = JSON.parse(readFileSync(ruta, 'utf-8'));
  anotar('el JSON trae la actividad foro_escrito y el desglose de puntaje', informe.actividad === 'foro_escrito' && Boolean(informe.desglosePorParticipante));
  anotar('el JSON general no trae las marcas de integridad', !JSON.stringify(informe).includes('senales'));
} else {
  anotar('descarga del JSON de la sesión', false, 'no hubo descarga');
}
const anexo = host.getByRole('button', { name: /Descargar anexo de integridad/ });
if (await anexo.count()) {
  const [descargaAnexo] = await Promise.all([host.waitForEvent('download', { timeout: 15000 }).catch(() => null), anexo.click()]);
  anotar('el anexo de integridad se descarga aparte', Boolean(descargaAnexo));
}

// Podio de un participante
const textoPodio = await p1.pagina.locator('body').innerText();
anotar('los participantes ven su podio al cerrar', /podio|Podio|puntos/i.test(textoPodio));

// Errores de ejecución en alguna página
const errores = consola.filter((linea) => !/favicon/i.test(linea));
anotar('ninguna página lanzó errores de ejecución', errores.length === 0, errores.slice(0, 3).join(' | '));

await host.screenshot({ path: 'foro-host-final.png' });
await navegador.close();
console.log(resultados.every(Boolean) ? 'TODO OK' : `HAY FALLOS (${resultados.filter((r) => !r).length})`);
process.exit(resultados.every(Boolean) ? 0 : 1);
