// "Descargar PDF" sin librería: se abre el diálogo de impresión del navegador (destino "Guardar
// como PDF") y el CSS `@media print` deja solo el informe. El PDF resultante tiene texto real,
// seleccionable y buscable. Ver InformeDelDebate.jsx.
//
// El navegador propone como nombre de archivo el título de la página, así que se le pone uno
// descriptivo mientras dura la impresión y después se restaura.
export function imprimirInformeComoPDF(tituloDelDebate) {
  const tituloOriginal = document.title;
  const fecha = new Date().toISOString().slice(0, 10);
  document.title = `Informe R2 Argumentum - ${tituloDelDebate} - ${fecha}`;

  function restaurarTitulo() {
    document.title = tituloOriginal;
    window.removeEventListener('afterprint', restaurarTitulo);
  }
  window.addEventListener('afterprint', restaurarTitulo);
  window.print();
}
