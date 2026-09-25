import { CREDITOS, textoDeLasHerramientas } from '../creditos.js';

// Créditos del recurso. Se muestran solo al ingresar y en la pantalla final, no durante el debate
// (para no distraer de lo que importa). Datos en src/shared/creditos.js.
export function Creditos() {
  return (
    <aside className="creditos" aria-label="Créditos">
      <img
        className="creditos__foto"
        src={CREDITOS.foto}
        alt={`Foto de ${CREDITOS.nombreCorto}`}
        width="72"
        height="72"
        loading="lazy"
        decoding="async"
      />
      <div className="creditos__texto">
        <p className="creditos__proyecto">R2 Argumentum · plataforma de debate argumental</p>
        <p className="creditos__nombre">{CREDITOS.nombreCorto}</p>
        <p className="creditos__rol">{CREDITOS.rol}</p>
        <a className="creditos__orcid" href={CREDITOS.urlDeOrcid} target="_blank" rel="noopener noreferrer">
          ORCID {CREDITOS.orcid}
        </a>
        <p className="creditos__herramientas">Recurso creado con el apoyo de {textoDeLasHerramientas()}.</p>
      </div>
    </aside>
  );
}
