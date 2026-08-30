/**
 * src/handlers/nuevoModelo.js
 *
 * Flujo completo de alta de un modelo nuevo:
 *
 *   1. /nuevo_modelo (o "quiero cargar un mueble nuevo" vía router de
 *      intención) -> iniciarNuevoModelo: resetea la sesión y pide la
 *      descripción en texto libre.
 *
 *   2. El usuario manda la descripción -> manejarTextoLibreCargando:
 *      llama a interpretarTexto(). Si Claude devuelve "preguntas" (casos
 *      ambiguos), se las repregunta al usuario y espera su aclaración
 *      antes de seguir. Si no hay preguntas, muestra el resumen con
 *      botones Confirmar / Editar / Cancelar.
 *
 *   3. El usuario toca un botón -> manejarCallbackNuevoModelo:
 *        - Confirmar: guarda el árbol en Supabase (guardarModelo.js).
 *        - Editar: pide una corrección en lenguaje natural y vuelve a
 *          interpretar el texto combinado (versión simplificada de la
 *          "edición por campo" del plan — todavía no hay selector
 *          numerado de campos puntuales, eso queda para profundizar
 *          la Fase 5 si hace falta).
 *        - Cancelar: reinicia la sesión.
 */

import { InlineKeyboard } from "grammy";
import { interpretarTexto } from "../services/claudeService.js";
import { guardarArbolEnSupabase } from "../services/guardarModelo.js";
import { actualizarSesion, reiniciarSesion, ESTADOS } from "../session.js";
import { formatearResumenArbol } from "../format.js";

export async function iniciarNuevoModelo(ctx) {
  await actualizarSesion(ctx.from.id, {
    estado: ESTADOS.CARGANDO_MODELO,
    contexto: {},
    mueble_id_en_curso: null,
    pieza_id_en_curso: null,
  });

  await ctx.reply(
    "Dale, contame el modelo nuevo con tus palabras: piezas, medidas, maderas, " +
      "barrenos, espigas, lo que tengas. Podés mandarlo todo junto, no hace falta " +
      "que sea prolijo.\n\nCuando quieras, mandá /cancelar para abortar."
  );
}

export async function manejarTextoLibreCargando(ctx, sesion, texto) {
  const textoOriginal = sesion.contexto?.texto_original
    ? `${sesion.contexto.texto_original}\n\nAclaración del usuario: ${texto}`
    : texto;

  // La interpretación llama a la API de Claude y puede tardar varios
  // segundos — avisamos para que no parezca que el bot se colgó.
  await ctx.reply("Dale, dejame interpretarlo...");

  let resultado;
  try {
    resultado = await interpretarTexto(textoOriginal);
  } catch (err) {
    console.error(err);

    if (err.truncadoPorTokens) {
      await ctx.reply(
        "El modelo que describiste es muy grande para procesarlo de una — se cortó a mitad de camino. " +
          "Probá partirlo en dos mensajes (por ejemplo, primero las medidas generales y la mitad de las piezas, " +
          "después el resto) y lo voy combinando."
      );
      return;
    }

    await ctx.reply(
      "Uy, no pude interpretar ese texto. Probá reformularlo, o mandá /cancelar si preferís arrancar de nuevo."
    );
    return;
  }

  if (resultado.preguntas.length > 0) {
    await actualizarSesion(ctx.from.id, {
      estado: ESTADOS.CARGANDO_MODELO,
      contexto: { texto_original: textoOriginal, arbol: resultado },
    });

    const preguntas = resultado.preguntas.map((p, i) => `${i + 1}. ${p}`).join("\n");
    await ctx.reply(`Antes de seguir, necesito que me aclares esto:\n\n${preguntas}`);
    return;
  }

  await actualizarSesion(ctx.from.id, {
    estado: ESTADOS.CARGANDO_MODELO_CONFIRMANDO,
    contexto: { texto_original: textoOriginal, arbol: resultado },
  });

  const resumen = formatearResumenArbol(resultado);
  const teclado = new InlineKeyboard()
    .text("✅ Confirmar todo", "nuevo_modelo:confirmar")
    .row()
    .text("✏️ Editar algo", "nuevo_modelo:editar")
    .row()
    .text("❌ Cancelar", "nuevo_modelo:cancelar");

  await ctx.reply(`Así lo entendí:\n\n${resumen}`, {
    parse_mode: "Markdown",
    reply_markup: teclado,
  });
}

export async function manejarCallbackNuevoModelo(ctx, sesion, accion) {
  if (accion === "confirmar") {
    const arbol = sesion.contexto?.arbol;
    if (!arbol) {
      await ctx.answerCallbackQuery({ text: "No tengo nada pendiente para guardar." });
      return;
    }

    try {
      await guardarArbolEnSupabase(arbol);
    } catch (err) {
      console.error(err);
      await ctx.answerCallbackQuery();
      await ctx.reply("Uy, no pude guardar el modelo en la base. Probá de nuevo en un rato.");
      return;
    }

    await reiniciarSesion(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "Guardado" });
    await ctx.reply(`Listo, "${arbol.modelo.nombre}" quedó cargado. Podés verlo con /ver ${arbol.modelo.nombre}`);
    return;
  }

  if (accion === "editar") {
    await actualizarSesion(ctx.from.id, { estado: ESTADOS.CARGANDO_MODELO });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Contame qué corregir, en una frase (ej: \"la pata delantera es de paraíso, no de pino\")."
    );
    return;
  }

  if (accion === "cancelar") {
    await reiniciarSesion(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "Cancelado" });
    await ctx.reply("Listo, cancelado.");
    return;
  }
}
