"""Prueba en móviles EMULADOS (Chromium con perfil de cada modelo: tamaño, densidad, táctil, agente).
No sustituye a un celular físico (no hay teclado, notch ni rendimiento reales), pero detecta
desbordes, controles pequeños, texto diminuto y capas que tapan contenido en cada pantalla del flujo.

Uso (desde esta carpeta, con el login del host guardado en perfil-host/):  python moviles.py
Dura unos 6 minutos y hace unas 10 llamadas a Groq. Guarda capturas movil-*.png (ignoradas por git).
"""
import json
import re
import time

from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"
MODELOS = ["iPhone SE", "iPhone 13", "iPhone 13 Pro Max", "Pixel 7", "Galaxy S9+", "Galaxy S8", "Moto G4", "iPad Mini"]
SIN_CONFIRMAR = "Moto G4"  # queda como oyente
UMBRAL_TACTIL_PX = 44
HALLAZGOS = []  # (modelo, pantalla, tipo, detalle)
ERRORES_JS = []

TEXTOS = {
    "estado": [
        "El Estado debe redistribuir la riqueza porque la desigualdad extrema debilita la educación y la salud de los más pobres.",
        "Los servicios públicos universales son necesarios ya que garantizan igualdad de oportunidades para los hijos de familias sin recursos.",
        "La educación pública gratuita reduce la desigualdad porque permite que cualquier estudiante compita sin depender del ingreso familiar.",
        "Los impuestos progresivos financian hospitales y escuelas ya que quienes más tienen pueden aportar más sin perder su calidad de vida.",
    ],
    "mercado": [
        "La libertad de mercado genera más prosperidad porque la competencia reduce los precios y premia la innovación.",
        "Los impuestos altos frenan el crecimiento porque quitan a las empresas el dinero que necesitan para invertir y crear empleo.",
        "La propiedad privada incentiva el ahorro y la inversión ya que cada persona se beneficia del fruto de su propio esfuerzo.",
        "Los aranceles bajos benefician a los consumidores porque permiten comprar productos importados más baratos y de mejor calidad.",
    ],
    "matizada": [
        "El Estado y el mercado deben complementarse porque los mercados sin regulación generan abusos y el Estado sin incentivos genera ineficiencia.",
        "Conviene una economía mixta ya que ni la competencia total ni el control estatal total resuelven por sí solos la pobreza.",
        "Ninguna postura extrema funciona porque cada país necesita ajustar el equilibrio entre libertad económica y protección social según su contexto.",
        "Las políticas deben probarse con datos antes de generalizarse ya que lo que funciona en un país puede fallar en otro por su historia e instituciones.",
    ],
}
USADOS = {"estado": 0, "mercado": 0, "matizada": 0}

MEDIR = """() => {
  const vw = innerWidth, vh = innerHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nombre = (el) => ((el.innerText || el.placeholder || el.getAttribute('aria-label') || el.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 26);
  const controles = [...document.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, summary')].filter(visible);
  const textoPequeno = [...document.querySelectorAll('p, span, li, label, small, h1, h2, h3, button, td, th, blockquote')]
    .filter(visible)
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13);
  const fijos = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' && visible(el));
  return {
    vw, vh,
    desborda: document.documentElement.scrollWidth > vw + 1,
    anchoDelDocumento: document.documentElement.scrollWidth,
    chicos: controles.filter((el) => el.getBoundingClientRect().height < %UMBRAL%).map((el) => nombre(el) + ':' + Math.round(el.getBoundingClientRect().height)),
    fueraDePantalla: controles.filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; }).map(nombre),
    textoPequeno: [...new Set(textoPequeno.map((el) => nombre(el) + ':' + getComputedStyle(el).fontSize))].slice(0, 6),
    fijos: fijos.map((el) => ({ clase: String(el.className).slice(0, 34), ratio: +(el.getBoundingClientRect().height / vh).toFixed(2) })),
  };
}""".replace("%UMBRAL%", str(UMBRAL_TACTIL_PX))


def cuerpo(pagina):
    try:
        return pagina.inner_text("body")
    except Exception:
        return ""


def esperar(condicion, segundos, paso=1.0):
    limite = time.time() + segundos
    while time.time() < limite:
        try:
            if condicion():
                return True
        except Exception:
            pass
        time.sleep(paso)
    return False


