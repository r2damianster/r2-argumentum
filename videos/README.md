# Videos de Argumentum

Carpeta de trabajo para videos (HyperFrames). Su contenido es **local**: está en `.gitignore`, salvo este archivo.

## Convención

- Cada video vive en `videos/<nombre-del-video>/` (proyecto HyperFrames con `index.html`, `assets/`, `renders/`).
- Lo que se quiere mostrar en la plataforma se copia a `public/video/<nombre>.mp4` y se enlaza desde `src/host/App.jsx`
  (ver `RUTA_DEL_VIDEO_EXPLICATIVO`). Eso sí se versiona y se despliega.
- Cada versión nueva publicada suma su peso al historial de git: sube solo versiones definitivas.

## Proyectos

| Carpeta | Contenido |
|---|---|
| `argumentum-explicado/` | Explicativo de 90 s con voz (Kokoro `ef_dora`) y música ambiental sintetizada. |

## Cómo crear otro video

En Claude Code, desde la raíz de este repositorio: «usa /hyperframes para hacer un video de X en `videos/<nombre>`».
Requiere Node, Chrome y FFmpeg en el PATH. Para voz local: `python -m pip install kokoro-onnx soundfile`.
Antes de renderizar: `npx hyperframes check`.
