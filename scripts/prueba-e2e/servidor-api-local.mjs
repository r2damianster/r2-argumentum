// Servidor local mínimo que emula las funciones de /api de Vercel (puerto 3001) para pruebas en vivo EN LOCAL.
// Lee las claves de .env.local (no las imprime). Uso, desde la raíz del repo: node scripts/prueba-e2e/servidor-api-local.mjs
// y, en otra terminal: npx vite --config scripts/prueba-e2e/vite.local.config.js (reenvía /api a este servidor).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\/]$/, '');
for (const linea of readFileSync(`${raiz}/.env.local`, 'utf8').split(/\r?\n/)) {
  const coincidencia = linea.match(/^([A-Z_0-9]+)=(.*)$/);
  if (coincidencia && !(coincidencia[1] in process.env)) {
    process.env[coincidencia[1]] = coincidencia[2].replace(/^["']|["']$/g, '');
  }
}

createServer(async (peticion, respuestaHttp) => {
  const url = new URL(peticion.url, 'http://localhost');
  const nombre = url.pathname.replace(/^\/api\//, '').replace(/[^a-z0-9-]/gi, '');
  const trozos = [];
  for await (const trozo of peticion) trozos.push(trozo);
  const crudo = Buffer.concat(trozos).toString('utf8');
  let cuerpo = {};
  try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch { cuerpo = {}; }

  const request = { method: peticion.method, headers: peticion.headers, body: cuerpo, query: Object.fromEntries(url.searchParams) };
  let estado = 200;
  const response = {
    status(codigo) { estado = codigo; return response; },
    setHeader(clave, valor) { respuestaHttp.setHeader(clave, valor); return response; },
    json(valor) { respuestaHttp.writeHead(estado, { 'Content-Type': 'application/json' }); respuestaHttp.end(JSON.stringify(valor)); return response; },
    send(valor) { respuestaHttp.writeHead(estado); respuestaHttp.end(valor); return response; },
    end(valor) { respuestaHttp.writeHead(estado); respuestaHttp.end(valor); return response; },
  };
  try {
    const modulo = await import(pathToFileURL(`${raiz}/api/${nombre}.js`).href);
    await modulo.default(request, response);
  } catch (error) {
    console.error('[api local]', nombre, String(error).slice(0, 200));
    if (!respuestaHttp.headersSent) {
      respuestaHttp.writeHead(500, { 'Content-Type': 'application/json' });
      respuestaHttp.end(JSON.stringify({ error: 'fallo local' }));
    }
  }
}).listen(3001, () => console.log('API local en :3001'));
