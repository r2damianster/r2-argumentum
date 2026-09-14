import { useState, useEffect } from 'react';

// Mismo set de emojis que R2 Quiz, ver docs/07-acceso-y-paginas.md.
const EMOJIS_DISPONIBLES = [
  '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐢', '🦉', '🦄', '🐝',
  '🦋', '🐙', '🦕', '🦈', '🐬', '🦖', '🐺', '🦔', '🐳', '🦩', '🦜', '🐊',
  '🦓', '🐘', '🦒', '🐌', '🐞', '🦦', '🦥', '🐇', '🐴', '🦌', '🦚', '🐲',
  '🌵', '🍀', '🌻', '🍄', '🌈', '🔥', '🌙', '⭐', '🍕', '🍩', '🍓', '🍉',
  '🥑', '🌮', '🍫', '🧋', '🎧', '🎸', '🎲', '🚀', '🛸', '🎯', '🧩', '🔮',
  '⚽', '🏀', '🛹', '🧠', '👾', '🤖', '👑', '💎',
];

export default function App() {
  const [codigoDeSala, setCodigoDeSala] = useState('');
  const [nombre, setNombre] = useState('');
  const [emojiElegido, setEmojiElegido] = useState('');
  const [yaIngreso, setYaIngreso] = useState(false);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const salaDesdeQR = parametros.get('sala');
    if (salaDesdeQR) {
      setCodigoDeSala(salaDesdeQR);
    }
  }, []);

  function elegirEmojiAlAzar() {
    const indiceAleatorio = Math.floor(Math.random() * EMOJIS_DISPONIBLES.length);
    setEmojiElegido(EMOJIS_DISPONIBLES[indiceAleatorio]);
  }

  function manejarIngreso(evento) {
    evento.preventDefault();
    // TODO: conectar con obtenerClienteAbly(participantId) y publicar presence.enter()
    // en el canal debate:{programId}:{sessionId} derivado del código de sala.
    setYaIngreso(true);
  }

  if (yaIngreso) {
    return (
      <main>
        <h1>R2 Argumentum</h1>
        <p className="texto-de-ayuda">
          Conectando a la sala {codigoDeSala} como {nombre} {emojiElegido}… (por construir: turnos,
          escritura de argumentos, conexión libre).
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>R2 Argumentum</h1>
      <h2>Unirme a la sala</h2>
      <form onSubmit={manejarIngreso}>
        <label>
          Código de sala
          <input
            value={codigoDeSala}
            onChange={(evento) => setCodigoDeSala(evento.target.value)}
            placeholder="0000"
            inputMode="numeric"
          />
        </label>
        <label>
          Tu nombre
          <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Ej. Arturo" />
        </label>
        <fieldset>
          <legend>Tu avatar</legend>
          <button type="button" className="boton-sorpreendeme" onClick={elegirEmojiAlAzar}>
            🎲 Sorpréndeme
          </button>
          <div className="grilla-de-emojis">
            {EMOJIS_DISPONIBLES.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className={emoji === emojiElegido ? 'emoji-seleccionado' : ''}
                onClick={() => setEmojiElegido(emoji)}
                aria-label={`Elegir avatar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="texto-de-ayuda">Tocá un emoji: es como te van a ver en el marcador.</p>
        </fieldset>
        <button type="submit" disabled={!codigoDeSala || !nombre || !emojiElegido}>
          Entrar
        </button>
      </form>
    </main>
  );
}
