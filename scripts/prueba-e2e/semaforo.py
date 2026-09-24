import re, time
from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"


def cuerpo(page):
    try:
        return page.inner_text("body")
    except Exception:
        return ""


def esperar(cond, segundos, paso=1.0):
    fin = time.time() + segundos
    while time.time() < fin:
        try:
            if cond():
                return True
        except Exception:
            pass
        time.sleep(paso)
    return False


TEXTOS = {
    "estado": "El Estado debe redistribuir la riqueza porque la desigualdad extrema debilita la educación y la salud de los más pobres.",
    "mercado": "La libertad de mercado genera más prosperidad porque la competencia reduce los precios y premia la innovación.",
}

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("perfil-host", headless=False, viewport={"width": 1280, "height": 1000})
    host = ctx.pages[0] if ctx.pages else ctx.new_page()
    host.on("dialog", lambda d: d.accept())
    host.goto(BASE + "/host.html")
    host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
    host.set_input_files("input[type=file]", "programa-con-apertura.json")
    host.wait_for_selector('input[name="tiempo-apertura-inicial"]', timeout=15000)
    host.locator('input[name="tiempo-apertura-inicial"]').first.check()
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    print("SALA", codigo, flush=True)

    browser = p.chromium.launch(headless=True)
    TEXTOS_ALT = {
        "estado": ["El Estado debe redistribuir la riqueza porque la desigualdad extrema debilita la educación y la salud de los más pobres.",
                   "Los servicios públicos universales son necesarios ya que garantizan igualdad de oportunidades para los hijos de familias sin recursos."],
        "mercado": ["La libertad de mercado genera más prosperidad porque la competencia reduce los precios y premia la innovación.",
                    "Los impuestos altos frenan el crecimiento porque quitan a las empresas el dinero que necesitan para invertir y crear empleo."],
    }
    usados = {"estado": 0, "mercado": 0}
    for nombre in ["Ana", "Beto"]:
        c = browser.new_context(viewport={"width": 420, "height": 900})
        jug = c.new_page()
        jug.goto(f"{BASE}/?sala={codigo}")
        jug.wait_for_selector("text=Tu nombre", timeout=30000)
        jug.fill('input[placeholder="Ej. Arturo"]', nombre)
        jug.click("button.boton-sorpreendeme")
        jug.click('button[type=submit]:has-text("Entrar")')
        jug.wait_for_selector("textarea", timeout=40000)
        esperar(lambda: "Te toca defender" in cuerpo(jug), 15)
        bando = "mercado" if "Más mercado" in cuerpo(jug).split("Te toca defender")[-1][:60] else "estado"
        jug.fill("textarea", TEXTOS_ALT[bando][usados[bando] % 2])
        usados[bando] += 1
        jug.click('button:has-text("Revisar mi argumento")')
        jug.wait_for_selector('button:has-text("Confirmar mi ingreso")', timeout=60000)
        jug.click('button:has-text("Confirmar mi ingreso")')
    esperar(lambda: "2 en el debate" in cuerpo(host), 30)
    cd = browser.new_context(viewport={"width": 420, "height": 900})
    dani = cd.new_page()
    dani.goto(f"{BASE}/?sala={codigo}")
    dani.wait_for_selector("text=Tu nombre", timeout=30000)
    dani.fill('input[placeholder="Ej. Arturo"]', "Dani")
    dani.click("button.boton-sorpreendeme")
    dani.click('button[type=submit]:has-text("Entrar")')
    dani.wait_for_selector("textarea", timeout=40000)

    host.click('button:has-text("Iniciar debate")')
    t0 = time.time()
    esperar(lambda: host.locator(".panel-cronometro-apertura").count() > 0, 15)
    time.sleep(6)
    host.screenshot(path="semaforo-debug.png", full_page=True)
    print("HOST_BODY", cuerpo(host)[:900].replace(chr(10), " | "), flush=True)
    vistos = []
    while time.time() - t0 < 130 and (vistos or time.time() - t0 < 25):
        try:
            clase = host.locator(".panel-cronometro-apertura").first.get_attribute("class") or ""
            reloj = host.locator(".reloj-gigante-apertura").first.inner_text()
            m = re.search(r"semaforo-(verde|amarillo|rojo)", clase)
            if m and (not vistos or vistos[-1][0] != m.group(1)):
                vistos.append((m.group(1), reloj))
                print("HOST semaforo", m.group(1), "reloj", reloj, flush=True)
                host.screenshot(path=f"semaforo-host-{m.group(1)}.png")
        except Exception:
            pass
        if "Tiempo agotado" in cuerpo(host):
            break
        time.sleep(1)
    try:
        clase_p = dani.locator(".banner-cronometro-player").count()
        print("BANNER_PLAYER_DANI_VISIBLE", clase_p, "| texto:", cuerpo(dani)[:200].replace(chr(10), " | "), flush=True)
    except Exception as e:
        print("ERR player", e, flush=True)
    print("VISTOS", vistos, flush=True)
    print("TIEMPO_AGOTADO", "Tiempo agotado" in cuerpo(host), flush=True)
    browser.close()
    ctx.close()
