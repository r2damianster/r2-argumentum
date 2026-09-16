# Guía de prueba manual — R2 Argumentum (multi-ventana, Claude en Chrome)

Guía para un agente de Claude con control de Chrome. Objetivo: abrir varias pestañas/ventanas simulando los 3 roles (moderador/host, participante, co-moderador) contra la app corriendo en local, ejercitar lo que YA está implementado, y devolver una lista de fallos/problemas detectados. No inventes funcionalidad ni la pruebes por encima de lo que existe — ver sección "Qué NO probar" abajo.

## 0. Preparar el entorno (una sola vez)

Usar la pestaña/entorno que esté disponible — no bloquear la prueba por esto, solo dejar anotado cuál se usó en el reporte final:

- **Producción (Vercel)** — normalmente la más accesible sin pasos extra:
  - Raíz: `https://r2-argumentum.vercel.app/` → debe redirigir a `/host.html`.
  - Consola del host: `https://r2-argumentum.vercel.app/host.html`
  - Página de participante: `https://r2-argumentum.vercel.app/player.html`
- **Local** (si hay acceso a terminal y se corrió `npm run dev`):
  - Vite normalmente sirve en `http://localhost:5173`. Si el puerto es otro, usar el que reporte la consola.
  - En local la raíz `/` da 404 (el redirect solo aplica en el deploy de Vercel) — **no reportar esto como fallo si el entorno es local**.
  - Host: `http://localhost:5173/host.html` · Participante: `http://localhost:5173/player.html`

Credencial del host (hardcodeada a propósito, ver `docs/07-acceso-y-paginas.md`):
- Usuario: `arturo.rodriguez@uleam.edu.ec`
- Clave: `R2ironmaiden`

No modifiques código. Esta guía es solo de exploración/uso de la UI vía navegador.

## 1. Qué SÍ está implementado (probar esto)

- **Redirect de raíz**: `/` debe redirigir a `/host.html` (configurado en `vercel.json`, solo aplica en producción/Vercel — ver nota en sección 0 sobre local).
- **Login del host**: formulario usuario/clave en `/host.html`, con mensaje de error si falla.
- **Consola del host tras login**: genera un código de sala de 4 dígitos y un QR que apunta a `/player.html?sala={codigo}`.
- **Página de participante** (`/player.html`):
  - Si se abre con `?sala=XXXX` en la URL, el campo "Código de sala" se prellena solo.
  - Campos: código de sala (ahora filtra caracteres no numéricos y limita a 4 dígitos — **fix aplicado**, verificar que ya no se puedan escribir letras), nombre, selección de avatar (grid de emojis + botón "🎲 Sorpréndeme").
  - Botón "Entrar" deshabilitado hasta llenar código + nombre + emoji.
  - Al enviar, pasa a una pantalla de "Conectando a la sala..." con el código, nombre y emoji elegidos.

## 2. Qué NO está implementado todavía — no intentar probarlo, no reportarlo como fallo

Esto es trabajo pendiente conocido (ver `docs/06-pendientes.md`), no existe UI para ello todavía. Solo anotarlo como "confirmado pendiente" en el reporte si se nota, sin perder tiempo buscándolo:

- **No hay selector ni carga de Programa de Debate** en la consola del host — por eso no aparece ninguna pantalla para elegir el tema/debate a abrir (ej. el de "izquierda vs. derecha"). Es la siguiente pieza a construir, no un fallo de esta prueba.
- **No hay rol de co-moderador diferenciado** — todo participante ve la misma pantalla de "Conectando…"; no hay panel de valoración/voto de bids. No puede probarse porque no está construido.
- **No hay debate real**: sin fases, turnos, escritura de argumentos, conexión libre, grafo, ni ranking. La sesión termina en la pantalla de "Conectando a la sala…" y ahí se acaba lo navegable.
- No hay conexión real a Ably (presence, turnos, eventos en vivo). El texto "Conectando a la sala…" es un placeholder estático.
- El código de sala se genera al azar en cada carga de la consola del host — no hay backend que lo persista ni lo valide contra lo que un participante escribe. Un participante puede "entrar" con cualquier código de 4 dígitos porque no hay validación real todavía.

## 3. Escenario multi-ventana

Abre pestañas separadas para simular los roles simultáneamente:

1. **Pestaña A — Host/moderador**: ir a `/host.html`, hacer login, anotar el código de sala y la URL del QR (`/player.html?sala=XXXX`) que aparece.
2. **Pestaña B — Participante 1**: abrir la URL exacta del QR anotado en el paso 1 (con `?sala=XXXX`). Verificar que el código venga prellenado. Elegir nombre "Ana" y un emoji manualmente. Entrar.
3. **Pestaña C — Participante 2**: abrir `/player.html` SIN parámetro de sala. Escribir el código a mano. Usar "🎲 Sorpréndeme" para el avatar. Nombre "Luis". Entrar.
4. **Pestaña D — Co-moderador (simulado)**: mismo flujo que un participante normal (no hay panel diferenciado todavía) — nombre "Marta", cualquier emoji, cualquier código de 4 dígitos (real o inventado, para confirmar que no hay validación aún).

## 4. Casos borde a ejercitar en cada pestaña de participante

- Dejar "código de sala" vacío → botón Entrar debe seguir deshabilitado.
- Dejar "nombre" vacío → botón Entrar debe seguir deshabilitado.
- No elegir ningún emoji → botón Entrar debe seguir deshabilitado.
- Escribir letras/símbolos en el campo de código (ej. `abcXYZ12`) — debe rechazarlos y quedar solo con los dígitos escritos, máximo 4 caracteres. **Regresión a confirmar**: esto falló en una prueba anterior (aceptaba texto libre) y se aplicó un fix — verificar que ya no ocurra.
- Refrescar la página (F5) después de "Entrar" — ver si se pierde el estado o si mantiene algo por URL.
- Abrir dos pestañas de participante con el MISMO nombre y MISMO emoji — no hay backend, así que no debería bloquear nada; confirmar que no truena la UI.
- En el host: recargar `/host.html` — el código de sala cambia (es aleatorio en memoria, no persiste). Confirmar que efectivamente cambia y que el QR se regenera acorde.
- Login del host con clave incorrecta — confirmar mensaje de error exacto y que no deja pasar.
- Probar responsive: reducir el viewport (simular móvil) en la pestaña de participante, ya que los estudiantes entran desde celular vía QR.

## 5. Formato de reporte de fallos

Al terminar, entrega una tabla en markdown, una fila por hallazgo, ordenada de más a menos grave:

| # | Pantalla | Pasos para reproducir | Esperado | Obtenido | Severidad (alta/media/baja) |
|---|----------|------------------------|----------|----------|------------------------------|
| 1 | ... | ... | ... | ... | ... |

Si algo de la sección "2. Qué NO está implementado" aparece como faltante, NO lo pongas en la tabla de fallos — ponlo aparte, en una lista corta "Pendiente conocido, confirmado en esta prueba".

Si no encuentras ningún fallo real, dilo explícitamente: "Sin fallos detectados en el alcance actual" — no inventes hallazgos para llenar la tabla.

## 6. Cierre

Al final del reporte, agrega una sección "Resumen" de máximo 3 líneas: cuántos fallos altos/medios/bajos, y si el flujo básico host→QR→participante funciona de punta a punta o no.
