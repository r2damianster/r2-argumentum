"""Prueba EN LOCAL (Chrome real + API local + Ably real + Groq real) del patrón de escritura en el debate hablado.

Uso: MODO=con|sin|off python -X utf8 patron_vivo_local.py
(requiere servidor-api-local.mjs en :3001 y vite.local.config.js en :5173; ver el README). «off» comprueba que sin patrón nada cambia.
"""
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
MODO = os.environ.get("MODO", "con")
APAGADO = MODO == "off"
ETIQUETA_DEL_MODO = {
    "off": "",
    "con": "Con retroalimentación (práctica)",
    "sin": "Sin retroalimentación (evaluación)",
}[MODO]
RESULTADOS = []
ERRORES_DE_PAGINA = []

credenciales = {}
for linea in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local"), encoding="utf8"):
    coincidencia = re.match(r"^(HOST_USER|HOST_PASSWORD)=(.*)$", linea.strip())
    if coincidencia:
        credenciales[coincidencia.group(1)] = coincidencia.group(2).strip('"\'')

TEXTOS = {
    "valid evidence": "Detectors are valid evidence because they give the university a reason to ask for an explanation.",
    "unreliable": "Detectors should not be used as proof because they are unreliable. A 2023 study found that they flagged over 60% of essays by non-native speakers as AI-written. Since a tool that often accuses honest students cannot be trusted, its score alone cannot justify a sanction.",
    "assessment": "Universities should assess the process because drafts show how a student thinks. In my writing class, asking for three versions let the teacher see who wrote each idea, so no detector was needed.",
}


def check(nombre, ok, detalle=""):
    RESULTADOS.append((nombre, ok, detalle))
    print(("PASS " if ok else "FAIL ") + nombre + (f" — {detalle}" if detalle else ""), flush=True)


def cuerpo(pagina):
    try:
        return pagina.inner_text("body")
    except Exception:
        return ""


def esperar(condicion, segundos, paso=0.7):
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
    pagina.on("pageerror", lambda error: ERRORES_DE_PAGINA.append(f"{etiqueta}: {str(error)[:200]}"))
    pagina.on("dialog", lambda dialogo: dialogo.accept())