def medir(modelo, pantalla, pagina, captura=False):
    try:
        datos = pagina.evaluate(MEDIR)
    except Exception as error:
        HALLAZGOS.append((modelo, pantalla, "error de medición", str(error)[:80]))
        return
    if datos["desborda"]:
        HALLAZGOS.append((modelo, pantalla, "DESBORDE HORIZONTAL", f'documento {datos["anchoDelDocumento"]}px en pantalla de {datos["vw"]}px'))
    if datos["fueraDePantalla"]:
        HALLAZGOS.append((modelo, pantalla, "CONTROL FUERA DE PANTALLA", ", ".join(datos["fueraDePantalla"][:4])))
    if datos["chicos"]:
        HALLAZGOS.append((modelo, pantalla, f"controles < {UMBRAL_TACTIL_PX}px", ", ".join(datos["chicos"][:5])))
    if datos["textoPequeno"]:
        HALLAZGOS.append((modelo, pantalla, "texto < 13px", ", ".join(datos["textoPequeno"][:3])))
    for fijo in datos["fijos"]:
        if fijo["ratio"] > 0.4:
            HALLAZGOS.append((modelo, pantalla, "CAPA FIJA GRANDE", f'{fijo["clase"]} ocupa {int(fijo["ratio"] * 100)}% del alto'))
    if captura:
        pagina.screenshot(path=f"movil-{modelo.replace(' ', '_').replace('+', 'mas')}-{pantalla}.png")


def verificar_barra_de_accion(modelo, pantalla, pagina):
    """La barra de acción del turno debe verse con cualquier scroll y sus botones ser verdes/rojos, grandes."""
    barra = pagina.locator(".barra-de-accion-fija")
    if not barra.count():
        HALLAZGOS.append((modelo, pantalla, "BARRA DE ACCION AUSENTE", "no hay .barra-de-accion-fija en la pantalla"))
        return
    alto = pagina.viewport_size["height"]
    for posicion, script in (("arriba", "window.scrollTo(0, 0)"), ("a mitad", "window.scrollTo(0, document.body.scrollHeight / 2)"), ("al final", "window.scrollTo(0, document.body.scrollHeight)")):
        pagina.evaluate(script)
        time.sleep(0.3)
        caja = barra.first.bounding_box()
        if caja is None or caja["y"] < -1 or caja["y"] + caja["height"] > alto + 1:
            HALLAZGOS.append((modelo, pantalla, "BARRA DE ACCION FUERA DE PANTALLA", f"scroll {posicion}: {caja}"))
        elif caja["height"] > alto * 0.45:
            HALLAZGOS.append((modelo, pantalla, "BARRA DE ACCION DEMASIADO GRANDE", f"ocupa {int(caja['height'] * 100 / alto)}% del alto en {modelo}"))
    estilo = pagina.evaluate("""() => {
      const b = document.querySelector('.barra-de-accion-fija .boton-accion-principal');
      if (!b) return null;
      const s = getComputedStyle(b); const r = b.getBoundingClientRect();
      return { fondo: s.backgroundColor, alto: Math.round(r.height), ancho: Math.round(r.width), vw: innerWidth };
    }""")
    if not estilo or estilo["alto"] < 56 or estilo["fondo"] != "rgb(21, 128, 61)":
        HALLAZGOS.append((modelo, pantalla, "BOTON PRINCIPAL SIN ENFASIS", str(estilo)))
    pagina.evaluate("window.scrollTo(0, 0)")


def entrar(navegador, playwright, codigo, modelo):
    contexto = navegador.new_context(**playwright.devices[modelo])
    pagina = contexto.new_page()
    pagina.on("pageerror", lambda error: ERRORES_JS.append(f"{modelo}: {str(error)[:120]}"))
    pagina.on("dialog", lambda dialogo: dialogo.accept())
    pagina.goto(f"{BASE}/?sala={codigo}")
    pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    medir(modelo, "1-pantalla-de-entrada", pagina, captura=modelo in ("iPhone SE", "iPad Mini"))
    pagina.fill('input[placeholder="Ej. Arturo"]', modelo.split()[0] + str(len(modelo)))
    pagina.locator("button.boton-sorpreendeme").tap()
    pagina.locator('button[type=submit]:has-text("Entrar")').tap()
    return pagina


