/**
 * src/handlers/precios.js
 *
 * Comando /precios (módulo Producción y Ganancias):
 *
 *   - "/precios" (sin nada más) → muestra la lista de precios actual.
 *   - "/precios <texto libre>" → interpreta el texto con Claude
 *     (interpretarPrecios), actualiza precios_tareas, y confirma qué
 *     quedó guardado. Si alguna mención no se pudo mapear con confianza a
 *     una de las 6 tareas conocidas, se lo avisa al usuario en vez de
 *     adivinar.
 */

import { interpretarPrecios } from "../services/claudeService.js";
import { obtenerPrecios, actualizarPrecios, etiquetaTarea } from "../services/preciosService.js";

function formatearListaPrecios(precios) {
  return precios
    .map((p) => `• ${etiquetaTarea(p.tipo_tarea)}: $${Number(p.precio_unitario).toLocaleString("es-AR")}`)
    .join("\n");
}

export async function verPrecios(ctx) {
  const precios = await obtenerPrecios();
  await ctx.reply(`Precios actuales:\n\n${formatearListaPrecios(precios)}`);
}

export async function actualizarPreciosDesdeTexto(ctx, texto) {
  let resultado;
  try {
    resultado = await interpretarPrecios(texto);
  } catch (err) {
    console.error(err);
    await ctx.reply("Uy, no pude interpretar esos precios. Probá reformularlo.");
    return;
  }

  if (resultado.actualizaciones.length === 0) {
    await ctx.reply(
      "No detecté ninguna tarea reconocida con precio en ese texto. " +
        "Las tareas válidas son: elaboración, tinte claro, tinte medio, tinte oscuro, laqueado, reparación."
    );
    return;
  }

  const aplicadas = await actualizarPrecios(resultado.actualizaciones);

  let respuesta = "Listo, actualicé:\n\n" +
    aplicadas
      .map((p) => `• ${etiquetaTarea(p.tipo_tarea)}: $${Number(p.precio_unitario).toLocaleString("es-AR")}`)
      .join("\n");

  if (resultado.no_reconocido.length > 0) {
    respuesta += `\n\nNo pude identificar a qué tarea corresponde esto, aclarámelo si querés cargarlo:\n` +
      resultado.no_reconocido.map((r) => `• "${r}"`).join("\n");
  }

  await ctx.reply(respuesta);
}