with sync_playwright() as p:
    navegador = p.chromium.launch(channel="chrome", headless=True)

    # ---------------- Host
    contexto_host = navegador.new_context(viewport={"width": 1200, "height": 1000})
    host = contexto_host.new_page()
    vigilar(host, "HOST")
    host.goto(f"{BASE}/host.html")
    host.locator("input").nth(0).fill(credenciales["HOST_USER"])
    host.locator("input[type=password]").fill(credenciales["HOST_PASSWORD"])
    host.get_by_role("button", name="Entrar").click()
    host.wait_for_selector("text=¿Qué actividad vas a hacer?", timeout=30000)
    host.click('button.opcion-de-actividad:has-text("Debate hablado")')
    host.wait_for_selector("text=elige el Programa a abrir", timeout=30000)
    host.click('button:has-text("Should AI detectors decide")')
    host.wait_for_selector('button:has-text("Confirmar configuración y abrir sala")', timeout=15000)

    casilla = host.get_by_label("Pedir un patrón de escritura en los argumentos")
    check("el patrón está APAGADO por defecto", casilla.count() == 1 and not casilla.is_checked())
    check("apagado: no se ve el selector de patrón ni de modo", host.locator("text=Con retroalimentación (práctica)").count() == 0)
    if not APAGADO:
        casilla.check()
        host.wait_for_selector("text=Con retroalimentación (práctica)", timeout=5000)
    texto_config = cuerpo(host)
    check("al activarlo aparecen los patrones y los dos modos", APAGADO or "CER (3 partes)" in cuerpo(host))
    if not APAGADO:
        host.locator(f'label:has(strong:text-is("{ETIQUETA_DEL_MODO}"))').click()
    muestra_ok = APAGADO or esperar(lambda: "¿qué es cer?" in cuerpo(host).lower(), 5)
    check("aparece la muestra pedagógica del patrón", muestra_ok)
    if not muestra_ok:
        print("INFO config:", cuerpo(host)[cuerpo(host).find("Pedir un patr"):][:900], flush=True)
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    print("SALA", codigo, flush=True)

    # ---------------- Participantes
    nombres = ["Ana", "Beto", "Carla"]
    jugadores = {}
    for nombre in nombres:
        contexto = navegador.new_context(viewport={"width": 420, "height": 900})
        pagina = contexto.new_page()
        vigilar(pagina, nombre)
        pagina.goto(f"{BASE}/player.html?sala={codigo}")
        pagina.wait_for_selector("text=Tu nombre", timeout=30000)
        pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
        pagina.click("button.boton-sorpreendeme")
        pagina.click('button[type=submit]:has-text("Entrar")')
        jugadores[nombre] = pagina
        time.sleep(0.6)
    time.sleep(4)

    resumenes = {}
    for nombre in nombres:
        pagina = jugadores[nombre]
        pagina.wait_for_selector("textarea", timeout=40000)
        esperar(lambda: "Te toca defender" in cuerpo(pagina), 15)
        asignada = cuerpo(pagina).split("Te toca defender")[-1][:120].lower()
        clave = "valid evidence" if "valid evidence" in asignada else "unreliable" if "unreliable" in asignada else "assessment"
        texto = TEXTOS[clave]
        if nombre == "Ana" and APAGADO:
            check("apagado: la persona no ve guía de patrón", "Patrón pedido" not in cuerpo(pagina))
        if nombre == "Ana" and not APAGADO:
            check("quien escribe ve la guía «Patrón pedido: CER»", "Patrón pedido: CER" in cuerpo(pagina), "Afirmación → Evidencia → Razonamiento")
            check("la guía dice si habrá sugerencias según el modo",
                  ("La IA te sugerirá" in cuerpo(pagina)) if MODO == "con" else ("no recibirás sugerencias" in cuerpo(pagina)))
        pagina.fill("textarea", texto)
        pagina.click('button:has-text("Revisar mi argumento")')
        llego = esperar(lambda: pagina.locator('button:has-text("Confirmar mi ingreso")').count() > 0, 70)
        if not llego:
            print(f"INFO {nombre}: no pasó Groq. Cuerpo: {cuerpo(pagina)[-300:]!r}", flush=True)
        texto_pagina = cuerpo(pagina)
        sugerencia = re.search(r"Sugerencia sobre CER[^\n]*", texto_pagina)
        resumenes[nombre] = sugerencia.group(0) if sugerencia else None
        if APAGADO:
            check(f"{nombre}: apagado, ninguna sugerencia del patrón", "Sugerencia sobre" not in texto_pagina)
        elif MODO == "con":
            print(f"INFO {nombre} ({clave}) ve: {resumenes[nombre]!r}", flush=True)
        else:
            check(f"{nombre}: en modo evaluación NO ve ninguna sugerencia del patrón", "Sugerencia sobre" not in texto_pagina and "Te falta:" not in texto_pagina)
        if llego:
            pagina.click('button:has-text("Confirmar mi ingreso")')
        esperar(lambda: f"{nombres.index(nombre) + 1} en el debate" in cuerpo(host), 30)


    check("los 3 confirmaron su ingreso", esperar(lambda: "3 en el debate" in cuerpo(host), 40))
    host.click('button:has-text("Iniciar debate")')
    check("el host pasa a la fase de turnos", esperar(lambda: "Fase activa" in cuerpo(host), 30))

    if APAGADO:
        time.sleep(4)
        check("apagado: el host NO ve panel de patrón", "Patrón de escritura" not in cuerpo(host))
        check("sin errores de JavaScript en ninguna pantalla", len(ERRORES_DE_PAGINA) == 0, "; ".join(ERRORES_DE_PAGINA)[:300])
        fallos = [r for r in RESULTADOS if not r[1]]
        print(f"RESUMEN modo=off: {len(RESULTADOS) - len(fallos)}/{len(RESULTADOS)} PASS")
        navegador.close()
        sys.exit(1 if fallos else 0)
    check("el host ve el panel «Patrón de escritura: CER (solo tú ves esto)»", esperar(lambda: "Patrón de escritura: CER" in cuerpo(host), 20))
    cuerpo_host = ""
    esperar(lambda: len(re.findall(r"\d de 3 partes", cuerpo(host))) >= 3, 25)
    cuerpo_host = cuerpo(host)
    partes = re.findall(r"(\w+) · (\d) de 3 partes", cuerpo_host)
    check("el panel del host muestra las 3 personas con sus partes detectadas", len(partes) >= 3, str(partes))
    check("el panel del host muestra el modo", ("Modo evaluación" in cuerpo_host) if MODO == "sin" else ("Modo práctica" in cuerpo_host))
    detectadas = {nombre: int(n) for nombre, n in partes}
    print("INFO partes detectadas según el host:", detectadas, "| mensajes a las personas:", resumenes, flush=True)
    if MODO == "con":
        coherentes = all(
            (resumenes[nombre] is None) if detectadas[nombre] == 3 else (resumenes[nombre] is not None and f"usa {detectadas[nombre]} de 3" in resumenes[nombre] and "Puedes enviarlo igual" in resumenes[nombre])
            for nombre in nombres
        )
        check("modo práctica: lo que ve cada persona coincide con lo que ve el host", coherentes)
        check("modo práctica: alguien quedó con partes faltantes (se ejercitó el mensaje)", any(n < 3 for n in detectadas.values()))
    else:
        check("modo evaluación: nadie vio mensajes pero el host sí tiene la detección", all(v is None for v in resumenes.values()) and len(detectadas) == 3)

    # Ningún participante ve el panel del moderador ni el evento privado
    texto_ana = cuerpo(jugadores["Ana"])
    check("las personas no ven el panel del moderador", "solo tú ves esto" not in texto_ana and "Patrón de escritura: CER (" not in texto_ana)

    check("sin errores de JavaScript en ninguna pantalla", len(ERRORES_DE_PAGINA) == 0, "; ".join(ERRORES_DE_PAGINA)[:300])
    navegador.close()

fallos = [r for r in RESULTADOS if not r[1]]
print(f"\nRESUMEN modo={MODO}: {len(RESULTADOS) - len(fallos)}/{len(RESULTADOS)} PASS")
sys.exit(1 if fallos else 0)
