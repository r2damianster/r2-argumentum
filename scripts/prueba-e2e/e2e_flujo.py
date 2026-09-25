"""Flujo central del debate contra producción: turnos, exposición, calificación de co-moderadores,
prepararación de un contraargumento, bid, conexión libre, sugerencias de Groq, cierre y ranking.
Además: recarga (F5) del host en pleno debate, un participante con móvil emulado y captura de
errores de JavaScript en todas las pantallas.

Uso (desde esta carpeta, con el login del host ya guardado en perfil-host/):  python e2e_flujo.py
Dura unos 6 minutos y hace ~10 llamadas reales a Groq.
"""
import re
import time

from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"
RESULTADOS = []
ERRORES_DE_PAGINA = []

NOMBRES = ["Ana", "Beto", "Carla", "Dani", "Eva", "Fito", "Gala", "Hugo"]
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
# El contraargumento debe coincidir con la postura de quien lo escribe, o Groq lo rechaza por «postura distinta».
CONTRAARGUMENTO_POR_BANDO = {
    "mercado": "Ese planteamiento falla porque los precios controlados generan escasez y mercado negro, y eso termina perjudicando a los más pobres.",
    "estado": "Ese planteamiento falla porque sin regulación los mercados concentran el poder en pocas empresas y perjudican a los consumidores más pobres.",
    "matizada": "Ese planteamiento es demasiado extremo porque ni el mercado ni el Estado resuelven la pobreza por sí solos, y conviene combinar ambos con reglas claras.",
}
TEXTO_BID = "Los mercados sin reglas tampoco funcionan porque sin competencia real las grandes empresas fijan los precios a su conveniencia."


def check(nombre, ok, detalle=""):
    RESULTADOS.append((nombre, ok, detalle))
    print(("PASS " if ok else "FAIL ") + nombre + (f" — {detalle}" if detalle else ""), flush=True)


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


def vigilar(pagina, etiqueta):
    pagina.on("pageerror", lambda error: ERRORES_DE_PAGINA.append(f"{etiqueta}: {str(error)[:160]}"))


def entrar_jugador(navegador, codigo, nombre, **opciones_de_contexto):
    contexto = navegador.new_context(**({"viewport": {"width": 420, "height": 900}} | opciones_de_contexto))
    pagina = contexto.new_page()
    vigilar(pagina, nombre)
    pagina.on("dialog", lambda dialogo: dialogo.accept())
    pagina.goto(f"{BASE}/?sala={codigo}")
    pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    if nombre == "Ana":
        enlace = pagina.locator(".creditos a.creditos__orcid")
        check("Créditos al ingresar: foto, nombre, ORCID y herramientas de IA",
              pagina.locator(".creditos img.creditos__foto").count() == 1
              and "Arturo Rodríguez" in cuerpo(pagina)
              and enlace.get_attribute("href") == "https://orcid.org/0000-0002-7017-9443"
              and "Claude y Antigravity" in cuerpo(pagina))
        foto_cargada = pagina.evaluate("() => { const i = document.querySelector('.creditos__foto'); return i.complete && i.naturalWidth > 0; }")
        check("La foto de los créditos carga (recorte ligero)", esperar(lambda: pagina.evaluate("() => { const i = document.querySelector('.creditos__foto'); return i.complete && i.naturalWidth > 0; }"), 10) or foto_cargada)
    pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
    pagina.click("button.boton-sorpreendeme")
    pagina.click('button[type=submit]:has-text("Entrar")')
    return pagina


def confirmar_ingreso(pagina, nombre):
    pagina.wait_for_selector("textarea", timeout=40000)
    esperar(lambda: "Te toca defender" in cuerpo(pagina), 15)
    asignada = cuerpo(pagina).split("Te toca defender")[-1][:60]
    bando = "mercado" if "Más mercado" in asignada else "matizada" if "Matizada" in asignada else "estado"
    for intento in range(2):
        texto = TEXTOS[bando][USADOS[bando] % 4]
        USADOS[bando] += 1
        pagina.fill("textarea", texto)
        pagina.click('button:has-text("Revisar mi argumento")')
        if esperar(lambda: pagina.locator('button:has-text("Confirmar mi ingreso")').count() > 0, 60):
            pagina.click('button:has-text("Confirmar mi ingreso")')
            return texto
        print(f"INFO {nombre} ({bando}) no pasó Groq en el intento {intento + 1}: {cuerpo(pagina)[-260:]!r}", flush=True)
    raise RuntimeError(f"{nombre} no logró confirmar su ingreso")


