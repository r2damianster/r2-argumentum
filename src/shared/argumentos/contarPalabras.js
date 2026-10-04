// Cuenta palabras de un texto (letras y números, con tildes y ñ). Sirve para avisar mientras se
// escribe y para el filtro de «demasiado corto» en las actividades escritas.

// Mismo mínimo que el filtro del servidor (api/_revisarFormaMinima.js): menos de esto no es un
// argumento. La carpeta api/ no importa código del cliente, por eso el número se repite allí.
export const MINIMO_DE_PALABRAS_DE_UN_APORTE = 5;

export function contarPalabras(texto) {
  return (String(texto ?? '').match(/[\p{L}\p{N}]+/gu) ?? []).length;
}
