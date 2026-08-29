# Bot de catálogo de muebles

Bot de Telegram para cargar y consultar medidas, piezas y fotos de los modelos de muebles de la fábrica.

## Estado actual (Fase 2 en curso)

Funciona:
- `/start`, `/listar`, `/ver [nombre]`, `/cancelar`

Todavía no (próximas fases):
- `/nuevo_modelo`, `/modificar`, `/fotos`, `/borrar` — están como stubs
- Interpretación de lenguaje natural vía Claude (Fase 3)

## Correrlo en local

```bash
npm install
cp .env.example .env
# completar .env con el token de Telegram, las keys de Supabase y de Anthropic
npm run dev
```

En local no vas a tener `PUBLIC_URL` (no hay URL pública), así que el bot no configura webhook automáticamente. Para probar en local sin desplegar, se puede usar un túnel tipo `ngrok` y setear `PUBLIC_URL` a esa URL temporal.

## Deploy en Render

1. Subir este proyecto a un repositorio de GitHub
2. En Render: New → Web Service → conectar el repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Variables de entorno: cargar todas las de `.env.example` (el `PUBLIC_URL` es la URL que Render le asigna al servicio, ej: `https://bot-muebles.onrender.com`)
6. Al arrancar, el bot configura el webhook de Telegram automáticamente contra `PUBLIC_URL`

## Estructura

```
src/
  index.js       — servidor Express + bot (grammy) + configuración de webhook
  supabase.js    — cliente de Supabase (service role)
  claude.js      — cliente de Claude API (stub, se completa en Fase 3)
  session.js     — manejo de estado por usuario (tabla sesiones_bot)
  handlers/
    start.js
    listar.js
    ver.js       — arma el árbol completo del modelo (parámetros, piezas, máquinas, fotos)
```
