"""Comprueba «Volver a configuración» en la sala de espera: avisa que se abre una sala NUEVA (otro código)
y la sala nueva respeta las posturas que quedaron. No confirma ingresos ni llama a Groq.

Uso (desde esta carpeta, con el login del host guardado en perfil-host/):  python volver_config.py
"""
import asyncio
import re
from collections import Counter

from playwright.async_api import async_playwright

BASE = "https://r2-argumentum.vercel.app"
QUITAR = "Matizada / condicional"
PARTICIPANTES = 6


async def leer_postura(pagina):
    texto = await pagina.inner_text("body")
    coincidencia = re.search(r"Te toca defender:\s*(.+)", texto)
    return coincidencia.group(1).strip() if coincidencia else "?"


async def entrar(navegador, codigo, nombre):
    contexto = await navegador.new_context(viewport={"width": 420, "height": 900})
    pagina = await contexto.new_page()
    await pagina.goto(f"{BASE}/?sala={codigo}")
    await pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    await pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
    await pagina.click("button.boton-sorpreendeme")
    await pagina.click('button[type=submit]:has-text("Entrar")')
    await pagina.wait_for_selector("text=Te toca defender", timeout=40000)
    return pagina


async def main():
    async with async_playwright() as p:
        contexto_host = await p.chromium.launch_persistent_context(
            "perfil-host", headless=False, viewport={"width": 1280, "height": 1000}
        )
        host = contexto_host.pages[0] if contexto_host.pages else await contexto_host.new_page()
        await host.goto(BASE + "/host.html")
        await host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
        await host.click('button:has-text("Izquierda o derecha")')
        await host.click('button:has-text("Confirmar configuración y abrir sala")')
        await host.wait_for_selector(".codigo-de-sala", timeout=20000)
        codigo = (await host.inner_text(".codigo-de-sala")).strip()
        print("SALA", codigo, flush=True)

        navegador = await p.chromium.launch(headless=True)
        paginas = await asyncio.gather(*(entrar(navegador, codigo, f"V{i}") for i in range(PARTICIPANTES)))
        await asyncio.sleep(6)
        antes = Counter([await leer_postura(pagina) for pagina in paginas])
        print("ANTES (3 posturas):", dict(antes), flush=True)

        # El host vuelve a la configuración: debe avisar que se abre una sala NUEVA.
        mensajes = []

        async def aceptar(dialogo):
            mensajes.append(dialogo.message)
            await dialogo.accept()

        host.on("dialog", lambda dialogo: asyncio.ensure_future(aceptar(dialogo)))
        await host.click('button:has-text("Volver a configuración")')
        await host.wait_for_selector("text=Etapa 1", timeout=15000)
        print("PASS" if mensajes and "sala NUEVA" in mensajes[0] else "FAIL", "Aviso antes de reabrir con otro código:", (mensajes or ["(sin aviso)"])[0][:90], flush=True)
        casilla = host.locator("li", has_text=QUITAR).locator('input[type="checkbox"]')
        await casilla.uncheck()
        await host.click('button:has-text("Confirmar configuración y abrir sala")')
        await host.wait_for_selector(".codigo-de-sala", timeout=20000)
        codigo_nuevo = (await host.inner_text(".codigo-de-sala")).strip()
        print("PASS" if codigo_nuevo != codigo else "FAIL", "La sala nueva tiene otro código:", codigo, "→", codigo_nuevo, flush=True)

        # Quien entra a la sala nueva solo ve las 2 posturas que quedaron y el reparto es parejo.
        nuevas = await asyncio.gather(*(entrar(navegador, codigo_nuevo, f"N{i}") for i in range(PARTICIPANTES)))
        await asyncio.sleep(8)
        despues = Counter([await leer_postura(pagina) for pagina in nuevas])
        print("EN LA SALA NUEVA (2 posturas):", dict(despues), flush=True)
        print("PASS" if despues.get(QUITAR, 0) == 0 else "FAIL", "Nadie recibe la postura quitada:", despues.get(QUITAR, 0), flush=True)
        diferencia = max(despues.values()) - min(despues.values()) if len(despues) > 1 else max(despues.values())
        print("PASS" if diferencia <= 1 else "FAIL", "Reparto equilibrado en la sala nueva (diferencia máx.):", diferencia, flush=True)
        await navegador.close()
        await contexto_host.close()


asyncio.run(main())
