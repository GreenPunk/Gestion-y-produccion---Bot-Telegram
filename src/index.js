import "dotenv/config";
import express from "express";
import { Bot, webhookCallback } from "grammy";
import { handleStart } from "./handlers/start.js";
import { handleListar } from "./handlers/listar.js";
import { handleVer } from "./handlers/ver.js";
import { reiniciarSesion, obtenerSesion } from "./session.js";

const requiredEnv = ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Falta la variable de entorno ${key}`);
    process.exit(1);
  }
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.command("start", handleStart);
bot.command("listar", handleListar);

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
bot.command("nuevo_modelo", async (ctx) => {
  await ctx.reply("La carga guiada de modelos nuevos se implementa en la Fase 3/5. Todavía no está activa.");
});
bot.command("modificar", async (ctx) => {
  await ctx.reply("La edición por lista/lenguaje natural se implementa en la Fase 5. Todavía no está activa.");
});
bot.command("fotos", async (ctx) => {
  await ctx.reply("El manejo de fotos se implementa en la Fase 4. Todavía no está activo.");
});
bot.command("borrar", async (ctx) => {
  await ctx.reply("El borrado de modelos se implementa en la Fase 5. Todavía no está activo.");
});

// Mensajes en lenguaje natural (sin comando): por ahora solo confirma que
// llegó. El router de intención completo (Claude interpretando qué quiere
// hacer el usuario) se implementa en la Fase 3.
bot.on("message:text", async (ctx) => {
  const sesion = await obtenerSesion(ctx.from.id);
  await ctx.reply(
    `Por ahora todavía no interpreto lenguaje natural libre (eso es la Fase 3). ` +
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
