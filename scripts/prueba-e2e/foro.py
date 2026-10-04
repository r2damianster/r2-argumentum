"""Foro escrito contra producción: elegir la actividad, moderación e integridad, entrar sin argumento,
publicar con la sugerencia de la IA, responder, reaccionar, detectar un pegado, revisar como
co-moderador y moderador, cerrar y descargar el informe (JSON) con su desglose.

Uso (desde esta carpeta, con el login del host ya guardado en perfil-host/):  python foro.py
Dura unos 6 minutos y hace ~6 llamadas reales a Groq. Ver docs/13 y docs/10 (§ Foro escrito).

IMPORTANTE: este script se escribió sin poder ejecutarlo contra producción (la clave de Ably y la de
Groq solo existen en Vercel). La primera corrida real puede pedir ajustar selectores o esperas.
Comprueba además lo que NO se puede probar con pruebas unitarias: que el canal privado de integridad
llegue al host y que un participante no pueda leerlo.
"""
import json
import time

from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"
RESULTADOS = []
ERRORES_DE_PAGINA = []

NOMBRES = ["Ana", "Beto", "Carla", "Dani", "Eva", "Fito"]

TEXTO_DE_ANA = "Usar inteligencia artificial en clase ahorra tiempo en tareas repetitivas porque permite dedicar las horas de estudio a razonar y discutir los temas difíciles."
TEXTO_DE_BETO = "Ese ahorro es engañoso porque quien delega la redacción deja de practicar la escritura y en los exámenes presenciales no sabe empezar un texto propio."
TEXTO_DE_CARLA = "Evaluar con trabajos escritos en casa pierde sentido cuando cualquiera puede generar la respuesta, así que la universidad debería priorizar exámenes orales."
TEXTO_PEGADO = (
    "La brecha digital entre estudiantes de zonas urbanas y rurales crece cuando las herramientas de inteligencia artificial "
    "exigen buena conexión y equipos recientes, porque quienes no los tienen quedan en desventaja frente a sus compañeros y "
    "la universidad termina reproduciendo desigualdades que decía querer reducir con la tecnología."
)


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


def entrar_al_foro(navegador, codigo, nombre, indice):
    contexto = navegador.new_context(viewport={"width": 420, "height": 900})
    pagina = contexto.new_page()
    vigilar(pagina, nombre)
    pagina.on("dialog", lambda dialogo: dialogo.accept())
    pagina.goto(f"{BASE}/?sala={codigo}")
    pagina.wait_for_selector("text=Tu nombre", timeout=30000)
    pagina.fill('input[placeholder="Ej. Arturo"]', nombre)
    pagina.click("button.boton-sorpreendeme")
    pagina.click('button[type=submit]:has-text("Entrar")')
    pagina.wait_for_selector("text=Para entrar al foro", timeout=40000)
    if indice == 0:
        check("El ingreso al foro avisa que se registran señales de integridad", "Solo las ve el moderador" in cuerpo(pagina))
        check("El ingreso al foro NO pide un argumento previo", "Tu argumento" not in cuerpo(pagina))
    botones = pagina.locator(".lista-de-posturas-para-elegir button")
    botones.nth(indice % 2).click()
    pagina.click('button:has-text("Entrar al foro")')
    return pagina


def publicar(pagina, texto, boton):
    """Escribe en el compositor y publica, resolviendo la sugerencia de la IA y la advertencia de integridad."""
    pagina.fill("#compositor-del-foro textarea", texto)
    pagina.click(f'#compositor-del-foro button:has-text("{boton}")')
    limite = time.time() + 90
    while time.time() < limite:
        for etiqueta in ("Publicar así", "Publicar respuesta así", "Enviar igual"):
            candidato = pagina.locator(f'#compositor-del-foro button:has-text("{etiqueta}")')
            if candidato.count() > 0:
                candidato.first.click()
                break
        if pagina.locator(".texto-del-aporte", has_text=texto[:40]).count() > 0:
            return True
        time.sleep(1)
    return False


def descargar_json(pagina, boton):
    with pagina.expect_download(timeout=30000) as descarga:
        pagina.click(f'button:has-text("{boton}")')
    ruta = descarga.value.path()
    with open(ruta, encoding="utf-8") as archivo:
        return json.load(archivo)


