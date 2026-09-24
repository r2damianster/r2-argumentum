// El clientId viaja en la URL de /api/ably-token y termina identificando a la persona en la
// presencia de Ably. Se acota a un formato simple para que nadie inyecte texto largo o raro.
const FORMATO_DE_CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function esClientIdValido(clientId) {
  return typeof clientId === 'string' && FORMATO_DE_CLIENT_ID.test(clientId);
}
