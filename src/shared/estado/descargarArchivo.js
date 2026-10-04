// Descarga un texto como archivo (CSV, por ejemplo) desde el navegador. Igual que descargarComoJSON
// (ver exportarSesion.js), pero con el contenido ya armado y el tipo que se elija.
export function descargarComoTexto(contenido, nombreDeArchivo, tipo = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDeArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
