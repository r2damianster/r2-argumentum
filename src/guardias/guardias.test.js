// GUARDIAS DEL REPOSITORIO — cada prueba de este archivo existe porque el error que vigila ya
// ocurrió de verdad (ver docs/12-guia-para-agentes.md, sección «Errores ya cometidos»).
// Si una guardia falla, NO la borres ni le agregues excepciones para que pase: arregla el código.
// Corren con `npm test`, en el hook pre-push y en GitHub Actions.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', 'perfil-host', '.vercel']);
const EXTENSIONES_DE_TEXTO = ['.js', '.jsx', '.css', '.json', '.md', '.html', '.py', '.yml'];

function listarArchivos(carpeta, extensiones = EXTENSIONES_DE_TEXTO) {
  const archivos = [];
  for (const nombre of readdirSync(carpeta)) {
    if (CARPETAS_IGNORADAS.has(nombre)) {
      continue;
    }
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      archivos.push(...listarArchivos(ruta, extensiones));
    } else if (extensiones.some((extension) => nombre.endsWith(extension))) {
      archivos.push(ruta);
    }
  }
  return archivos;
}

function leer(ruta) {
  return readFileSync(ruta, 'utf-8').replace(/\r\n/g, '\n');
}

function relativa(ruta) {
  return relative(RAIZ, ruta).replace(/\\/g, '/');
}

const codigoFuente = () => [
  ...listarArchivos(join(RAIZ, 'src'), ['.js', '.jsx', '.css']),
  ...listarArchivos(join(RAIZ, 'api'), ['.js']),
];
const sinPruebas = (rutas) => rutas.filter((ruta) => !/\.test\.js$/.test(ruta));
const todoElTexto = () => listarArchivos(RAIZ).filter((ruta) => !relativa(ruta).startsWith('package-lock'));