with sync_playwright() as p:
    contexto_host = p.chromium.launch_persistent_context("perfil-host", headless=False, no_viewport=True, args=["--window-size=1400,1100"])
    host = contexto_host.pages[0] if contexto_host.pages else contexto_host.new_page()
    vigilar(host, "host")
    host.on("dialog", lambda dialogo: dialogo.accept())
    navegador = p.chromium.launch(headless=True)

    # 1. El host elige la actividad, el Programa, la integridad y abre la sala.
    host.goto(BASE + "/host.html")
    host.wait_for_selector("text=¿Qué actividad vas a hacer?", timeout=30000)
    host.click('button.opcion-de-actividad:has-text("Foro escrito")')
    host.wait_for_selector("text=elige el Programa a abrir", timeout=30000)
    check("Con el foro elegido solo se ofrecen Programas de foro", "Izquierda o derecha" not in cuerpo(host))
    host.click('button:has-text("Foro: ¿Debe usarse la inteligencia artificial en la universidad?")')
    host.wait_for_selector("text=Co-moderadores", timeout=20000)
    host.click('label:has-text("Con advertencias")')
    host.click('button:has-text("Confirmar configuración y abrir sala")')
    host.wait_for_selector(".codigo-de-sala", timeout=20000)
    codigo = host.inner_text(".codigo-de-sala").strip()
    check("Se abre la sala del foro", len(codigo) == 4, codigo)

    # 2. Entran 6 participantes sin escribir ningún argumento.
    paginas = {nombre: entrar_al_foro(navegador, codigo, nombre, indice) for indice, nombre in enumerate(NOMBRES)}
    ana = paginas["Ana"]
    check("Ana entra a la sala del foro", esperar(lambda: "Publica un post nuevo" in cuerpo(ana) or "Aún no hay posts" in cuerpo(ana) or "El moderador todavía no abre el foro" in cuerpo(ana), 40))

    # 3. El host designa co-moderadores y empieza.
    host.wait_for_selector("text=Co-moderadores", timeout=30000)
    esperar(lambda: "6 persona(s)" in cuerpo(host), 30)
    check("El panel de designación cuenta 1 co-moderador para 6 personas", "corresponden 1 co-moderador" in cuerpo(host), cuerpo(host)[-300:])
    host.click('button:has-text("Sortear ahora")')
    check("El sorteo designa a un co-moderador", esperar(lambda: "Designados:" in cuerpo(host), 15))
    host.click('button:has-text("Iniciar foro")')
    check("El foro empieza con la cuenta atrás", esperar(lambda: host.locator(".barra-de-tiempo").count() > 0, 20))

    # La persona designada co-modera: no publica. Las demás son debatientes.
    co_moderador = next((nombre for nombre, pagina in paginas.items() if esperar(lambda: "Revisión de aportes" in cuerpo(pagina), 5)), None)
    check("Una de las personas es co-moderadora y ve su cola de revisión", co_moderador is not None, str(co_moderador))
    debatientes = [nombre for nombre in NOMBRES if nombre != co_moderador]
    autora, respondedor, tercera, quien_pega = (paginas[nombre] for nombre in debatientes[:4])

    # 4. Estado vacío, primer post con la sugerencia de la IA y aviso de «sin debatir».
    check("Antes del primer post se invita a publicar", "Aún no hay posts" in cuerpo(autora))
    check("Se publica el primer post", publicar(autora, TEXTO_DE_ANA, "Publicar post"))
    check("A los demás les aparece «sin debatir»", esperar(lambda: "sin debatir" in cuerpo(respondedor).lower(), 30))
    check("La autora ve la sugerencia de la IA sobre su post", esperar(lambda: "Sugerencia de la IA" in cuerpo(autora), 20))
    check("Los compañeros NO ven la sugerencia de la IA del post ajeno", "Sugerencia de la IA" not in cuerpo(respondedor))

    # 5. Réplica, bandeja «Te respondieron» y reacción.
    respondedor.click('button:has-text("Responder")')
    check("Se publica la réplica", publicar(respondedor, TEXTO_DE_BETO, "Publicar respuesta"))
    check("A la autora le aparece «Te respondieron (1)»", esperar(lambda: "Te respondieron (1)" in cuerpo(autora), 30))
    tercera.locator("button.boton-de-reaccion", has_text="Me convenció").first.click()
    check("La reacción «Me convenció» se cuenta", esperar(lambda: tercera.locator(".conteo-de-reaccion").count() > 0, 15))

    # 6. Segundo post de otra persona y un pegado detectado por la integridad.
    check("Otra persona publica su post", publicar(tercera, TEXTO_DE_CARLA, "Publicar post"))
    quien_pega.evaluate(
        """(texto) => {
            const campo = document.querySelector('#compositor-del-foro textarea');
            const datos = new DataTransfer();
            datos.setData('text/plain', texto);
            campo.dispatchEvent(new ClipboardEvent('paste', { clipboardData: datos, bubbles: true, cancelable: true }));
        }""",
        TEXTO_PEGADO,
    )
    quien_pega.fill("#compositor-del-foro textarea", TEXTO_PEGADO)
    quien_pega.click('#compositor-del-foro button:has-text("Publicar post")')
    check("A quien pega se le advierte que el moderador verá la marca",
          esperar(lambda: "El moderador verá esta marca" in cuerpo(quien_pega), 90), cuerpo(quien_pega)[-300:])
    if quien_pega.locator('button:has-text("Enviar igual")').count() > 0:
        quien_pega.click('button:has-text("Enviar igual")')
    check("El host recibe la señal de integridad por el canal privado",
          esperar(lambda: "Pegó" in cuerpo(host), 40), cuerpo(host)[-300:])
    check("Un participante NO ve las señales de integridad de otros", "Integridad (solo tú ves esto)" not in cuerpo(autora))

    # 7. Revisión: el co-moderador decide, el moderador manda.
    revisor = paginas[co_moderador]
    check("El co-moderador ve aportes por revisar", esperar(lambda: revisor.locator('button:has-text("No cuenta")').count() > 0, 30))
    if revisor.locator('button:has-text("No cuenta")').count() > 0:
        revisor.locator('button:has-text("No cuenta")').first.click()
    host.wait_for_selector("text=Revisión de aportes", timeout=20000)
    check("El moderador ve su cola de revisión con lo marcado", host.locator('.tarjeta-de-fase button:has-text("Cuenta completo")').count() > 0)

    # 8. Se extiende el tiempo y se cierra la escritura; luego se cierra y calcula.
    host.click('button:has-text("Extender 5 minutos")')
    check("El moderador puede extender el tiempo", esperar(lambda: "Ya extendiste 5 minutos" in cuerpo(host), 15))
    host.click('button:has-text("Cerrar la escritura ahora")')
    check("Al cerrar la escritura los participantes ya no pueden publicar",
          esperar(lambda: "La escritura está cerrada" in cuerpo(autora), 20))
    host.wait_for_selector("text=Cerrar y calcular los puntajes", timeout=20000)
    host.click('button:has-text("Cerrar y calcular los puntajes")')
    check("Los participantes ven el podio al cerrarse", esperar(lambda: "podio" in cuerpo(autora).lower(), 40))

    # 9. Informe: JSON con el desglose y anexo de integridad aparte.
    sesion = descargar_json(host, "Descargar sesión (.json)")
    check("El JSON declara la actividad y trae el desglose del puntaje",
          sesion.get("actividad") == "foro_escrito" and len(sesion.get("desglosePorParticipante", [])) > 0)
    check("El JSON trae la revisión aporte por aporte y las métricas del foro",
          len(sesion.get("foro", {}).get("revisionDeAportes", [])) >= 4 and "metricasDeParticipacion" in sesion.get("foro", {}))
    check("El JSON general NO lleva las señales de integridad", "Pegó" not in json.dumps(sesion.get("foro", {})))
    anexo = descargar_json(host, "Descargar anexo de integridad (.json)")
    check("El anexo de integridad es un archivo aparte, confidencial", anexo.get("confidencial") is True and len(anexo.get("personas", [])) >= 1)
    texto_del_informe = host.inner_text(".informe-del-debate")
    check("El informe (PDF) trae el desglose del puntaje y la revisión de aportes",
          "Desglose del puntaje" in texto_del_informe and "Revisión de los aportes" in texto_del_informe)
    check("El informe NO imprime la integridad por defecto", "Anexo de integridad" not in texto_del_informe)
    host.check('label:has-text("Incluir el anexo de integridad") input')
    check("Con la casilla marcada el informe incluye el anexo", "Anexo de integridad (confidencial)" in host.inner_text(".informe-del-debate"))

    check("Sin errores de JavaScript en ninguna pantalla", not ERRORES_DE_PAGINA, "; ".join(ERRORES_DE_PAGINA[:5]))

    navegador.close()
    contexto_host.close()

fallos = [nombre for nombre, ok, _ in RESULTADOS if not ok]
print(f"\n{len(RESULTADOS) - len(fallos)} PASS / {len(fallos)} FAIL", flush=True)
for nombre in fallos:
    print("  FAIL:", nombre)
