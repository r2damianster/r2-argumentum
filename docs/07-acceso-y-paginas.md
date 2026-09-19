# Acceso y estructura de páginas

Consistente con otro proyecto del usuario, **R2 Quiz** (consola de host reservada + página de jugadores sin login), Argumentum sigue el mismo patrón.

## Consola del Moderador (host)

- Página/ruta separada para el profesor, ej. `/host.html` o `/moderador`.
- Acceso reservado — pantalla de login simple ("Usuario" / "Clave") antes de entrar.
- Credencial **hardcodeada en el código**, sin backend de autenticación real. Aceptable porque no se maneja información sensible ni datos personales protegidos — mismo criterio ya validado en R2 Quiz ("no es peligroso porque no tendremos nada relevante ahí").
- Imagen de portada de esta consola: `public/avatar.png`.
- Desde aquí el profesor: crea/carga un Programa de Debate, elige el modo de calificación y las posturas, controla el avance de fases, proyecta el grafo en vivo (modo proyección), ve la pantalla de cualquier participante (vista espejo, solo lectura), recibe avisos operativos, ve el ranking por postura, descarga el JSON de la sesión e imprime el informe. Los co-moderadores se sortean solos al iniciar.
- **Recarga (F5)**: si la sesión ya estaba iniciada y el canal todavía trae su Programa, la consola se reconstruye sola; si el historial ya expiró, vuelve a la lista de Programas (nunca reabre una sala nueva con el código viejo).
- **Código de sala + QR**, mismo patrón que R2 Quiz: al abrir la sesión se genera un código de 4 dígitos y un QR que enlaza a `/player.html?sala={codigo}`. El estudiante escanea y entra con el código ya prellenado — no necesita tipearlo. Implementado con `qrcode.react` (`src/host/App.jsx`).

### Copy de referencia (mismo molde que R2 Quiz)

```
R2 Argumentum · Consola del host

Acceso reservado
Solo el docente moderador entra aquí. Los estudiantes entran en
https://r2-argumentum.vercel.app/player.html.

Usuario
[usuario]

Clave
[••••••••]

[Entrar]

R2 Argumentum — Arturo Damián Rodríguez Zambrano · Docente, investigador y vibe coder
```

Diferencias respecto al copy de R2 Quiz: "docente anfitrión" → "docente moderador" (coherente con el rol **Moderador** de `04-roles-y-turnos.md`); URL del player apunta a `r2-argumentum.vercel.app/player.html`. El resto se mantiene idéntico para preservar identidad de marca entre los proyectos R2 del usuario.

## Acceso de participantes

- Página/ruta separada, ej. `/player.html` o `/participante`.
- **Sin login.** Pantalla de ingreso, replicando el patrón ya validado en R2 Quiz:
  - **Código de sala** (ej. 4 dígitos, identifica el Programa/sesión activa).
  - **Tu nombre** (campo de texto libre, ej. "Arturo").
  - **Tu avatar**: grid de emojis seleccionables + botón "🎲 Sorpréndeme" para elegir uno al azar. El emoji elegido es cómo se lo identifica en el marcador/grafo.
  - Botón **Entrar**.
- **Entrar no alcanza para aparecer en la sala.** Después de conectarse el estudiante elige postura (o se le asigna), escribe su argumento, lo revisa con Groq y **confirma su ingreso**; recién ahí lo ve el resto. Quien no confirma antes de que el moderador inicie la sesión queda como oyente (mira, no recibe turnos ni puntúa).
- **Link corto**: `https://r2-argumentum.vercel.app/?sala=XXXX` redirige a `/player.html?sala=XXXX` (lo usan el QR y el botón "Copiar link").
- Quien refresca la pestaña reconstruye el debate desde una copia local del log (ver `02-arquitectura.md`).
- La URL/código de sala se comparte con los estudiantes al iniciar la sesión (generado a partir del Programa activo).
- Desde aquí el participante: recibe/acepta turnos, escribe argumentos, conecta argumentos libremente. Si fue sorteado co-moderador, ve además el panel de moderación (valorar, anotar, marcar falta).

## Autenticación con Ably — sin exponer la API key en el cliente

Igual que en R2 Quiz ("la API key se obtiene del entorno seguro de Vercel"): la clave de Ably **nunca** va hardcodeada ni expuesta en el código del frontend. Se resuelve con una función serverless mínima en Vercel (ej. `/api/ably-token`) que lee la API key desde una variable de entorno segura y devuelve un **token de Ably** de corta duración al cliente. El frontend solo conoce el endpoint del token, nunca la key real.

```
Cliente (host o player)
     │
     ▼
GET /api/ably-token   (función serverless en Vercel)
     │
     ▼
lee ABLY_API_KEY desde entorno seguro de Vercel
     │
     ▼
devuelve token temporal de Ably
     │
     ▼
Cliente se conecta a Ably con ese token
```

Esto sí requiere un backend mínimo (solo esa función), distinto de "sin base de datos" — no guarda estado, solo emite tokens. No contradice la decisión de no usar base de datos (ver `02-arquitectura.md`).

## Convención de nombres y despliegue

La familia de proyectos del usuario usa el prefijo **"R2"** (R2 Quiz, R2 Argumentum). Mantener esta convención en nombres de repositorio y, si aplica, en el subdominio de despliegue (ej. `r2-argumentum.vercel.app`), replicando el esquema ya usado en R2 Quiz (`r2-quiz.vercel.app` para consola, `/player.html` para estudiantes).
