# Acceso y estructura de páginas

Consistente con otro proyecto del usuario, **R2 Quiz** (consola de host reservada + página de jugadores sin login), Argumentum sigue el mismo patrón.

## Consola del Moderador (host)

- Página/ruta separada para el profesor, ej. `/host.html` o `/moderador`.
- Acceso reservado — pantalla de login simple ("Usuario" / "Clave") antes de entrar.
- La credencial vive **solo en variables de entorno de Vercel** (`HOST_USER`, `HOST_PASSWORD`), nunca en el código ni en la documentación (el repositorio es público). El login llama a `POST /api/host-login`, que compara con `timingSafeEqual` y responde con un token firmado (HMAC-SHA256, caduca a los 7 días, se invalida al cambiar `HOST_PASSWORD`). El navegador guarda ese token en `localStorage` (`src/shared/ably/sesionDelHost.js`); «Cerrar sesión» lo borra. Una clave incorrecta espera 700 ms antes de responder.
- `/api/ably-token` **solo entrega la identidad `host` con ese token** (`hostToken`); los participantes usan su propio `participante-…` sin login.
- Imagen de portada de esta consola: `public/avatar.png`.
- Flujo en 3 Etapas del Moderador:
  1. **Selección y Configuración Inicial**: El profesor elige un Programa de Debate y configura sus parámetros (posturas activas, modo de asignación de postura, perfil de puntaje, idioma y propuesta de posturas nuevas) **antes** de abrir la sala o generar el QR, evitando descalibres con participantes ingresando en paralelo.
  2. **Sala de Espera con QR y Guía Pedagógica**: Al confirmar la configuración, se genera el código de sala de 4 dígitos y el QR (`/player.html?sala={codigo}`). En esta pantalla se visualizan en tiempo real los participantes conectándose, se resumen los parámetros configurados y se proyecta el **Panel de Guía Pedagógica** (pautas sobre objetivo del debate, redacción de argumentos, puntaje y rol de co-moderador).
  3. **Debate en Vivo**: Al presionar «🚀 Iniciar debate», arranca la primera fase en vivo.
- **Recarga (F5)**: si la sesión ya estaba iniciada, la consola se reconstruye sola desde la copia local del log (también con el debate cerrado: el informe no se pierde). Solo si no hay copia local y el historial de Ably ya expiró vuelve a la lista de Programas (nunca reabre una sala nueva con el código viejo). Con el debate cerrado, «➕ Iniciar un debate nuevo» vuelve a la lista sin pedir login.
- **Ventana de proyección**: `/host.html?proyeccion=XXXX` (la abre el botón «Proyectar en otra ventana»). No pide login ni se conecta a Ably: muestra lo que la pestaña del host le envía por `BroadcastChannel`, así que solo funciona en el mismo navegador y con esa pestaña abierta.
- **Código de sala + QR**, mismo patrón que R2 Quiz: al abrir la sala se genera un código de 4 dígitos y un QR que enlaza a `/player.html?sala={codigo}`. El estudiante escanea y entra con el código ya prellenado — no necesita tipearlo. Implementado con `qrcode.react` (`src/host/App.jsx`).

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
- **Zoom del navegador**: si está muy por debajo del 100 % (el zoom de Chrome se recuerda por sitio y lo comparten host y participantes), la página **se amplía sola** en proporción inversa (tope ×4) y aparece una barra fija que explica que se puede volver al tamaño normal con `Ctrl + 0`. No se aplica en celulares ni tabletas (puntero táctil), ni en el modo dispositivo de las herramientas de desarrollo. En pantallas de 1280 px o más la interfaz escala sola (raíz en 112,5 % / 125 %).
- **Volver tras cerrar la pestaña**: el navegador recuerda (12 h) las identidades que entraron a cada sala. Al abrir el link de la sala aparece un botón «Continuar como 🦊 X» por cada una, y quien es otra persona llena el formulario. Recupera puntos, rol y argumentos; el borrador del argumento en preparación también se guarda. No hay forma de recuperarla desde otro navegador o dispositivo (no hay login).
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
devuelve token temporal de Ably, con capacidad limitada a los canales `debate:*`
     (publish, subscribe, presence, history) y `clientId` validado (^[A-Za-z0-9_-]{1,64}$);
     la identidad `host` exige el token firmado de /api/host-login
     │
     ▼
Cliente se conecta a Ably con ese token
```

Esto sí requiere un backend mínimo (solo esa función), distinto de "sin base de datos" — no guarda estado, solo emite tokens. No contradice la decisión de no usar base de datos (ver `02-arquitectura.md`).

## Convención de nombres y despliegue

La familia de proyectos del usuario usa el prefijo **"R2"** (R2 Quiz, R2 Argumentum). Mantener esta convención en nombres de repositorio y, si aplica, en el subdominio de despliegue (ej. `r2-argumentum.vercel.app`), replicando el esquema ya usado en R2 Quiz (`r2-quiz.vercel.app` para consola, `/player.html` para estudiantes).

## Créditos

Se muestran en dos momentos y en ninguno más (no se quiere distraer durante el debate): la **pantalla de ingreso del participante** (debajo del formulario) y el **podio final**. Contenido: foto circular, «Arturo Rodríguez», «Docente, investigador y vibe coder», enlace al ORCID (`0000-0002-7017-9443`) y «Recurso creado con el apoyo de Claude y Antigravity». También van, en una línea, en el pie del login del host y del informe imprimible. Todo sale de una sola constante, `src/shared/creditos.js`; la foto es `public/autor.webp`, un recorte de la cara de 10 KB (el retrato original `public/avatar.png` pesa 3,2 MB, tiene un cartel de fondo con texto deformado y solo lo usa la portada del host).
