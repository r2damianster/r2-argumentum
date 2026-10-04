# AGENTS.md — léelo antes de tocar este repositorio

Argumentum es una plataforma de debate en tiempo real para el aula (ULEAM). Se usa con estudiantes en el celular, en vivo. El repositorio es **público** y **Vercel despliega a producción en cada push a `main`**.

Guía completa, con el catálogo de errores ya cometidos y cómo probar: **[`docs/12-guia-para-agentes.md`](docs/12-guia-para-agentes.md)**. Decisiones de arquitectura (no se reabren): **[`CLAUDE.md`](CLAUDE.md)**.

## Las reglas en una línea

1. **Acciones del turno siempre visibles:** «Aceptar / Rechazar», «Ya lo expuse», «Terminé de hablar» van en `barra-de-accion-fija` con `boton-accion-principal` / `boton-accion-rechazo`. Nunca sin clase ni con `boton-cambiar-programa`.
2. **Móvil de 320 px:** sin scroll horizontal, controles ≥ 44 px, botoneras con `flex-wrap`.
3. **`npm run verificar` antes de cada push** (`npm run instalar-hooks` lo automatiza). Nunca `--no-verify` ni `--force` en `main`.
4. **Revisa tu diff buscando restos de fusión** (líneas/botones/imports duplicados, JSX sin cerrar). Ya rompió producción dos veces.
5. **La documentación describe código que existe:** verifica con `grep` antes de citar una función, evento o umbral; actualiza los docs en el mismo commit.
6. **Cero secretos en el repo** (código, docs, scripts, capturas). Variables de entorno de Vercel; créalas **antes** de commitear.
7. **Nada de funciones inalcanzables:** recórrelas en un navegador con un Programa de ejemplo real.
8. **Español neutro, sin voseo, sin i18n, sin reconocimiento de voz.**
9. **No reabras decisiones de arquitectura** (sin BD, `BroadcastChannel` para proyección, Groq no es juez, puntaje con fórmula única). Lo reutilizable va como función pura en `src/shared/nucleo/` y lo propio de cada actividad en `src/actividades/` (ver `docs/13-foro-escrito-y-nucleo-reutilizable.md` y `docs/14-control-de-lectura.md`).
10. **No commitees ni empujes por iniciativa propia.**
11. **Groq nunca condiciona el trabajo:** si falla (cuota, 5xx, sin red), el texto pasa con el aviso «no fue pre-revisado por límites de la IA». Usa `validarArgumentoConGroq` (`src/shared/argumentos/`), que no lanza; nunca rechaces a una persona porque Groq no respondió (`docs/12`, regla 9c).

**Créditos y podio final:** los datos de autoría salen solo de `src/shared/creditos.js` y se muestran únicamente al ingresar y en el podio final (nunca durante el debate); el podio del participante solo aparece con el debate cerrado y se puede saltar.

## Si una prueba falla

`src/guardias/guardias.test.js` vigila los errores ya cometidos. **Arregla el código; no borres la prueba ni le pongas excepciones.**

## Comandos

```bash
npm test                    # pruebas + guardias
npm run verificar           # pruebas + build (lo que exige el hook pre-push y GitHub Actions)
npm run instalar-hooks      # activa el hook pre-push (una vez por clon)
python scripts/prueba-e2e/moviles.py     # 8 modelos de móvil emulados
python scripts/prueba-e2e/e2e_flujo.py   # flujo central contra producción
node scripts/prueba-e2e/foro-vivo-local.mjs      # foro, EN LOCAL con Ably y Groq reales (ver su encabezado)
node scripts/prueba-e2e/lectura-vivo-local.mjs   # control de lectura, EN LOCAL con Ably y Groq reales
```
