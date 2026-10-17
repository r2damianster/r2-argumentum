// GUARDIAS DE LA DOCUMENTACIÓN — la documentación viva describe código que existe (docs/12, regla 5).
// Nacen de la auditoría del 17-oct-2026, que encontró rutas, variables de entorno y campos citados que ya
// no existían o que ningún código leía. Como en `guardias.test.js`: si una falla, arregla el documento
// (o el código); no la borres ni le agregues excepciones.

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');

function leer(rutaRelativa) {
  return readFileSync(join(RAIZ, rutaRelativa), 'utf-8').replace(/\r\n/g, '\n');
}

// Archivos versionados o nuevos sin ignorar (en CI y en local igual): una ruta que solo existe en una carpeta ignorada
// (por ejemplo `videos/` o `dist/`) no cuenta.
function archivosVersionados() {
  try {
    return new Set(
      execSync('git ls-files --cached --others --exclude-standard', { cwd: RAIZ, encoding: 'utf-8' })
        .split('\n')
        .map((linea) => linea.trim())
        .filter(Boolean)
    );
  } catch {
    return null;
  }
}

// Documentos vivos. `06` (pendientes) y `11` (auditoría) guardan historia: pueden nombrar archivos ya retirados.
const DOCUMENTOS_VIVOS = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  ...readdirSync(join(RAIZ, 'docs'))
    .filter((nombre) => nombre.endsWith('.md') && !nombre.startsWith('06-') && !nombre.startsWith('11-'))
    .map((nombre) => `docs/${nombre}`),
  'scripts/prueba-e2e/README.md',
];

const SIN_TACHADOS = (texto) => texto.replace(/~~[^~]*~~/g, '');

describe('rutas citadas en la documentación viva', () => {
  it('cada ruta de archivo con extensión que se cita existe en el repositorio', () => {
    const versionados = archivosVersionados();
    if (!versionados) {
      return;
    }
    const inexistentes = [];
    for (const documento of DOCUMENTOS_VIVOS) {
      for (const [, citado] of SIN_TACHADOS(leer(documento)).matchAll(/`((?:src|api|docs|scripts|public)\/[A-Za-z0-9_\-./]+\.[a-z0-9]+)`/g)) {
        if (!versionados.has(citado)) {
          inexistentes.push(`${documento} cita ${citado}`);
        }
      }
    }
    expect(inexistentes).toEqual([]);
  });

  it('cada carpeta de src/, api/ o scripts/ que se cita existe', () => {
    const inexistentes = [];
    for (const documento of DOCUMENTOS_VIVOS) {
      for (const [, citado] of SIN_TACHADOS(leer(documento)).matchAll(/`((?:src|api|scripts)\/[A-Za-z0-9_\-./]*\/)`/g)) {
        if (!existsSync(join(RAIZ, citado))) {
          inexistentes.push(`${documento} cita ${citado}`);
        }
      }
    }
    expect(inexistentes).toEqual([]);
  });
});

describe('variables de entorno', () => {
  const codigoDeLaApi = readdirSync(join(RAIZ, 'api'))
    .filter((nombre) => nombre.endsWith('.js') && !nombre.endsWith('.test.js'))
    .map((nombre) => leer(`api/${nombre}`))
    .join('\n');
  const usadas = [...new Set([...codigoDeLaApi.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)].map((coincidencia) => coincidencia[1]))];
  // `_sesionDelHost.js` lee las cuentas del host desde el objeto de entorno que recibe.
  const conCuentasDelHost = [...new Set([...usadas, ...[...codigoDeLaApi.matchAll(/entorno\.([A-Z][A-Z0-9_]+)/g)].map((coincidencia) => coincidencia[1])])];

  it('toda variable de entorno que lee la API está en .env.example', () => {
    const ejemplo = leer('.env.example');
    const sinDeclarar = conCuentasDelHost.filter((variable) => !new RegExp(`^${variable}=`, 'm').test(ejemplo));
    expect(sinDeclarar).toEqual([]);
  });

  it('toda variable de .env.example se usa en la API', () => {
    const declaradas = [...leer('.env.example').matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((coincidencia) => coincidencia[1]);
    const sinUso = declaradas.filter((variable) => !conCuentasDelHost.includes(variable));
    expect(sinUso).toEqual([]);
  });
});

describe('eventos del canal', () => {
  it('cada evento de nombresDeEventos.js está descrito en docs/09-modelo-de-eventos.md', () => {
    const eventos = [...leer('src/shared/eventos/nombresDeEventos.js').matchAll(/:\s*'([a-z_]+\.[a-z_.]+)'/g)].map((coincidencia) => coincidencia[1]);
    const documento = leer('docs/09-modelo-de-eventos.md');
    const sinDocumentar = eventos.filter((evento) => !documento.includes(evento));
    expect(eventos.length).toBeGreaterThan(40);
    expect(sinDocumentar).toEqual([]);
  });
});

describe('Programas de ejemplo', () => {
  it('cada JSON de ejemplo está registrado en el catálogo (index.js)', () => {
    const carpeta = 'src/shared/programa/ejemplos';
    const indice = leer(`${carpeta}/index.js`);
    const sinRegistrar = readdirSync(join(RAIZ, carpeta))
      .filter((nombre) => nombre.endsWith('.json'))
      .filter((nombre) => !indice.includes(`./${nombre}`));
    expect(sinRegistrar).toEqual([]);
  });

  it('el README cuenta bien cuántos Programas de ejemplo hay', () => {
    const cantidad = readdirSync(join(RAIZ, 'src/shared/programa/ejemplos')).filter((nombre) => nombre.endsWith('.json')).length;
    expect(leer('README.md')).toContain(`(${cantidad} de ejemplo en`);
  });
});

describe('patrón de escritura', () => {
  it('las estructuras que documenta docs/14 existen en el código', () => {
    const codigo = leer('src/shared/nucleo/patronesDeEscritura/estructurasDeEscritura.js');
    const documento = leer('docs/14-control-de-lectura.md');
    for (const estructura of ['peel', 'spre', 'prep', 'cer', 'toulmin']) {
      expect(codigo).toMatch(new RegExp(`^  ${estructura}: \\{`, 'm'));
      expect(documento).toContain(`\`${estructura}\``);
    }
  });
});
