# Prueba automatizada en navegador (Playwright + Python)

Maneja **producción** (`https://r2-argumentum.vercel.app`): abre una sala real, entran participantes y se ejercitan el formulario de oyentes, el cortacircuitos de la ruleta y el doble podio. Consume unas pocas llamadas reales a Groq y Ably. Local no sirve: `ABLY_API_KEY` y `GROQ_API_KEY` solo existen en Vercel.

## Requisitos
- Python con `playwright` instalado y Chromium (`pip install playwright && playwright install chromium`).
- Correr los scripts **desde esta carpeta** (usan el perfil `perfil-host/`).

## Primer uso: iniciar sesión del host
La clave del host **no se automatiza ni se guarda aquí** (vive en variables de entorno de Vercel). Abre `host.html` con el perfil persistente y entra tú a mano una vez; la sesión (token firmado, 7 días) queda en `perfil-host/` (ignorado por git):

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("perfil-host", headless=False)
    ctx.new_page().goto("https://r2-argumentum.vercel.app/host.html")
    input("Inicia sesión y pulsa Enter…")
    ctx.close()
```

## Scripts
- `login_host.py <usuario> <clave>` — inicia sesión del host en `perfil-host/` (alternativa al procedimiento manual de arriba; la clave se pasa por argumento y no se guarda).
- `e2e.py` — 1 host (ventana visible) + 4 participantes headless (Ana, Beto y Carla confirman en la sala de espera; Dani queda como oyente). Comprueba oyente, cortacircuitos y doble podio. Unos 5 minutos. Imprime `PASS`/`FAIL` y guarda capturas `.png`.
- `e2e_flujo.py` — flujo central: 8 participantes (1 con iPhone 13 emulado), turnos, exposición, co-moderadores, bid con veredicto del moderador, conexión libre, contraargumento preparado, F5 del host, cierre y ranking, móvil y errores de JavaScript. Unos 8 minutos, ~10 llamadas a Groq.
- `volver_config.py` — «Volver a configuración» en la sala de espera: aviso de sala nueva y reparto de posturas en ella.
- `confirmaciones_simultaneas.py [rondas]` — 8 personas escriben y confirman a la vez; comprueba el reparto equitativo (asignación aleatoria) y cuenta los ajustes por cupo.
- `bandos.py [salas] [participantes]` — mide el reparto de posturas con asignación aleatoria y entrada simultánea (por defecto 3 × 6). No confirma ingresos ni llama a Groq.

## Notas
- Los argumentos de prueba deben coincidir con la postura asignada al azar y no parecerse entre sí, o Groq / el filtro de similitud los rechazan.
- Un `FAIL` de «Carla confirma ingreso» suele deberse a que dos participantes de la misma postura reciben el mismo texto (filtro de similitud), no a un fallo de la aplicación.