def confirmar(pagina, modelo, indice):
    pagina.wait_for_selector("textarea", timeout=40000)
    esperar(lambda: "Te toca defender" in cuerpo(pagina), 15)
    medir(modelo, "2-ingreso-con-argumento", pagina, captura=modelo in ("iPhone SE", "Galaxy S9+"))
    asignada = cuerpo(pagina).split("Te toca defender")[-1][:60]
    bando = "mercado" if "Más mercado" in asignada else "matizada" if "Matizada" in asignada else "estado"
    texto = TEXTOS[bando][USADOS[bando] % 4]
    USADOS[bando] += 1
    area = pagina.locator("textarea")
    area.tap()
    # Teclado virtual emulado: el área visible se reduce a ~55 % y el campo debe seguir a la vista.
    alto_original = pagina.viewport_size["height"]
    pagina.set_viewport_size({"width": pagina.viewport_size["width"], "height": int(alto_original * 0.55)})
    area.fill(texto)
    time.sleep(0.4)
    caja = area.bounding_box()
    dentro = caja is not None and caja["y"] >= -2 and caja["y"] + min(caja["height"], 60) <= int(alto_original * 0.55) + 2
    if not dentro:
        HALLAZGOS.append((modelo, "2-ingreso-con-argumento", "CAMPO TAPADO CON TECLADO", f"textarea en y={caja and int(caja['y'])} con área visible de {int(alto_original * 0.55)}px"))
    medir(modelo, "2b-ingreso-con-teclado-abierto", pagina)
    pagina.set_viewport_size({"width": pagina.viewport_size["width"], "height": alto_original})
    pagina.locator('button:has-text("Revisar mi argumento")').tap()
    pagina.wait_for_selector('button:has-text("Confirmar mi ingreso")', timeout=90000)
    medir(modelo, "3-argumento-aprobado", pagina)
    pagina.locator('button:has-text("Confirmar mi ingreso")').tap()


