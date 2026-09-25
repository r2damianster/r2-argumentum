"""Inicia sesión del host en el perfil persistente (perfil-host/) y comprueba que la consola abre.

Uso (desde esta carpeta):  python login_host.py <usuario> <clave>
La clave se pasa por argumento y no se guarda: la sesión queda como token firmado en el perfil.
"""
import sys

from playwright.sync_api import sync_playwright

BASE = "https://r2-argumentum.vercel.app"
usuario, clave = sys.argv[1], sys.argv[2]

with sync_playwright() as p:
    contexto = p.chromium.launch_persistent_context("perfil-host", headless=True)
    pagina = contexto.pages[0] if contexto.pages else contexto.new_page()
    pagina.goto(BASE + "/host.html")
    pagina.wait_for_selector("text=Acceso reservado", timeout=30000)
    pagina.fill('input[autocomplete="username"]', usuario)
    pagina.fill('input[type="password"]', clave)
    pagina.click('button[type="submit"]')
    pagina.wait_for_selector("text=Elige el Programa de Debate a abrir", timeout=30000)
    print("LOGIN_OK: la consola del host abrió con la sesión del servidor", flush=True)
    sesion = pagina.evaluate("localStorage.getItem('r2-argumentum-host-sesion') !== null")
    print("Token guardado en localStorage:", sesion, flush=True)
    contexto.close()
