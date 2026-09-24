# Prueba automatizada en navegador (Playwright + Python)

Maneja **producción** (`https://r2-argumentum.vercel.app`): abre una sala real, entran participantes y se ejercitan la apertura, el formulario de oyentes, el cortacircuitos de la ruleta y el doble podio. Consume unas pocas llamadas reales a Groq y Ably. Local no sirve: `ABLY_API_KEY` y `GROQ_API_KEY` solo existen en Vercel.

## Requisitos
- Python con `playwright` instalado y Chromium (`pip install playwright && playwright install chromium`).
- Correr los scripts **desde esta carpeta** (usan el perfil `perfil-host/` y `programa-con-apertura.json` de la ruta actual).

## Primer uso: iniciar sesión del host
La clave del host **no se automatiza ni se guarda aquí**. Abre `host.html` con el perfil persistente y entra tú a mano una vez; el login queda guardado en `perfil-host/` (ignorado por git):

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("perfil-host", headless=False)
    ctx.new_page().goto("https://r2-argumentum.vercel.app/host.html")
    input("Inicia sesión y pulsa Enter…")
    ctx.close()
```

## Scripts
- `e2e.py` — 1 host (ventana visible) + 4 participantes headless (Ana, Beto y Carla confirman en la sala de espera; Dani queda como oyente). Comprueba oyente, cortacircuitos y doble podio. Unos 6 minutos. Imprime `PASS`/`FAIL` y guarda capturas `.png`.
- `semaforo.py` — 2 confirmados + 1 sin confirmar; deja correr la apertura de 2 min para ver verde → amarillo → rojo en el host.
- `programa-con-apertura.json` — copia del Programa de política con una fase `apertura_simultanea` de 2 min (los Programas de ejemplo no la traen).

## Notas
- Los argumentos de prueba deben coincidir con la postura asignada al azar y no parecerse entre sí, o Groq / el filtro de similitud los rechazan.
- Un `FAIL` de «Carla confirma ingreso» suele deberse a que dos participantes de la misma postura reciben el mismo texto (filtro de similitud), no a un fallo de la aplicación.
- En `e2e.py`, la comprobación «La apertura se cierra sola» falla siempre: la apertura no se cierra sola con los argumentos de ingreso (ver `docs/06-pendientes.md`, «Abierto»).
