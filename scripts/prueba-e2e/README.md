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
  (`e2e_flujo.py` incluye además: créditos al ingresar y ausentes durante el debate; podio final con revelación progresiva, salto y créditos.)
- `volver_config.py` — «Volver a configuración» en la sala de espera: aviso de sala nueva y reparto de posturas en ella.
- `confirmaciones_simultaneas.py [rondas]` — 8 personas escriben y confirman a la vez; comprueba el reparto equitativo (asignación aleatoria) y cuenta los ajustes por cupo.
- `moviles.py` — 8 modelos de móvil emulados (iPhone SE 320 px hasta iPad Mini) con toques reales, teclado emulado y horizontal; mide desbordes, controles < 44 px, texto pequeño, capas fijas y errores de JavaScript en 12 pantallas. Unos 6 minutos. Comprueba además que la barra de acción del turno («Aceptar/Rechazar», «Ya lo expuse») esté visible con cualquier scroll y con el botón principal verde y grande. No sustituye a un celular físico.
- `foro.py` — **foro escrito** (docs/13): 1 host + 6 participantes; actividad, moderación e integridad, ingreso sin argumento, publicar con la sugerencia de la IA, responder, reaccionar, detectar un pegado (canal privado), revisar, extender y cerrar, y descargar el informe (JSON y anexo). Unos 6 minutos, ~6 llamadas a Groq. **Escrito sin poder ejecutarlo contra producción: la primera corrida real puede pedir ajustes.**
- `carga-ably-y-groq.mjs [--clientes=200] [--groq=40] [--solo=ably|groq] [--mitigaciones]` — **prueba de carga EN LOCAL** con Ably y Groq reales y clientes sin interfaz. Ably: rampa de conexiones y tres patrones (A «lectura»: 1 entrega por cliente; B «foro»: 3 posts por cliente; C «ráfaga»: todos publican a la vez), midiendo entregas, latencia y errores 42913/42917. Groq: límites de la cuenta (cabeceras), ráfaga de N peticiones y cola de 2 a la vez, sin reintentos. Usa canales `debate:sala:carga-…` propios. **Gasta cuota mensual de Ably (200 clientes ≈ 130.000 entregas) y abre hasta N conexiones: no la corras durante una clase si usas la misma cuenta.** Con `--mitigaciones` los clientes simulados usan `publicarConReintentos` y el envío escalonado de la app, para comparar con la corrida sin mitigar. Resultados del 4-oct-2026 en `docs/06-pendientes.md`.
- `foro-vivo-local.mjs` — **foro escrito EN LOCAL** con Ably y Groq reales (no producción): 1 host + 6 participantes en Chrome; co-moderador, posts con la sugerencia de Groq, réplica, reacción, pegado con aviso, canal privado de integridad, extender, cerrar, informe JSON y anexo. 23 comprobaciones. Requisitos en su encabezado (`.env.local`, servidor `/api` local en 3001, `vite` en 5173 con proxy, `playwright-core`). `node foro-vivo-local.mjs`.
- `lectura-vivo-local.mjs` — **control de lectura EN LOCAL**, mismas condiciones: muestra pedagógica, 3 entregas, sugerencias de Groq en cola (anónimas, invisibles para el estudiante) y el lote que solo ofrece lo claro (nota sugerida ≥ 6, sin marcas).
- `bandos.py [salas] [participantes]` — mide el reparto de posturas con asignación aleatoria y entrada simultánea (por defecto 3 × 6). No confirma ingresos ni llama a Groq.

## Notas
- Desde octubre de 2026 el host elige primero la actividad («¿Qué actividad vas a hacer?»); todos los scripts de debate hablado hacen clic en «Debate hablado» antes de elegir el Programa.
- Los argumentos de prueba deben coincidir con la postura asignada al azar y no parecerse entre sí, o Groq / el filtro de similitud los rechazan.
- Un `FAIL` de «Carla confirma ingreso» suele deberse a que dos participantes de la misma postura reciben el mismo texto (filtro de similitud), no a un fallo de la aplicación.