with sync_playwright() as p:
    contexto_host = p.chromium.launch_persistent_context("perfil-host", headless=False, no_viewport=True, args=["--window-size=1400,1100"])
    host = contexto_host.pages[0] if contexto_host.pages else contexto_host.new_page()
    host.on("pageerror", lambda error: ERRORES_JS.append(f"HOST: {str(error)[:120]}"))
    host.on("dialog", lambda dialogo: dialogo.accept())
    host.goto(BASE + "/host.html")
    host.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
    host.click('button:has-text("Izquierda o derecha")')
    host.wait_for_selector('button:has-text("Confirmar configuración y abrir sala")', timeout=15000)
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    print("SALA", codigo, flush=True)

    navegador = p.chromium.launch(headless=True)
    paginas = {}
    for modelo in MODELOS:
        paginas[modelo] = entrar(navegador, p, codigo, modelo)
        time.sleep(0.5)
    time.sleep(4)
    confirmados = 0
    for indice, modelo in enumerate(MODELOS):
        if modelo == SIN_CONFIRMAR:
            continue
        try:
            confirmar(paginas[modelo], modelo, indice)
            confirmados += 1
            esperar(lambda: f"{confirmados} en el debate" in cuerpo(host), 20)
        except Exception as error:
            HALLAZGOS.append((modelo, "ingreso", "NO PUDO CONFIRMAR", str(error)[:100]))
    for modelo in MODELOS:
        medir(modelo, "4-sala-de-espera", paginas[modelo])

    host.click('button:has-text("Iniciar debate")')
    esperar(lambda: "Fase activa" in cuerpo(host), 30)
    time.sleep(3)
    for modelo in MODELOS:
        medir(modelo, "5-debate-iniciado", paginas[modelo], captura=modelo in ("iPhone SE", "Galaxy S9+", "iPad Mini"))
    print("INFO co-moderadores:", [m for m in MODELOS if "Panel de co-moderador" in cuerpo(paginas[m])], flush=True)

    # Ciclo de turnos con táctil real, midiendo cada pantalla nueva una sola vez por modelo
    vistas = set()
    inicio = time.time()
    expuestos = 0
    while time.time() - inicio < 200 and expuestos < 3:
        for modelo in MODELOS:
            pagina = paginas[modelo]
            try:
                for clave, selector, nombre_pantalla in [
                    ("turno", 'button:has-text("Aceptar y defender mi argumento")', "6-oferta-de-turno"),
                    ("exposicion", 'button:has-text("Ya lo expuse")', "7-exposicion"),
                    ("coderador", 'button:has-text("Coherente con el punto")', "8-panel-de-co-moderador"),
                    ("preparar", 'button:has-text("Revisar y publicar en el mapa")', "9-preparar-otro-argumento"),
                ]:
                    boton = pagina.locator(selector)
                    if boton.count() and (modelo, clave) not in vistas:
                        vistas.add((modelo, clave))
                        medir(modelo, nombre_pantalla, pagina, captura=modelo in ("iPhone SE", "Galaxy S9+"))
                        if clave in ("turno", "exposicion"):
                            verificar_barra_de_accion(modelo, nombre_pantalla, pagina)
                            print(f"INFO {modelo}: barra de acción verificada en «{nombre_pantalla}»", flush=True)
                boton_turno = pagina.locator('button:has-text("Aceptar y defender mi argumento")')
                if boton_turno.count():
                    boton_turno.first.tap(timeout=2000)
                    time.sleep(6)
                boton_expuse = pagina.locator('button:has-text("Ya lo expuse")')
                if boton_expuse.count():
                    if (modelo, "exposicion") not in vistas:
                        vistas.add((modelo, "exposicion"))
                        medir(modelo, "7-exposicion", pagina, captura=modelo in ("iPhone SE", "Galaxy S9+"))
                        verificar_barra_de_accion(modelo, "7-exposicion", pagina)
                        print(f"INFO {modelo}: barra de acción verificada en «7-exposicion»", flush=True)
                    boton_expuse.first.tap(timeout=2000)
                    expuestos += 1
                for boton in pagina.locator('button:has-text("Coherente con el punto")').all():
                    boton.tap(timeout=2000)
            except Exception:
                pass
        time.sleep(1.5)

    # Oyente y horizontal
    oyente = paginas[SIN_CONFIRMAR]
    medir(SIN_CONFIRMAR, "10-oyente", oyente, captura=True)
    for modelo in ("iPhone SE", "Pixel 7", "iPad Mini"):
        pagina = paginas[modelo]
        tam = pagina.viewport_size
        pagina.set_viewport_size({"width": tam["height"], "height": tam["width"]})
        time.sleep(1)
        medir(modelo, "11-horizontal", pagina, captura=modelo == "iPhone SE")
        pagina.set_viewport_size(tam)

    # Cierre
    boton_cierre = host.locator('button:has-text("Cerrar el debate ahora"), button.boton-peligro:has-text("Cerrar debate")')
    if boton_cierre.count():
        boton_cierre.first.scroll_into_view_if_needed()
        boton_cierre.first.click()
    esperar(lambda: "Marcador y Podios finales" in cuerpo(host), 60)
    time.sleep(2)
    for modelo in MODELOS:
        medir(modelo, "12a-podio-en-revelacion", paginas[modelo], captura=modelo == "iPhone SE")
    for modelo in MODELOS:
        boton_saltar = paginas[modelo].locator('button:has-text("Saltar la animación")')
        if boton_saltar.count():
            boton_saltar.first.tap()
    time.sleep(1.5)
    for modelo in MODELOS:
        medir(modelo, "12b-podio-final-con-creditos", paginas[modelo], captura=modelo in ("iPhone SE", "Galaxy S9+", "iPad Mini"))

    # ------------------ informe
    print("\n=== HALLAZGOS POR MODELO Y PANTALLA ===", flush=True)
    if not HALLAZGOS:
        print("(ninguno)")
    vistos = set()
    for hallazgo in HALLAZGOS:
        if hallazgo in vistos:
            continue
        vistos.add(hallazgo)
        print("-", " | ".join(hallazgo), flush=True)
    print("\nERRORES DE JAVASCRIPT:", ERRORES_JS or "ninguno", flush=True)
    graves = [h for h in HALLAZGOS if h[2].isupper() or h[2].startswith(("DESBORDE", "CONTROL", "CAPA", "CAMPO", "NO PUDO", "BARRA", "BOTON"))]
    print("PASS" if not graves else "FAIL", f"Sin hallazgos graves (desborde, controles fuera de pantalla, capa fija > 40 %, campo tapado): {len(graves)}", flush=True)
    print("PASS" if not ERRORES_JS else "FAIL", "Sin errores de JavaScript", flush=True)
    navegador.close()
    contexto_host.close()