describe('restos de fusión (Antigravity, 23-sep-2026: dos despliegues rotos y botones duplicados)', () => {
  it('no hay marcadores de conflicto de git', () => {
    const conMarcadores = todoElTexto().filter((ruta) => /^(<{7}|>{7}) |^={7}$/m.test(leer(ruta)));
    expect(conMarcadores.map(relativa)).toEqual([]);
  });

  it('no hay dos botones seguidos con el mismo texto en ningún componente', () => {
    const duplicados = [];
    for (const ruta of listarArchivos(join(RAIZ, 'src'), ['.jsx'])) {
      const texto = leer(ruta);
      for (const coincidencia of texto.matchAll(/(<button[^>]*>\s*[^<]*\s*<\/button>\s*)(<button[^>]*>\s*[^<]*\s*<\/button>)/g)) {
        const limpiar = (fragmento) => fragmento.replace(/<[^>]+>|\s+/g, ' ').trim();
        if (limpiar(coincidencia[1]) === limpiar(coincidencia[2])) {
          duplicados.push(`${relativa(ruta)}: «${limpiar(coincidencia[1])}»`);
        }
      }
    }
    expect(duplicados).toEqual([]);
  });

  it('no hay líneas de código idénticas y consecutivas (claves repetidas, imports duplicados)', () => {
    const repetidas = [];
    for (const ruta of sinPruebas(codigoFuente())) {
      const lineas = leer(ruta).split('\n');
      for (let indice = 0; indice < lineas.length - 1; indice += 1) {
        const actual = lineas[indice].trim();
        const siguiente = lineas[indice + 1].trim();
        const esComentario = /^(\/\/|\/\*|\*|\{\/\*)/.test(actual);
        if (actual === siguiente && actual.length > 25 && !esComentario) {
          repetidas.push(`${relativa(ruta)}:${indice + 1}: ${actual.slice(0, 60)}`);
        }
      }
    }
    expect(repetidas).toEqual([]);
  });
});

describe('convenciones del proyecto (CLAUDE.md)', () => {
  // Límites con \p{L}: en JavaScript `\b` no reconoce las letras con tilde («escribías» daría falso positivo).
  const PALABRAS_DE_VOSEO =
    /(?<!\p{L})(acá|escribí|elegí|podés|tenés|aceptá|rechazá|pedile|hacé|mirá|fijate|querés|sos|vos|dale)(?!\p{L})/iu;
  // Estos archivos CITAN las palabras prohibidas como ejemplo de lo que no se debe escribir.
  const CITAN_EL_VOSEO = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'docs/12-guia-para-agentes.md', 'docs/11-auditoria-antigravity-2026-09.md', 'docs/06-pendientes.md'];

  it('no hay voseo rioplatense en el código, la documentación ni los scripts', () => {
    const conVoseo = [];
    for (const ruta of todoElTexto()) {
      const nombre = relativa(ruta);
      if (CITAN_EL_VOSEO.includes(nombre) || nombre.endsWith('.test.js') || nombre.endsWith('.py')) {
        continue;
      }
      leer(ruta).split('\n').forEach((linea, indice) => {
        if (PALABRAS_DE_VOSEO.test(linea)) {
          conVoseo.push(`${nombre}:${indice + 1}: ${linea.trim().slice(0, 70)}`);
        }
      });
    }
    expect(conVoseo).toEqual([]);
  });

  it('no hay textos en línea por idioma (`lang === "en" ? ...`): el proyecto es solo en español', () => {
    const conIdiomaEnLinea = sinPruebas(codigoFuente()).filter((ruta) => /lang\s*===\s*['"]en['"]\s*\?/.test(leer(ruta)));
    expect(conIdiomaEnLinea.map(relativa)).toEqual([]);
  });

  it('no se usa reconocimiento de voz del navegador (descartado para la v1)', () => {
    const conVoz = sinPruebas(codigoFuente()).filter((ruta) => /SpeechRecognition|webkitSpeechRecognition/.test(leer(ruta)));
    expect(conVoz.map(relativa)).toEqual([]);
  });
});

describe('seguridad: nada de credenciales en el repositorio público', () => {
  it('la clave anterior del host no aparece en ningún archivo', () => {
    const NOMBRES_DE_LA_CLAVE_ANTERIOR = ['R2iron' + 'maiden', 'CLAVE_' + 'VALIDA', 'USUARIO_' + 'VALIDO'];
    const expuestos = [];
    for (const ruta of todoElTexto()) {
      const texto = leer(ruta);
      for (const nombre of NOMBRES_DE_LA_CLAVE_ANTERIOR) {
        if (texto.includes(nombre)) {
          expuestos.push(`${relativa(ruta)} contiene ${nombre}`);
        }
      }
    }
    expect(expuestos).toEqual([]);
  });

  it('HOST_PASSWORD, ABLY_API_KEY y GROQ_API_KEY solo se leen del entorno, nunca se asignan en el código', () => {
    const conValorFijo = [];
    for (const ruta of codigoFuente()) {
      if (/(HOST_PASSWORD|HOST_USER|ABLY_API_KEY|GROQ_API_KEY)\s*[:=]\s*['"`][^'"`]+['"`]/.test(leer(ruta)) && !ruta.endsWith('.test.js')) {
        conValorFijo.push(relativa(ruta));
      }
    }
    expect(conValorFijo).toEqual([]);
  });

  it('el login del host se verifica en el servidor: el cliente no compara claves', () => {
    const app = leer(join(RAIZ, 'src/host/App.jsx'));
    expect(app).toContain('iniciarSesionDelHost');
    expect(app).not.toMatch(/clave\s*===\s*/);
  });
});

describe('funciones retiradas: no deben reaparecer (docs/06, «Apertura simultánea retirada»)', () => {
  it('la fase apertura_simultanea y sus eventos ya no existen en el código', () => {
    const rutasPermitidas = ['src/host/programaDeLaSesion.js']; // solo para descartar la fase de Programas antiguos
    const reaparecidos = [];
    for (const ruta of sinPruebas(codigoFuente())) {
      const nombre = relativa(ruta);
      if (rutasPermitidas.includes(nombre)) {
        continue;
      }
      if (/apertura_simultanea|APERTURA_RONDA|tiempoAperturaMinutos|sinArgumentoDeApertura|banner-cronometro-player/.test(leer(ruta))) {
        reaparecidos.push(nombre);
      }
    }
    expect(reaparecidos).toEqual([]);
  });

  it('la documentación viva no cita identificadores que no existen', () => {
    const INEXISTENTES = ['priorizarPosturasSinExponer', 'oyente.contraargumento_enviado', 'FormularioDeArgumento.jsx'];
    const HISTORIAL = ['docs/06-pendientes.md', 'docs/11-auditoria-antigravity-2026-09.md', 'docs/12-guia-para-agentes.md', 'AGENTS.md', 'GEMINI.md'];
    const citados = [];
    for (const ruta of listarArchivos(RAIZ, ['.md'])) {
      const nombre = relativa(ruta);
      if (HISTORIAL.includes(nombre)) {
        continue;
      }
      for (const identificador of INEXISTENTES) {
        if (leer(ruta).includes(identificador)) {
          citados.push(`${nombre} cita ${identificador}`);
        }
      }
    }
    expect(citados).toEqual([]);
  });
});

describe('acciones del turno: el estudiante no puede perderse los botones (docs/12, regla 1)', () => {
  const css = () => leer(join(RAIZ, 'src/shared/estilos/base.css')) + leer(join(RAIZ, 'src/shared/estilos/sesion.css'));

  it('aceptar/rechazar el turno usan los botones de acción y la barra fija', () => {
    const oferta = leer(join(RAIZ, 'src/player/componentes/PantallaDeTurnoOfrecido.jsx'));
    expect(oferta).toContain('boton-accion-principal');
    expect(oferta).toContain('boton-accion-rechazo');
    expect(oferta).toContain('barra-de-accion-fija');
  });

  it('«Ya lo expuse» y «Terminé de hablar» usan el botón de acción y la barra fija', () => {
    for (const archivo of ['TarjetaDeExposicionEnCurso.jsx', 'IntervencionVerbal.jsx']) {
      const componente = leer(join(RAIZ, 'src/player/componentes', archivo));
      expect(componente, archivo).toContain('boton-accion-principal');
      expect(componente, archivo).toContain('barra-de-accion-fija');
    }
  });

  it('la barra es fija, el botón principal mide al menos 56 px y tiene animación que respeta reducir movimiento', () => {
    const estilos = css();
    expect(estilos).toMatch(/\.barra-de-accion-fija\s*\{[^}]*position:\s*fixed/);
    expect(estilos).toMatch(/\.boton-accion-principal\s*\{[^}]*min-height:\s*(5[6-9]|[6-9]\d)px/);
    expect(estilos).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.boton-accion-principal\s*\{\s*animation:\s*none/);
  });

  it('los botones críticos NO usan las clases discretas (sin clase = gris por defecto)', () => {
    const oferta = leer(join(RAIZ, 'src/player/componentes/PantallaDeTurnoOfrecido.jsx'));
    expect(oferta).not.toContain('boton-cambiar-programa');
    expect(oferta).not.toMatch(/<button type="button" onClick=/);
  });
});

describe('móvil: pantallas de 320 px (docs/12, regla 2)', () => {
  it('las botoneras de varios botones envuelven en lugar de salirse de la pantalla', () => {
    const estilos = leer(join(RAIZ, 'src/shared/estilos/sesion.css'));
    expect(estilos).toMatch(/\.botonera-de-bid\s*\{[^}]*flex-wrap:\s*wrap/);
  });

  it('los objetivos táctiles de avisos descartables miden al menos 44 px', () => {
    const estilos = leer(join(RAIZ, 'src/shared/estilos/sesion.css'));
    expect(estilos).toMatch(/\.boton-descartar-aviso\s*\{[^}]*min-height:\s*44px/);
  });
});

describe('proceso: lo que impide subir código roto', () => {
  it('existen el script verificar y el hook pre-push, con finales de línea LF', () => {
    const paquete = JSON.parse(leer(join(RAIZ, 'package.json')));
    expect(paquete.scripts.verificar).toBe('vitest run && vite build');
    const hook = readFileSync(join(RAIZ, '.githooks/pre-push'), 'utf-8');
    expect(hook).not.toContain('\r');
    expect(hook).toContain('npm run verificar');
  });

  it('el workflow de GitHub Actions corre las pruebas y el build', () => {
    expect(leer(join(RAIZ, '.github/workflows/verificar.yml'))).toContain('npm run verificar');
  });

  it('existen las guías para agentes que enlazan con las reglas', () => {
    for (const archivo of ['AGENTS.md', 'GEMINI.md', 'docs/12-guia-para-agentes.md']) {
      expect(statSync(join(RAIZ, archivo)).isFile(), archivo).toBe(true);
    }
  });
});

describe('créditos y podio final (docs/04, docs/12)', () => {
  it('los créditos viven en una sola constante con ORCID y herramientas de IA', () => {
    const creditos = leer(join(RAIZ, 'src/shared/creditos.js'));
    expect(creditos).toContain('0000-0002-7017-9443');
    expect(creditos).toContain('Claude');
    expect(creditos).toContain('Antigravity');
  });

  it('el ORCID y el nombre completo no se repiten a mano fuera de la constante de créditos', () => {
    const repetidos = [];
    for (const ruta of sinPruebas(codigoFuente())) {
      const nombre = relativa(ruta);
      if (nombre === 'src/shared/creditos.js') {
        continue;
      }
      const texto = leer(ruta);
      if (texto.includes('0000-0002-7017-9443') || texto.includes('Arturo Damián Rodríguez Zambrano')) {
        repetidos.push(nombre);
      }
    }
    expect(repetidos).toEqual([]);
  });

  it('la foto de los créditos es un recorte ligero (menos de 50 KB), no el retrato de 3 MB', () => {
    expect(statSync(join(RAIZ, 'public/autor.webp')).size).toBeLessThan(50 * 1024);
  });

  it('los créditos aparecen al ingresar y en el podio final, y NO durante el debate', () => {
    const app = leer(join(RAIZ, 'src/player/App.jsx'));
    expect(app).toContain('<Creditos />');
    expect(app.match(/<Creditos \/>/g)).toHaveLength(1); // solo en la pantalla de ingreso
    expect(leer(join(RAIZ, 'src/player/componentes/PodioFinalParaParticipantes.jsx'))).toContain('<Creditos />');
  });

  it('el podio final solo se muestra con el debate realmente cerrado y se puede saltar', () => {
    const app = leer(join(RAIZ, 'src/player/App.jsx'));
    expect(app).toMatch(/estado\.sesion\.cerrada\s*&&\s*\(\s*<PodioFinalParaParticipantes/);
    const podio = leer(join(RAIZ, 'src/player/componentes/PodioFinalParaParticipantes.jsx'));
    expect(podio).toContain('Saltar la animación');
    expect(podio).toContain('useRevelacionPorEtapas');
  });

  it('el podio se lleva solo a la pantalla al cerrarse el debate (la página puede estar desplazada)', () => {
    const podio = leer(join(RAIZ, 'src/player/componentes/PodioFinalParaParticipantes.jsx'));
    expect(podio).toContain('useAtencionDelTurno');
    expect(podio).toMatch(/bloque:\s*'start'/);
  });

  it('la revelación respeta «reducir movimiento» (sin animaciones ni esperas)', () => {
    expect(leer(join(RAIZ, 'src/shared/estilos/sesion.css'))).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.escalon--revelado/);
    expect(leer(join(RAIZ, 'src/player/podio/useRevelacionPorEtapas.js'))).toContain('prefers-reduced-motion');
  });
});