def contar_nodos_y_aristas(host):
    return (
        host.locator(".react-flow__node").count(),
        host.locator(".react-flow__edge").count(),
    )


with sync_playwright() as p:
    contexto_host = p.chromium.launch_persistent_context("perfil-host", headless=False, no_viewport=True, args=["--window-size=1400,1100"])
    host = contexto_host.pages[0] if contexto_host.pages else contexto_host.new_page()
    vigilar(host, "HOST")
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
    jugadores = {}
    for indice, nombre in enumerate(NOMBRES):
        if nombre == "Hugo":  # móvil emulado
            jugadores[nombre] = entrar_jugador(navegador, codigo, nombre, **p.devices["iPhone 13"])
        else:
            jugadores[nombre] = entrar_jugador(navegador, codigo, nombre)
        time.sleep(0.5)
    time.sleep(5)
    confirmados = 0
    for nombre in NOMBRES:
        try:
            confirmar_ingreso(jugadores[nombre], nombre)
            confirmados += 1
            # Sin esta espera, la persona siguiente calcula su postura con conteos viejos.
            esperar(lambda: f"{confirmados} en el debate" in cuerpo(host), 20)
        except Exception as error:
            check(f"{nombre} confirma su ingreso", False, str(error)[:120])
    check("Los 8 participantes confirmaron su ingreso", esperar(lambda: "8 en el debate" in cuerpo(host), 60),
          re.search(r"Marcador en vivo \(([^)]*)\)", cuerpo(host)).group(1) if re.search(r"Marcador en vivo \(([^)]*)\)", cuerpo(host)) else "")

    roster = cuerpo(host)
    reparto = {etiqueta: len(re.findall(re.escape(etiqueta), roster.split("Marcador en vivo")[-1])) for etiqueta in ["Más estado", "Más mercado", "Matizada"]}
    print("INFO reparto de posturas con confirmación secuencial:", reparto, flush=True)
    check("Reparto de posturas equilibrado con confirmación secuencial (diferencia <= 1)", max(reparto.values()) - min(reparto.values()) <= 1, str(reparto))
    host.click('button:has-text("Iniciar debate")')
    check("Se pasa a la fase de turnos", esperar(lambda: "Fase activa" in cuerpo(host) and "Ruleta" in cuerpo(host), 30))
    esperar(lambda: any("Panel de co-moderador" in cuerpo(jugadores[n]) for n in NOMBRES), 20)
    comoderadores = [n for n in NOMBRES if "Panel de co-moderador" in cuerpo(jugadores[n])]
    participantes = [n for n in NOMBRES if n not in comoderadores]
    check("Se sortearon co-moderadores (al menos 1)", len(comoderadores) >= 1, f"co-moderadores: {comoderadores}")
    nodos_antes, aristas_antes = contar_nodos_y_aristas(host)
    print(f"INFO grafo inicial: {nodos_antes} nodos, {aristas_antes} aristas", flush=True)

    # ---------- ciclo de turnos: aceptar, exponer, calificar; un bid; una conexión libre
    estado_de = {"aceptados": [], "expuestos": [], "calificaciones": 0, "bid": False, "votos_de_bid": 0,
                 "conexion_libre": False, "contraargumento": None}
    visto_exponiendo = {}
    inicio = time.time()
    while time.time() - inicio < 300:
        for nombre in participantes:
            pagina = jugadores[nombre]
            try:
                boton_aceptar = pagina.locator('button:has-text("Aceptar y defender mi argumento")')
                if boton_aceptar.count():
                    boton_aceptar.first.click(timeout=2000)
                    estado_de["aceptados"].append(nombre)
                    visto_exponiendo[nombre] = time.time()
                boton_expuse = pagina.locator('button:has-text("Ya lo expuse")')
                if boton_expuse.count():
                    visto_exponiendo.setdefault(nombre, time.time())
                    if time.time() - visto_exponiendo[nombre] > 6:
                        boton_expuse.first.click(timeout=2000)
                        estado_de["expuestos"].append(nombre)
                        visto_exponiendo.pop(nombre, None)
                # bid: alguien que NO habla lanza un bid mientras otro tiene el turno
                if not estado_de["bid"] and pagina.locator('button:has-text("Lanzar bid")').count() and nombre not in estado_de["aceptados"]:
                    pagina.select_option('.tarjeta-de-bid select >> nth=0', "fortalecer")
                    objetivo = pagina.locator(".tarjeta-de-bid select >> nth=1")
                    if objetivo.locator("option").count() > 1:
                        objetivo.select_option(index=1)
                        pagina.fill(".tarjeta-de-bid textarea", TEXTO_BID)
                        pagina.click('button:has-text("Lanzar bid")')
                        estado_de["bid"] = nombre
                # conexión libre: alguien con argumento libre conecta con otro
                if not estado_de["conexion_libre"] and pagina.locator('button:has-text("Conectar")').count():
                    selects = pagina.locator(".tarjeta-de-conexion-libre select")
                    if selects.count() >= 3 and selects.nth(0).locator("option").count() > 1 and selects.nth(1).locator("option").count() > 1:
                        selects.nth(0).select_option(index=1)
                        selects.nth(1).select_option(index=1)
                        pagina.click('.tarjeta-de-conexion-libre button:has-text("Conectar")')
                        estado_de["conexion_libre"] = nombre
            except Exception:
                pass
        for nombre in comoderadores:
            pagina = jugadores[nombre]
            try:
                for boton in pagina.locator('button:has-text("Coherente con el punto")').all():
                    boton.click(timeout=2000)
                    estado_de["calificaciones"] += 1
                for boton in pagina.locator('button:has-text("Aprueba")').all():
                    boton.click(timeout=2000)
                    estado_de["votos_de_bid"] += 1
            except Exception:
                pass
        if len(estado_de["expuestos"]) >= 3 and estado_de["bid"] and estado_de["conexion_libre"] and estado_de["calificaciones"] >= 3:
            break
        time.sleep(1.5)
    host.screenshot(path="flujo-01-debate.png", full_page=True)
    check("Se aceptaron y expusieron al menos 3 turnos", len(estado_de["expuestos"]) >= 3, f"expusieron: {estado_de['expuestos']}")
    check("Los co-moderadores calificaron las exposiciones", estado_de["calificaciones"] >= 3, f"{estado_de['calificaciones']} calificaciones")
    check("Se lanzó un bid durante un turno ajeno", bool(estado_de["bid"]), str(estado_de["bid"]))
    check("Los co-moderadores votaron el bid", estado_de["votos_de_bid"] >= 1, f"{estado_de['votos_de_bid']} votos")
    check("Se creó una conexión libre", bool(estado_de["conexion_libre"]), str(estado_de["conexion_libre"]))

    check("Los créditos NO aparecen durante el debate", all(jugadores[n].locator(".creditos").count() == 0 for n in NOMBRES))

    # ---------- preparar un contraargumento (quien ya expuso puede preparar otro)
    quien_prepara = next((n for n in estado_de["expuestos"] if n in participantes), None)
    if quien_prepara:
        pagina = jugadores[quien_prepara]
        aparecio = esperar(lambda: pagina.locator('button:has-text("Revisar y publicar en el mapa")').count() > 0, 30)
        check(f"{quien_prepara} ve el formulario para preparar otro argumento", aparecio)
        if aparecio:
            nodos_previos, _ = contar_nodos_y_aristas(host)
            selects = pagina.locator(".tarjeta-de-formulario-de-argumento select")
            selects.nth(0).select_option("contraargumento")
            esperar(lambda: pagina.locator(".tarjeta-de-formulario-de-argumento select").count() >= 2, 5)
            objetivo = pagina.locator(".tarjeta-de-formulario-de-argumento select").nth(1)
            objetivo.select_option(index=1)
            chip = (pagina.locator(".chip-de-postura").first.inner_text() if pagina.locator(".chip-de-postura").count() else cuerpo(pagina))
            bando_de_quien_prepara = "mercado" if "Más mercado" in chip else "matizada" if "Matizada" in chip else "estado"
            pagina.fill(".tarjeta-de-formulario-de-argumento textarea", CONTRAARGUMENTO_POR_BANDO[bando_de_quien_prepara])
            pagina.click('button:has-text("Revisar y publicar en el mapa")')
            check("El contraargumento preparado se publica en el mapa (Groq lo aprueba)",
                  esperar(lambda: contar_nodos_y_aristas(host)[0] > nodos_previos, 90), f"nodos antes: {nodos_previos}")

    # ---------- F5 del host en pleno debate
    nodos_antes_f5, aristas_antes_f5 = contar_nodos_y_aristas(host)
    host.reload()
    recupero = esperar(lambda: "Fase activa" in cuerpo(host) and contar_nodos_y_aristas(host)[0] >= nodos_antes_f5, 45)
    check("F5 del host en pleno debate: reconstruye la sesión y el mapa", recupero,
          f"nodos {nodos_antes_f5} → {contar_nodos_y_aristas(host)[0]}")
    check("F5 del host: sigue con la sesión iniciada (no vuelve al login)", "Acceso reservado" not in cuerpo(host))

    # ---------- el moderador aprueba el bid
    boton_aprobar = host.locator('button:has-text("Aprobar")')
    if boton_aprobar.count():
        nodos_previos_bid = contar_nodos_y_aristas(host)[0]
        boton_aprobar.first.scroll_into_view_if_needed()
        boton_aprobar.first.click()
        check("El moderador aprueba el bid y su argumento entra al mapa",
              esperar(lambda: contar_nodos_y_aristas(host)[0] > nodos_previos_bid, 30), f"nodos antes: {nodos_previos_bid}")
    else:
        print("INFO no había veredicto de bid pendiente para el moderador", flush=True)
    puntajes_antes = sorted(int(x) for x in re.findall(r"(\d+)\s*pts", cuerpo(host)))

    # ---------- cerrar fases: dispara las sugerencias de Groq
    for _ in range(3):
        boton_cerrar_fase = host.locator('button:has-text("Cerrar fase actual")')
        if boton_cerrar_fase.count():
            boton_cerrar_fase.first.click()
            time.sleep(6)
    hubo_sugerencias = esperar(lambda: any("Groq sugiere estas conexiones" in cuerpo(jugadores[n]) for n in NOMBRES), 40)
    print("INFO sugerencias de Groq visibles para algún participante:", hubo_sugerencias, flush=True)
    if hubo_sugerencias:
        aristas_previas = contar_nodos_y_aristas(host)[1]
        for nombre in NOMBRES:
            boton = jugadores[nombre].locator(".tarjeta-de-sugerencias button:has-text('Aceptar')")
            if boton.count():
                boton.first.click()
                break
        check("Aceptar una sugerencia de Groq crea la arista",
              esperar(lambda: contar_nodos_y_aristas(host)[1] > aristas_previas, 20))
    else:
        check("Cierre de fases con Groq sin errores (Groq no sugirió conexiones)", "Fase activa" in cuerpo(host) or "Marcador" in cuerpo(host))

    # ---------- móvil emulado (Hugo, iPhone 13)
    hugo = jugadores["Hugo"]
    medidas = hugo.evaluate("""() => ({
      desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      botonesChicos: [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().height < 40).map(b => b.innerText.trim().slice(0, 30)),
    })""")
    check("Móvil (iPhone 13): sin desbordamiento horizontal", not medidas["desborda"])
    check("Móvil (iPhone 13): botones táctiles de al menos 40 px", len(medidas["botonesChicos"]) == 0, str(medidas["botonesChicos"][:5]))
    hugo.set_viewport_size({"width": 700, "height": 400})
    time.sleep(1)
    horizontal = hugo.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    check("Móvil horizontal (700×400): sin desbordamiento horizontal", not horizontal)
    hugo.screenshot(path="flujo-02-movil-horizontal.png")

    # ---------- cierre y puntaje
    boton_cierre = host.locator('button:has-text("Cerrar el debate ahora"), button.boton-peligro:has-text("Cerrar debate")')
    if boton_cierre.count():
        boton_cierre.first.scroll_into_view_if_needed()
        boton_cierre.first.click()
    # Muestreo del podio del participante DESDE el instante del cierre (antes de las comprobaciones del host).
    hugo_final = jugadores["Hugo"]
    inicio_podio = None
    muestras = []  # (segundos desde que apareció, puestos descubiertos, hay botón saltar)
    creditos_durante_la_revelacion = []
    limite = time.time() + 45
    while time.time() < limite:
        if hugo_final.locator(".podio-final-participante").count():
            inicio_podio = inicio_podio or time.time()
            transcurrido = time.time() - inicio_podio
            muestras.append((round(transcurrido, 1), hugo_final.locator(".escalon--revelado").count(),
                             hugo_final.locator('button:has-text("Saltar la animación")').count()))
            if 1.4 <= transcurrido < 2.2 and "posicion_del_podio" not in locals():
                posicion_del_podio = hugo_final.evaluate("""() => {
                  const r = document.querySelector('.podio-final-participante').getBoundingClientRect();
                  const b = document.querySelector('.podio-final__saltar');
                  const rb = b.getBoundingClientRect();
                  const encima = document.elementFromPoint(rb.x + rb.width / 2, rb.y + rb.height / 2);
                  return { y: Math.round(r.top), vh: innerHeight, saltarRecibeElToque: b.contains(encima) };
                }""")
            if muestras[-1][2] == 1:
                creditos_durante_la_revelacion.append(hugo_final.locator(".creditos").count())
            if transcurrido == 0 or len(muestras) == 1:
                hugo_final.screenshot(path="flujo-04-podio-introduccion.png")
            if transcurrido > 12:
                break
        time.sleep(0.5)
    hugo_final.screenshot(path="flujo-05-podio-a-mitad.png")
    print("INFO muestras del podio (s, descubiertos, saltar):", muestras[:3], "...", muestras[-2:], flush=True)
    check("El podio del participante aparece al cerrar el debate", inicio_podio is not None)
    posicion = locals().get("posicion_del_podio")
    check("El podio se lleva solo a la pantalla: su primera línea queda a la vista aunque la página estuviera desplazada",
          bool(posicion) and -20 <= posicion["y"] < posicion["vh"] * 0.5, str(posicion))
    check("«Saltar la animación» recibe el toque: ninguna capa fija lo tapa",
          bool(posicion) and posicion["saltarRecibeElToque"], str(posicion))
    check("La revelación empieza con suspenso: al aparecer no hay ningún puesto descubierto y se ofrece «Saltar la animación»",
          bool(muestras) and muestras[0][1] == 0 and muestras[0][2] == 1, str(muestras[:1]))
    descubiertos = [m[1] for m in muestras]
    check("Los puestos se descubren de a uno, sin retroceder (no aparecen todos de golpe)",
          descubiertos == sorted(descubiertos) and len(set(descubiertos)) >= 3 and max(descubiertos) < 8, str(sorted(set(descubiertos))))
    check("Se toma su tiempo: el primer puesto tarda al menos 2 s en descubrirse",
          next((m[0] for m in muestras if m[1] >= 1), 99) >= 2, f"primer puesto a los {next((m[0] for m in muestras if m[1] >= 1), None)} s")
    check("El debate se cierra y aparece el ranking final", esperar(lambda: "Marcador y Podios finales" in cuerpo(host), 60))
    host.screenshot(path="flujo-03-ranking.png", full_page=True)
    texto_ranking = cuerpo(host)
    check("El ranking incluye a los 8 participantes", all(n in texto_ranking for n in NOMBRES))
    puntajes = sorted(int(x) for x in re.findall(r"(\d+)\s*pts", texto_ranking))
    check("Hay puntajes positivos (el argumento puntúa al aprobarse)", any(v > 0 for v in puntajes), f"{sorted(set(puntajes))[-5:]}")
    check("Al cerrar se aplican los ajustes de las exposiciones calificadas (el total cambia)",
          sum(puntajes) != sum(puntajes_antes), f"suma antes {sum(puntajes_antes)} → después {sum(puntajes)}")
    check("El informe exportable está presente", host.locator(".informe-del-debate").count() > 0)

    # ---------- podio final del participante: revelación progresiva, salto y créditos
    check("Créditos ocultos mientras dura la revelación (solo aparecen al terminar)",
          bool(creditos_durante_la_revelacion) and sum(creditos_durante_la_revelacion) == 0, f"{len(creditos_durante_la_revelacion)} muestras")
    if hugo_final.locator('button:has-text("Saltar la animación")').count():
        hugo_final.click('button:has-text("Saltar la animación")')
    check("«Saltar la animación» muestra el podio completo, el resultado personal y los créditos",
          esperar(lambda: hugo_final.locator(".podio-tu-resultado").count() == 1 and hugo_final.locator(".creditos").count() == 1, 10)
          and hugo_final.locator(".escalon--puesto-1.escalon--revelado").count() >= 1)
    check("El podio final muestra ORCID y herramientas de IA",
          hugo_final.locator(".creditos a.creditos__orcid").get_attribute("href") == "https://orcid.org/0000-0002-7017-9443"
          and "Claude y Antigravity" in cuerpo(hugo_final))
    hugo_final.screenshot(path="flujo-06-podio-final.png", full_page=True)

    # ---------- errores de JavaScript en cualquier pantalla
    check("Sin errores de JavaScript en ninguna pantalla", len(ERRORES_DE_PAGINA) == 0, "; ".join(ERRORES_DE_PAGINA[:4]))

    print("\nRESUMEN:", sum(1 for r in RESULTADOS if r[1]), "PASS /", sum(1 for r in RESULTADOS if not r[1]), "FAIL", flush=True)
    navegador.close()
    contexto_host.close()
