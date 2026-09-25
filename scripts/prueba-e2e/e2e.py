import re, time, sys
from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"
RESULTADOS = []


def check(nombre, ok, detalle=""):
    RESULTADOS.append((nombre, ok, detalle))
    print(("PASS " if ok else "FAIL ") + nombre + (f" — {detalle}" if detalle else ""), flush=True)


ARGUMENTOS_POR_BANDO = {
    "estado": [
        "El Estado debe redistribuir la riqueza porque la desigualdad extrema debilita la educación y la salud de los más pobres.",
        "Los servicios públicos universales son necesarios ya que garantizan igualdad de oportunidades para los hijos de familias sin recursos.",
    ],
    "matizada": [
        "El Estado y el mercado deben complementarse porque los mercados sin regulación generan abusos y el Estado sin incentivos genera ineficiencia.",
        "Conviene una economía mixta ya que ni la competencia total ni el control estatal total resuelven por sí solos la pobreza.",
    ],
    "mercado": [
        "La libertad de mercado genera más prosperidad porque la competencia reduce los precios y premia la innovación.",
        "Los impuestos altos frenan el crecimiento porque quitan a las empresas el dinero que necesitan para invertir y crear empleo.",
    ],
}
USADOS = {"estado": 0, "mercado": 0, "matizada": 0}
TEXTO_OYENTE = "Esa defensa del Estado falla porque cuando el gobierno controla los precios aparecen la escasez y el mercado negro, y eso perjudica a los más pobres."


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


def entrar_jugador(browser, codigo, nombre):
    ctx = browser.new_context(viewport={"width": 420, "height": 900})
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())
    page.goto(f"{BASE}/?sala={codigo}")
    page.wait_for_selector("text=Tu nombre", timeout=30000)
    page.fill('input[placeholder="Ej. Arturo"]', nombre)
    page.click("button.boton-sorpreendeme")
    page.click('button[type=submit]:has-text("Entrar")')
    return page


def escribir_y_confirmar(page, nombre):
    page.wait_for_selector("textarea", timeout=40000)
    esperar(lambda: "Te toca defender" in cuerpo(page), 15)
    texto_pagina = cuerpo(page)
    asignada = texto_pagina.split("Te toca defender")[-1][:60]
    bando = "mercado" if "Más mercado" in asignada else "matizada" if "Matizada" in asignada else "estado"
    texto = ARGUMENTOS_POR_BANDO[bando][USADOS[bando] % 2]
    USADOS[bando] += 1
    print(f"INFO {nombre} defiende {bando}", flush=True)
    botones_postura = page.locator(".lista-de-posturas-para-elegir button")
    if botones_postura.count():
        botones_postura.first.click()
    page.fill("textarea", texto)
    page.click('button:has-text("Revisar mi argumento")')
    page.wait_for_selector('button:has-text("Confirmar mi ingreso")', timeout=60000)
    page.click('button:has-text("Confirmar mi ingreso")')


