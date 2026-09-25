# Identidad visual

## Color de marca

**Teal / turquesa oscuro** — ej. `#0D9488` (teal-600).

Por qué:
- Distinto del azul ya usado como color de marca de **R2 Quiz** (otro proyecto del usuario) — evita confundir la identidad entre productos de la familia R2.
- Los colores más "obvios" (verde, rojo, amarillo, morado, naranja) ya están reservados como **paleta semántica del grafo argumental** (ver `04-roles-y-turnos.md` y la idea original de tipos de relación):
  - 🟦 azul — argumento original
  - 🟩 verde — refuerzo
  - 🟥 rojo — contraargumento
  - 🟨 amarillo — dilema
  - 🟪 morado — reformulación
  - 🟧 naranja — concesión
  - ⬜ blanco/neutro — pregunta
- El teal queda fuera de esa paleta, así que no hay ambigüedad entre "esto es un botón de la interfaz" y "esto es un nodo del grafo con un significado específico".

## Dónde se usa el color de marca

- Encabezados y navegación de la consola del host.
- Botones de acción primaria (Entrar, Confirmar, Publicar).
- Logo/portada (`public/avatar.png`).

**Nunca** se usa el teal para colorear un nodo o una conexión dentro del grafo argumental — esa paleta es semántica y fija, definida arriba.

## Convención de marca compartida (familia R2)

- Prefijo de nombre: **R2 Argumentum** (igual patrón que R2 Quiz).
- Mismo molde de copy para la consola del host (ver `07-acceso-y-paginas.md`).
- Firma de pie de página: `R2 Argumentum — Arturo Damián Rodríguez Zambrano · Docente, investigador y vibe coder`.
- Color de marca **debe diferir** entre proyectos de la familia R2 para que cada uno sea reconocible a simple vista.

## Botones de acción del turno (24-sep-2026)

Solo para los momentos en que el debate depende de un estudiante (aceptar/rechazar el turno, «Ya lo expuse», «Terminé de hablar»). Ningún otro botón usa este tamaño ni esta combinación:

| Clase | Aspecto | Colores | Contraste |
|---|---|---|---|
| `boton-accion-principal` | ancho completo, ≥ 56 px, 1,1–1,2 rem, negrita 800, borde 3 px, anillo animado | fondo `#15803d`, texto blanco, borde `#14532d` | 5,0:1 |
| `boton-accion-rechazo` | ancho completo, ≥ 44 px, borde 2,5 px | fondo blanco, texto y borde `#b91c1c` | 6,5:1 |
| `barra-de-accion-fija` | `position: fixed` al borde inferior, máx. 40 rem | fondo `#f0fdf4`, borde superior `#15803d` 4 px | 8,7:1 (título) |

Los demás botones mantienen la escala semántica de `base.css` (`boton-primario` teal, `boton-exito` verde, `boton-peligro` rojo, `boton-secundario` con borde). El foco por teclado usa un anillo amarillo de 4 px. Regla y motivos en `docs/12`.
