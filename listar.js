import { supabase } from "../supabase.js";

export async function handleListar(ctx) {
  const { data, error } = await supabase
    .from("muebles")
    .select("nombre, tipo")
    .order("nombre");

  if (error) {
    console.error(error);
    await ctx.reply("Uy, no pude consultar los modelos. Probá de nuevo en un rato.");
    return;
  }

  if (!data || data.length === 0) {
    await ctx.reply("Todavía no hay ningún modelo cargado. Usá /nuevo_modelo para arrancar.");
    return;
  }

  const lista = data.map((m) => `• ${m.nombre} (${m.tipo ?? "sin tipo"})`).join("\n");
  await ctx.reply(`Modelos cargados:\n\n${lista}`);
}
