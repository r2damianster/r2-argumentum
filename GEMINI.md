# GEMINI.md (Antigravity / Gemini)

Este archivo existe para que Antigravity y Gemini encuentren las reglas del proyecto.

**Lee primero [`AGENTS.md`](AGENTS.md)** (resumen de 10 reglas) y después **[`docs/12-guia-para-agentes.md`](docs/12-guia-para-agentes.md)** (guía completa y catálogo de errores ya cometidos). Las decisiones de arquitectura están en [`CLAUDE.md`](CLAUDE.md).

Recordatorios que ya costaron caro:

- Antes de subir: `npm run verificar`. Un push roto **rompe el sitio en vivo** (Vercel despliega en cada push a `main`).
- Al terminar de editar, revisa el `git diff` completo: los restos de fusión (líneas o botones duplicados, imports repetidos, JSX sin cerrar) ya causaron dos despliegues rotos.
- Los botones «Aceptar», «Rechazar», «Ya lo expuse» y «Terminé de hablar» deben verse siempre: barra fija inferior + `boton-accion-principal` / `boton-accion-rechazo`.
- No cites en la documentación funciones, eventos ni umbrales sin comprobarlos en el código.
- Ninguna clave en el repositorio (es público).
