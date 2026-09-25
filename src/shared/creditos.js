// Créditos del recurso. Única fuente de estos datos: la pantalla de ingreso del participante, el
// podio final, el pie de la consola del host y el informe imprimible los leen de aquí.
// No los repitas a mano en otros componentes.

export const CREDITOS = {
  nombreCorto: 'Arturo Rodríguez',
  nombreCompleto: 'Arturo Damián Rodríguez Zambrano',
  rol: 'Docente, investigador y vibe coder',
  orcid: '0000-0002-7017-9443',
  urlDeOrcid: 'https://orcid.org/0000-0002-7017-9443',
  herramientasDeIA: ['Claude', 'Antigravity'],
  // Recorte circular y ligero (10 KB) de la cara; el retrato completo (public/avatar.png, 3,2 MB)
  // solo lo usa la portada del host.
  foto: '/autor.webp',
};

export function textoDeLasHerramientas() {
  return CREDITOS.herramientasDeIA.join(' y ');
}

// Versión en una sola línea para pies de página y documentos impresos.
export function textoDeCreditos() {
  return `R2 Argumentum — ${CREDITOS.nombreCompleto} · ${CREDITOS.rol} · ORCID ${CREDITOS.orcid} · Recurso creado con el apoyo de ${textoDeLasHerramientas()}`;
}
