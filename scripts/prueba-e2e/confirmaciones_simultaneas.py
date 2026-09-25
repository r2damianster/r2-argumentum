"""8 personas escriben y confirman su ingreso AL MISMO TIEMPO (asignación aleatoria, 3 posturas).
Comprueba que el reparto final queda equitativo (diferencia máxima 1) aunque las confirmaciones
choquen, y cuenta cuántas personas tuvieron que ajustar su argumento por el cupo de la postura.

Uso (desde esta carpeta, con el login del host guardado en perfil-host/):  python confirmaciones_simultaneas.py [rondas]
Cada ronda abre una sala nueva y hace unas 8-16 llamadas a Groq.
"""
import asyncio
import re
import sys
from collections import Counter

from playwright.async_api import async_playwright

BASE = "https://r2-argumentum.vercel.app"
RONDAS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
PARTICIPANTES = 8

TEXTOS = {
    "Más estado": [
        "El Estado debe redistribuir la riqueza porque la desigualdad extrema debilita la educación y la salud de los más pobres.",
        "Los servicios públicos universales son necesarios ya que garantizan igualdad de oportunidades para los hijos de familias sin recursos.",
        "La educación pública gratuita reduce la desigualdad porque permite que cualquier estudiante compita sin depender del ingreso familiar.",
        "Los impuestos progresivos financian hospitales y escuelas ya que quienes más tienen pueden aportar más sin perder su calidad de vida.",
    ],
    "Más mercado": [
        "La libertad de mercado genera más prosperidad porque la competencia reduce los precios y premia la innovación.",
        "Los impuestos altos frenan el crecimiento porque quitan a las empresas el dinero que necesitan para invertir y crear empleo.",
        "La propiedad privada incentiva el ahorro y la inversión ya que cada persona se beneficia del fruto de su propio esfuerzo.",
        "Los aranceles bajos benefician a los consumidores porque permiten comprar productos importados más baratos y de mejor calidad.",
    ],
    "Matizada": [
        "El Estado y el mercado deben complementarse porque los mercados sin regulación generan abusos y el Estado sin incentivos genera ineficiencia.",
        "Conviene una economía mixta ya que ni la competencia total ni el control estatal total resuelven por sí solos la pobreza.",
        "Ninguna postura extrema funciona porque cada país necesita ajustar el equilibrio entre libertad económica y protección social según su contexto.",
        "Las políticas deben probarse con datos antes de generalizarse ya que lo que funciona en un país puede fallar en otro por su historia e instituciones.",
    ],
}


def bando_de(texto_pantalla):
    asignada = texto_pantalla.split("Te toca defender")[-1][:60]
    return "Más mercado" if "Más mercado" in asignada else "Matizada" if "Matizada" in asignada else "Más estado"


async def persona(navegador, codigo, indice):
    contexto = await navegador.new_context(viewport={"width": 420, "height": 900})
    pagina = await contexto.new_page()
    await pagina.goto(f"{BASE}/?sala={codigo}")
    await pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    await pagina.fill('input[placeholder="Ej. Arturo"]', f"S{indice}")
    await pagina.click("button.boton-sorpreendeme")
    await pagina.click('button[type=submit]:has-text("Entrar")')
    await pagina.wait_for_selector("text=Te toca defender", timeout=40000)
    return pagina


async def escribir_revisar_y_confirmar(pagina, indice, ajustes):
    """Devuelve la etiqueta de la postura final. Si el cupo obliga a cambiar, reescribe y reintenta."""
    usados = 0
    for _ in range(3):
        bando = bando_de(await pagina.inner_text("body"))
        texto = TEXTOS[bando][(indice + usados) % 4]
        usados += 1
        await pagina.fill("textarea", texto)
        await pagina.click('button:has-text("Revisar mi argumento")')
        try:
            await pagina.wait_for_selector('button:has-text("Confirmar mi ingreso")', timeout=90000)
        except Exception:
            continue
        await pagina.click('button:has-text("Confirmar mi ingreso")')
        await asyncio.sleep(3)
        pantalla = await pagina.inner_text("body")
        if "ahora te toca defender" in pantalla:
            ajustes.append(indice)
            continue
        return bando
    return "sin confirmar"


async def una_ronda(p, host, navegador, numero):
    await host.goto(BASE + "/host.html")
    await host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
    await host.click('button:has-text("Izquierda o derecha")')
    await host.click('button:has-text("Confirmar configuración y abrir sala")')
    await host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = (await host.inner_text(".codigo-de-sala")).strip()
    paginas = await asyncio.gather(*(persona(navegador, codigo, i) for i in range(PARTICIPANTES)))
    await asyncio.sleep(6)
    ajustes = []
    finales = await asyncio.gather(*(escribir_revisar_y_confirmar(pagina, i, ajustes) for i, pagina in enumerate(paginas)))
    await asyncio.sleep(4)
    # Reparto real registrado en el marcador del host
    marcador = (await host.inner_text("body")).split("Marcador en vivo")[-1]
    reparto = {etiqueta: len(re.findall(etiqueta, marcador)) for etiqueta in ["Más estado", "Más mercado", "Matizada"]}
    diferencia = max(reparto.values()) - min(reparto.values())
    print(f"RONDA {numero} sala {codigo}: reparto en el marcador {reparto}; ajustes por cupo: {len(ajustes)}; sin confirmar: {finales.count('sin confirmar')}", flush=True)
    print("PASS" if diferencia <= 1 else "FAIL", f"Ronda {numero}: reparto equitativo con confirmaciones simultáneas (diferencia {diferencia})", flush=True)
    return diferencia


async def main():
    async with async_playwright() as p:
        contexto_host = await p.chromium.launch_persistent_context("perfil-host", headless=False, no_viewport=True, args=["--window-size=1400,1100"])
        host = contexto_host.pages[0] if contexto_host.pages else await contexto_host.new_page()
        navegador = await p.chromium.launch(headless=True)
        for numero in range(1, RONDAS + 1):
            await una_ronda(p, host, navegador, numero)
        await navegador.close()
        await contexto_host.close()


asyncio.run(main())
