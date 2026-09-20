import { useState } from 'react';

const SECCIONES_DE_LA_GUIA = [
  {
    id: 'objetivo',
    titulo: '🎯 Objetivo del debate',
    contenido: (
      <div>
        <p>
          <strong>Construir un grafo de conocimiento colaborativo en tiempo real.</strong>
        </p>
        <p className="texto-de-ayuda" style={{ marginTop: '0.5rem' }}>
          Este debate no es solo una discusión verbal: es un mapa de razones entrelazadas. Tu meta es defender tu postura con argumentos sólidos, responder o reforzar las ideas de tus compañeros y encontrar puntos de encuentro rigurosos.
        </p>
      </div>
    ),
  },
  {
    id: 'redaccion',
    titulo: '✍️ ¿Cómo redactar bien?',
    contenido: (
      <div>
        <p>
          <strong>Usa la estructura: Afirmación + Razón / Evidencia.</strong>
        </p>
        <ul className="texto-de-ayuda" style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
          <li>Incluye conectores explicativos auténticos (<em>"porque..."</em>, <em>"ya que..."</em>, <em>"debido a que..."</em>).</li>
          <li>Evita respuestas de una sola palabra o meras opiniones sin justificación.</li>
          <li>Groq (la IA asistente) revisará la validez estructural de tu argumento antes de permitirte ingresar a la ruleta.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'puntaje',
    titulo: '🏆 ¿Cómo ganar puntos?',
    contenido: (
      <div>
        <p>
          <strong>El puntaje premia la participación activa y la calidad argumental:</strong>
        </p>
        <ul className="texto-de-ayuda" style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
          <li><strong>Argumento de ingreso:</strong> Otorga el puntaje base de tu posición al ser aprobado por Groq.</li>
          <li><strong>Intervención hablada:</strong> Defender tu postura oralmente al recibir el turno asignado.</li>
          <li><strong>Conexiones libres:</strong> Relacionar tus argumentos con los de otros participantes (apoyar, contraargumentar, matizar).</li>
          <li><strong>Evaluaciones de Co-moderador:</strong> Valorar con objetividad las exposiciones orales de la clase.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'comoderador',
    titulo: '👨‍⚖️ Rol de Co-moderador',
    contenido: (
      <div>
        <p>
          <strong>Si la suerte te elige como Co-moderador de la ronda:</strong>
        </p>
        <ul className="texto-de-ayuda" style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
          <li>Evalúa con <strong>imparcialidad y justicia</strong> el desempeño oral de quien tiene la palabra.</li>
          <li>Resuelve las solicitudes de intervención (bids) en equipo con tus compañeros co-moderadores.</li>
          <li>No defiendes postura durante esa fase, pero ganas bonos de puntaje por consistencia y ecuanimidad en tus decisiones.</li>
        </ul>
      </div>
    ),
  },
];

export function PanelDeGuiaPedagogica() {
  const [seccionActiva, setSeccionActiva] = useState('objetivo');

  const seccionActual = SECCIONES_DE_LA_GUIA.find((item) => item.id === seccionActiva) ?? SECCIONES_DE_LA_GUIA[0];

  return (
    <div className="panel-de-guia-pedagogica" style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <p className="texto-de-ayuda" style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>
        💡 Pautas de la sesión (para proyectar en el aula)
      </p>

      <div className="pestanas-de-guia" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        {SECCIONES_DE_LA_GUIA.map((seccion) => (
          <button
            key={seccion.id}
            type="button"
            className="boton-cambiar-programa"
            style={{
              fontWeight: seccionActiva === seccion.id ? 'bold' : 'normal',
              borderColor: seccionActiva === seccion.id ? '#2563eb' : '#cbd5e1',
              backgroundColor: seccionActiva === seccion.id ? '#eff6ff' : '#ffffff',
              color: seccionActiva === seccion.id ? '#1e40af' : '#475569',
            }}
            onClick={() => setSeccionActiva(seccion.id)}
          >
            {seccion.titulo}
          </button>
        ))}
      </div>

      <div className="contenido-de-guia" style={{ fontSize: '0.95rem', color: '#1e293b' }}>
        {seccionActual.contenido}
      </div>
    </div>
  );
}
