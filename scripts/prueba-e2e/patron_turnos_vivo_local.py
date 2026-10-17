"""Prueba EN LOCAL del patrón de escritura en los otros dos lugares donde se escribe un argumento (el contraargumento de
un oyente y la preparación durante los turnos, en modo práctica) y de la descarga del anexo confidencial.

Uso: python -X utf8 patron_turnos_vivo_local.py   (mismos requisitos que patron_vivo_local.py: API local en :3001 y vite en :5173)
"""
import json
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
ETIQUETA_DEL_MODO = "Con retroalimentación (práctica)"
RESULTADOS = []
ERRORES_DE_PAGINA = []

credenciales = {}
for linea in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local"), encoding="utf8"):
    coincidencia = re.match(r"^(HOST_USER|HOST_PASSWORD)=(.*)$", linea.strip())
    if coincidencia:
        credenciales[coincidencia.group(1)] = coincidencia.group(2).strip("\"'")

# Argumentos completos (CER) para el ingreso y argumentos con partes faltantes para oyente y preparación.
COMPLETOS = {
    "valid evidence": "Detectors are valid evidence because plagiarism software is already accepted in universities. A high score gives the university a first reason to ask for an explanation, since a tool that is right most of the time justifies a conversation.",
    "unreliable": "Detectors should not be used as proof because they are unreliable. A 2023 study found that they flagged over 60% of essays by non-native speakers as AI-written. Since a tool that often accuses honest students cannot be trusted, its score alone cannot justify a sanction.",
    "assessment": "Universities should assess the process because drafts show how a student thinks. In my writing class, asking for three versions let the teacher see who wrote each idea, so no detector was needed.",
}
INCOMPLETOS = {
    "valid evidence": "Detectors are a fair tool because they help teachers find suspicious essays.",
    "unreliable": "Detectors should be banned because they punish honest students.",
    "assessment": "Teachers should grade drafts because it shows the writing process.",
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


def clave_de_postura(texto):
    texto = texto.lower()
    return "valid evidence" if "valid evidence" in texto else "unreliable" if "unreliable" in texto else "assessment"


def entradas_del_panel(host):
    return len(re.findall(r"\d de 3 partes", cuerpo(host)))


with sync_playwright() as p:
    navegador = p.chromium.launch(channel="chrome", headless=True)
    host = navegador.new_context(viewport={"width": 1200, "height": 1000}, accept_downloads=True).new_page()
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
    host.get_by_label("Pedir un patrón de escritura en los argumentos").check()
    host.locator(f'label:has(strong:text-is("{ETIQUETA_DEL_MODO}"))').click()
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    print("SALA", codigo, flush=True)

    jugadores = {}
    for nombre in ["Ana", "Beto", "Carla", "Dani"]:
        pagina = navegador.new_context(viewport={"width": 420, "height": 900}).new_page()
        vigilar(pagina, nombre)
        pagina.goto(f"{BASE}/player.html?sala={codigo}")
        pagina.wait_for_selector("text=Tu nombre", timeout=30000)
        pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
        pagina.click("button.boton-sorpreendeme")
        pagina.click('button[type=submit]:has-text("Entrar")')
        jugadores[nombre] = pagina
        time.sleep(0.6)
    time.sleep(4)

    # Ana, Beto y Carla confirman en la sala de espera con argumentos completos; Dani queda como oyente.
    for indice, nombre in enumerate(["Ana", "Beto", "Carla"], start=1):
        pagina = jugadores[nombre]
        pagina.wait_for_selector("textarea", timeout=40000)
        esperar(lambda: "Te toca defender" in cuerpo(pagina), 15)
        asignada = cuerpo(pagina).split("Te toca defender")[-1][:120]
        pagina.fill("textarea", COMPLETOS[clave_de_postura(asignada)])
        pagina.click('button:has-text("Revisar mi argumento")')
        if esperar(lambda: pagina.locator('button:has-text("Confirmar mi ingreso")').count() > 0, 70):
            pagina.click('button:has-text("Confirmar mi ingreso")')
        esperar(lambda: f"{indice} en el debate" in cuerpo(host), 30)
    check("los 3 confirmaron su ingreso", esperar(lambda: "3 en el debate" in cuerpo(host), 40))
    host.click('button:has-text("Iniciar debate")')
    check("el host pasa a la fase de turnos", esperar(lambda: "Fase activa" in cuerpo(host), 30))
    esperar(lambda: entradas_del_panel(host) >= 3, 25)
    base_de_entradas = entradas_del_panel(host)
    check("el panel del host ya tiene las 3 entradas del ingreso", base_de_entradas == 3, str(base_de_entradas))

    # ---------- OYENTE
    dani = jugadores["Dani"]
    check("Dani ve el formulario de oyente", esperar(lambda: dani.locator("text=Formular un contraargumento como oyente").count() > 0, 40))
    check("el formulario del oyente muestra la guía del patrón", "Patrón pedido: CER" in cuerpo(dani))
    selects = dani.locator("section.tarjeta-de-ingreso select")
    esperar(lambda: selects.nth(0).locator("option").count() > 1, 20)
    selects.nth(0).select_option(index=1)
    selects.nth(1).select_option(index=1)
    postura_de_dani = selects.nth(1).locator("option:checked").inner_text()
    print("INFO postura elegida por Dani:", postura_de_dani, flush=True)
    dani.fill("textarea", INCOMPLETOS[clave_de_postura(postura_de_dani)])
    dani.click('button:has-text("Revisar contraargumento")')
    aprobado = esperar(lambda: dani.locator('button:has-text("Publicar contraargumento")').count() > 0, 70)
    print("INFO Dani, tras revisar:", re.findall(r"Sugerencia sobre CER[^\n]*", cuerpo(dani)), flush=True)
    check("Groq aprueba el contraargumento del oyente", aprobado, "" if aprobado else cuerpo(dani)[-300:].replace("\n", " "))
    if aprobado:
        dani.click('button:has-text("Publicar contraargumento")')
        check("el host recibe la detección del contraargumento del oyente", esperar(lambda: entradas_del_panel(host) >= base_de_entradas + 1, 25),
              f"{base_de_entradas} -> {entradas_del_panel(host)}")

    # ---------- PREPARACIÓN durante los turnos
    entradas_antes = entradas_del_panel(host)
    quien_prepara = None
    visto_exponiendo = {}
    inicio = time.time()
    while time.time() - inicio < 240 and not quien_prepara:
        for nombre in ["Ana", "Beto", "Carla"]:
            pagina = jugadores[nombre]
            try:
                aceptar = pagina.locator('button:has-text("Aceptar y defender mi argumento")')
                if aceptar.count():
                    aceptar.first.click(timeout=2000)
                    visto_exponiendo[nombre] = time.time()
                expuse = pagina.locator('button:has-text("Ya lo expuse")')
                if expuse.count():
                    visto_exponiendo.setdefault(nombre, time.time())
                    if time.time() - visto_exponiendo[nombre] > 5:
                        expuse.first.click(timeout=2000)
                if pagina.locator('button:has-text("Revisar y publicar en el mapa")').count():
                    quien_prepara = nombre
                    break
            except Exception:
                pass
        time.sleep(1.5)
    check("alguien llegó al formulario de preparar otro argumento", bool(quien_prepara), str(quien_prepara))
    if quien_prepara:
        pagina = jugadores[quien_prepara]
        check("la preparación muestra la guía del patrón", "Patrón pedido: CER" in cuerpo(pagina))
        chip = pagina.locator(".chip-de-postura").first.inner_text() if pagina.locator(".chip-de-postura").count() else cuerpo(pagina)
        nodos_antes = host.locator(".react-flow__node").count()
        pagina.fill(".tarjeta-de-formulario-de-argumento textarea", INCOMPLETOS[clave_de_postura(chip)])
        pagina.click('button:has-text("Revisar y publicar en el mapa")')
        esperar(lambda: "Sugerencia sobre CER" in cuerpo(pagina) or host.locator(".react-flow__node").count() > nodos_antes, 80)
        vio_sugerencia = "Sugerencia sobre CER" in cuerpo(pagina)
        print("INFO preparación:", quien_prepara, "| sugerencia:", re.findall(r"Sugerencia sobre CER[^\n]*", cuerpo(pagina)), flush=True)
        if vio_sugerencia:
            hay_boton = pagina.locator('button:has-text("Publicar así")').count() > 0
            time.sleep(1.5)
            check("modo práctica: con partes faltantes NO se publica solo, espera «Publicar así»",
                  hay_boton and host.locator(".react-flow__node").count() == nodos_antes)
            pagina.click('button:has-text("Publicar así")')
        else:
            print("INFO la IA no vio partes faltantes: se publicó directo (camino sin pausa)", flush=True)
        check("el argumento preparado llega al mapa", esperar(lambda: host.locator(".react-flow__node").count() > nodos_antes, 40))
        check("el host recibe la detección del argumento preparado (la publicación inmediata no pierde el registro)",
              esperar(lambda: entradas_del_panel(host) >= entradas_antes + 1, 25), f"{entradas_antes} -> {entradas_del_panel(host)}")

    # ---------- ANEXO confidencial
    boton_cierre = host.locator('button:has-text("Cerrar el debate ahora")')
    if boton_cierre.count():
        boton_cierre.first.scroll_into_view_if_needed()
        boton_cierre.first.click()
    boton_anexo = host.locator('button:has-text("Descargar anexo confidencial")')
    check("al cerrar aparece el botón del anexo confidencial", esperar(lambda: boton_anexo.count() > 0, 40))
    if boton_anexo.count():
        with host.expect_download(timeout=20000) as descarga:
            boton_anexo.first.click()
        contenido = json.load(open(descarga.value.path(), encoding="utf8"))
        registros = contenido.get("patronDeEscritura", [])
        check("el anexo descargado trae las detecciones del patrón", len(registros) >= 4 and contenido.get("confidencial") is True, f"{len(registros)} registros")
        check("cada registro trae persona, patrón y partes",
              all(r.get("nombre") and r.get("patron") == "CER" and (r["partesPresentes"] or r["partesFaltantes"]) for r in registros))
    check("sin errores de JavaScript en ninguna pantalla", len(ERRORES_DE_PAGINA) == 0, "; ".join(ERRORES_DE_PAGINA)[:300])
    navegador.close()

fallos = [r for r in RESULTADOS if not r[1]]
print(f"RESUMEN turnos: {len(RESULTADOS) - len(fallos)}/{len(RESULTADOS)} PASS")
sys.exit(1 if fallos else 0)