with sync_playwright() as p:
    ctx_host = p.chromium.launch_persistent_context("perfil-host", headless=False, viewport={"width": 1280, "height": 1000})
    host = ctx_host.pages[0] if ctx_host.pages else ctx_host.new_page()
    host.on("dialog", lambda d: d.accept())
    host.goto(BASE + "/host.html")
    host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
    host.click('button:has-text("Izquierda o derecha")')
    host.wait_for_selector('button:has-text("Confirmar configuración y abrir sala")', timeout=15000)
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    print("SALA", codigo, flush=True)
    check("Host abre la sala", bool(re.fullmatch(r"\d{4}", codigo)), codigo)

    browser = p.chromium.launch(headless=True)
    jugadores = {}
    for nombre in ["Ana", "Beto", "Carla", "Dani"]:
        jugadores[nombre] = entrar_jugador(browser, codigo, nombre)
        time.sleep(1)
    time.sleep(6)

    # Ana, Beto y Carla escriben y confirman EN LA SALA DE ESPERA; Dani NO (sera oyente)
    for nombre in ["Ana", "Beto", "Carla"]:
        try:
            escribir_y_confirmar(jugadores[nombre], nombre)
        except Exception as error:
            check(f"{nombre} confirma ingreso", False, str(error)[:150])
    texto_host = cuerpo(host)
    check("Host ve a los 3 confirmados en la sala de espera",
          esperar(lambda: "3 en el debate" in cuerpo(host), 30), texto_host[texto_host.find("Marcador"):][:60].replace(chr(10), " "))

    host.click('button:has-text("Iniciar debate")')
    check("Se pasa a la fase de turnos", esperar(lambda: "Fase activa" in cuerpo(host) and "Ruleta" in cuerpo(host), 30))

    # OYENTE: Dani ve formulario de contraargumento
    dani = jugadores["Dani"]
    check("Dani ve el formulario de contraargumento de oyentes",
          esperar(lambda: dani.locator("text=Formular un contraargumento como oyente").count() > 0, 40))
    dani.screenshot(path="04-oyente-formulario.png")
    hay_selector_postura = dani.locator("text=Postura desde la que contraargumentas").count() > 0
    check("El formulario pide elegir postura (cambio nuevo)", hay_selector_postura)
    if hay_selector_postura:
        selects = dani.locator("section.tarjeta-de-ingreso select")
        esperar(lambda: selects.nth(0).locator("option").count() > 1, 20)
        selects.nth(0).select_option(index=1)
        selects.nth(1).select_option(label="Más mercado / libertad individual")
        dani.fill("textarea", TEXTO_OYENTE)
        boton_revisar = dani.locator('button:has-text("Revisar contraargumento")')
        check("Revisar habilitado con objetivo, postura y texto", boton_revisar.is_enabled())
        boton_revisar.click()
        aprobado = esperar(lambda: dani.locator('button:has-text("Publicar contraargumento")').count() > 0, 60)
        check("Groq aprueba el contraargumento y aparece Publicar", aprobado,
              "" if aprobado else cuerpo(dani)[-300:].replace("\n", " "))
        if aprobado:
            dani.fill("textarea", TEXTO_OYENTE + " Además")
            check("Editar el texto retira el botón Publicar (atado al texto revisado)",
                  dani.locator('button:has-text("Publicar contraargumento")').count() == 0)
            dani.fill("textarea", TEXTO_OYENTE)
            dani.click('button:has-text("Revisar contraargumento")')
            reaprobado = esperar(lambda: dani.locator('button:has-text("Publicar contraargumento")').count() > 0, 60)
            if not reaprobado:
                dani.screenshot(path="08-oyente-segunda-revision.png")
                print("DEBUG dani:", cuerpo(dani)[-600:].replace(chr(10), " | "), flush=True)
            check("Tras volver al texto original y revisar de nuevo se puede publicar", reaprobado)
            if reaprobado:
                dani.click('button:has-text("Publicar contraargumento")')
            if reaprobado:
                check("Dani deja de ser oyente tras publicar",
                      esperar(lambda: dani.locator("text=Formular un contraargumento como oyente").count() == 0, 30))
                dani.screenshot(path="05-oyente-publicado.png")

    # CORTACIRCUITOS: todos rechazan cada oferta de turno hasta que la ruleta se pause
    def rechazar_ofertas():
        for nombre in ["Ana", "Beto", "Carla", "Dani"]:
            boton = jugadores[nombre].locator('button:has-text("Rechazar")')
            if boton.count():
                try:
                    boton.first.click(timeout=2000)
                except Exception:
                    pass

    pausada = esperar(lambda: (rechazar_ofertas(), "ruleta de turnos está pausada" in cuerpo(host).lower())[1], 240, paso=1.5)
    check("Cortacircuitos: tras rechazos consecutivos la ruleta se pausa y el host recibe la alerta", pausada)
    host.screenshot(path="06-ruleta-pausada-host.png")
    if pausada:
        check("Host ve botón 'Reanudar ruleta'", host.locator('button:has-text("Reanudar ruleta")').count() > 0)
        host.locator('button:has-text("Reanudar ruleta")').first.click()
        check("Reanudar quita la alerta de pausa",
              esperar(lambda: "ruleta de turnos está pausada" not in cuerpo(host).lower(), 20))

    # DOBLE PODIO: cerrar debate y comprobar orden
    boton_cerrar = host.locator('button:has-text("Cerrar el debate ahora")')
    if boton_cerrar.count():
        boton_cerrar.first.scroll_into_view_if_needed()
        boton_cerrar.first.click()
    check("El debate se cierra y aparece el ranking final", esperar(lambda: "Marcador y Podios finales" in cuerpo(host), 40))
    host.screenshot(path="07-ranking-final.png", full_page=True)
    texto_host = cuerpo(host)
    i1 = texto_host.find("1. Podio de Posturas")
    i2 = texto_host.find("2. Podio Individual")
    i3 = texto_host.find("3. Desglose")
    check("Ranking en vivo: 1) Podio de Posturas, 2) Podio Individual, 3) Desglose", 0 <= i1 < i2 < i3, f"{i1},{i2},{i3}")
    informe = host.locator(".informe-del-debate")
    if informe.count():
        titulos = informe.first.locator("h2").all_inner_texts()
        check("Informe: primero lista individual, luego colaborativa por postura",
              len(titulos) >= 2 and "Individual" in titulos[0] and "Postura" in titulos[1], str(titulos))
    else:
        check("Informe del debate presente en el DOM", False)
    check("Ranking incluye a los 4 participantes", all(n in texto_host for n in ["Ana", "Beto", "Carla", "Dani"]))

    print("\nRESUMEN:", sum(1 for r in RESULTADOS if r[1]), "PASS /", sum(1 for r in RESULTADOS if not r[1]), "FAIL", flush=True)
    browser.close()
    ctx_host.close()
