import "dotenv/config";
import express from "express";
import { Bot, webhookCallback } from "grammy";
import { handleStart } from "./handlers/start.js";
import { handleListar } from "./handlers/listar.js";
import { handleVer } from "./handlers/ver.js";
import {
  iniciarNuevoModelo,
  manejarTextoLibreCargando,
  manejarCallbackNuevoModelo,
} from "./handlers/nuevoModelo.js";
import { verPrecios, actualizarPreciosDesdeTexto } from "./handlers/precios.js";
import { reiniciarSesion, obtenerSesion, ESTADOS } from "./session.js";

const requiredEnv = ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Falta la variable de entorno ${key}`);
    process.exit(1);
  }
}

// Red de seguridad: cualquier error no atrapado en algún handler NO debe
// tumbar el proceso entero (eso generaba un loop de crashes en Render cada
// vez que una llamada a la API de Claude tardaba más de lo esperado).
// Se loguea para poder diagnosticarlo, pero el servidor sigue vivo.
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.command("start", handleStart);
bot.command("listar", handleListar);
bot.command("nuevo_modelo", iniciarNuevoModelo);

bot.command("precios", async (ctx) => {
  const texto = ctx.match?.trim();
  if (!texto) {
    await verPrecios(ctx);
    return;
  }
  await actualizarPreciosDesdeTexto(ctx, texto);
});

bot.command("ver", async (ctx) => {
  const nombre = ctx.match?.trim();
  if (!nombre) {
    await ctx.reply("Decime qué modelo querés ver, ej: /ver Roma");
    return;
  }
  await handleVer(ctx, nombre);
});

bot.command("cancelar", async (ctx) => {
  await reiniciarSesion(ctx.from.id);
  await ctx.reply("Listo, cancelado.");
});

// Stubs — se completan en las próximas fases
bot.command("modificar", async (ctx) => {
  await ctx.reply("La edición por lista/lenguaje natural se implementa en la Fase 5. Todavía no está activa.");
});
bot.command("fotos", async (ctx) => {
  await ctx.reply("El manejo de fotos se implementa en la Fase 4. Todavía no está activo.");
});
bot.command("borrar", async (ctx) => {
  await ctx.reply("El borrado de modelos se implementa en la Fase 5. Todavía no está activo.");
});

// Botones inline del flujo de carga de modelo nuevo (Confirmar / Editar / Cancelar)
bot.callbackQuery(/^nuevo_modelo:(confirmar|editar|cancelar)$/, async (ctx) => {
  const sesion = await obtenerSesion(ctx.from.id);
  const accion = ctx.match[1];
  await manejarCallbackNuevoModelo(ctx, sesion, accion);
});

// Mensajes en lenguaje natural (sin comando).
bot.on("message:text", async (ctx) => {
  const sesion = await obtenerSesion(ctx.from.id);

  if (sesion.estado === ESTADOS.CARGANDO_MODELO) {
    await manejarTextoLibreCargando(ctx, sesion, ctx.message.text);
    return;
  }

  await ctx.reply(
    `Por ahora todavía no interpreto lenguaje natural libre fuera de la carga de un modelo (eso sigue en la Fase 5). ` +
      `Usá /start para ver los comandos disponibles. (Tu estado actual: ${sesion.estado})`
  );
});

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Bot de catálogo de muebles funcionando.");
});

app.use(
  webhookCallback(bot, "express", {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    // Interpretar texto libre implica una llamada a la API de Claude, que
    // puede tardar más que los 10s que grammy espera por defecto. Le damos
    // más margen y evitamos que un timeout tire una excepción sin atrapar.
    timeoutMilliseconds: 60_000,
    onTimeout: "return",
  })
);

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Servidor escuchando en el puerto ${port}`);

  if (process.env.PUBLIC_URL) {
    try {
      await bot.api.setWebhook(`${process.env.PUBLIC_URL}/`, {
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      });
      console.log(`Webhook configurado en ${process.env.PUBLIC_URL}/`);
    } catch (err) {
      console.error("No se pudo configurar el webhook:", err);
    }
  } else {
    console.warn("PUBLIC_URL no está definida — no se configuró el webhook automáticamente.");
  }
});
