"""Mide el reparto de posturas con asignación aleatoria cuando varios participantes entran a la vez.

Uso (desde esta carpeta, con el login del host ya guardado en perfil-host/):
    python bandos.py [salas] [participantes]
Por defecto: 3 salas x 6 participantes entrando en paralelo. No confirma ingresos ni llama a Groq.
"""
import asyncio
import re
import sys
from collections import Counter

from playwright.async_api import async_playwright

BASE = "https://r2-argumentum.vercel.app"
SALAS = int(sys.argv[1]) if len(sys.argv) > 1 else 3
PARTICIPANTES = int(sys.argv[2]) if len(sys.argv) > 2 else 6


async def entrar(browser, codigo, nombre):
    contexto = await browser.new_context(viewport={"width": 420, "height": 900})
    pagina = await contexto.new_page()
    await pagina.goto(f"{BASE}/?sala={codigo}")
    await pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    await pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
    await pagina.click("button.boton-sorpreendeme")
    await pagina.click('button[type=submit]:has-text("Entrar")')
    await pagina.wait_for_selector("text=Te toca defender", timeout=40000)
    # La asignación se recalcula mientras nadie escribe: se espera a que se estabilice.
    await asyncio.sleep(8)
    texto = await pagina.inner_text("body")
    coincidencia = re.search(r"Te toca defender:\s*(.+)", texto)
    return coincidencia.group(1).strip() if coincidencia else "?"


async def main():
    async with async_playwright() as p:
        contexto_host = await p.chromium.launch_persistent_context(
            "perfil-host", headless=False, viewport={"width": 1280, "height": 1000}
        )
        host = contexto_host.pages[0] if contexto_host.pages else await contexto_host.new_page()
        host.on("dialog", lambda dialogo: asyncio.ensure_future(dialogo.accept()))
        navegador = await p.chromium.launch(headless=True)
        totales = []
        for numero_de_sala in range(1, SALAS + 1):
            await host.goto(BASE + "/host.html")
            await host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
            await host.click('button:has-text("Izquierda o derecha")')
            await host.click('button:has-text("Confirmar configuración y abrir sala")')
            await host.wait_for_selector(".codigo-de-sala", timeout=20000)
            codigo = (await host.inner_text(".codigo-de-sala")).strip()
            nombres = [f"P{numero_de_sala}{indice}" for indice in range(PARTICIPANTES)]
            posturas = await asyncio.gather(*(entrar(navegador, codigo, nombre) for nombre in nombres))
            conteo = Counter(posturas)
            print(f"SALA {codigo}: {dict(conteo)}", flush=True)
            totales.append(conteo)
        peor = max(max(c.values()) - min(c.values()) if len(c) > 1 else max(c.values()) for c in totales)
        print("DIFERENCIA MAXIMA ENTRE BANDOS (posturas con al menos 1 persona):", peor, flush=True)
        await navegador.close()
        await contexto_host.close()


asyncio.run(main())
