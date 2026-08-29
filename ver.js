import { supabase } from "../supabase.js";

function construirArbolParametros(parametros, filtro) {
  const hijos = parametros.filter(
    (p) =>
      p.parametro_padre_id === null &&
      p.pieza_id === (filtro.pieza_id ?? null) &&
      p.maquina_id === (filtro.maquina_id ?? null)
  );

  return hijos
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({
      ...p,
      hijos: construirNietos(parametros, p.id),
    }));
}

function construirNietos(parametros, parametroPadreId) {
  return parametros
    .filter((p) => p.parametro_padre_id === parametroPadreId)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({ ...p, hijos: construirNietos(parametros, p.id) }));
}

function formatearParametro(p, indent) {
  const unidad = p.unidad ? ` ${p.unidad}` : "";
  const valor = p.valor ? `: ${p.valor}${unidad}` : "";
  const nota = p.nota ? ` (${p.nota})` : "";
  let texto = `${indent}${p.nombre}${valor}${nota}\n`;
  for (const hijo of p.hijos) {
    texto += formatearParametro(hijo, indent + "  ");
  }
  return texto;
}

export async function handleVer(ctx, nombreBuscado) {
  const { data: mueble, error: errorMueble } = await supabase
    .from("muebles")
    .select("*")
    .ilike("nombre", nombreBuscado)
    .maybeSingle();

  if (errorMueble) {
    console.error(errorMueble);
    await ctx.reply("Uy, no pude buscar el modelo. Probá de nuevo en un rato.");
    return;
  }

  if (!mueble) {
    await ctx.reply(`No encontré ningún modelo llamado "${nombreBuscado}".`);
    return;
  }

  const [{ data: parametros }, { data: piezas }, { data: maquinas }, { data: imagenes }] =
    await Promise.all([
      supabase.from("parametros").select("*").eq("mueble_id", mueble.id),
      supabase.from("piezas").select("*").eq("mueble_id", mueble.id).order("orden"),
      supabase.from("maquinas").select("*").eq("mueble_id", mueble.id).order("orden"),
      supabase.from("imagenes").select("*").eq("mueble_id", mueble.id).order("orden"),
    ]);

  let texto = `*${mueble.nombre}* (${mueble.tipo ?? "sin tipo"})\n`;
  if (mueble.notas) texto += `_${mueble.notas}_\n`;
  texto += "\n";

  // Parámetros a nivel mueble (no ligados a pieza ni máquina)
  const parametrosMueble = construirArbolParametros(parametros ?? [], {});
  for (const p of parametrosMueble) {
    texto += formatearParametro(p, "");
  }

  for (const pieza of piezas ?? []) {
    texto += `\n*${pieza.nombre}*\n`;
    const parametrosPieza = construirArbolParametros(parametros ?? [], {
      pieza_id: pieza.id,
    });
    for (const p of parametrosPieza) {
      texto += formatearParametro(p, "  ");
    }

    const maquinasPieza = (maquinas ?? []).filter((m) => m.pieza_id === pieza.id);
    for (const maquina of maquinasPieza) {
      texto += `  ${maquina.tipo}${maquina.observaciones ? ` (${maquina.observaciones})` : ""}\n`;
      const parametrosMaquina = construirArbolParametros(parametros ?? [], {
        maquina_id: maquina.id,
      });
      for (const p of parametrosMaquina) {
        texto += formatearParametro(p, "    ");
      }
    }
  }

  await ctx.reply(texto, { parse_mode: "Markdown" });

  for (const imagen of imagenes ?? []) {
    if (imagen.data) {
      await ctx.replyWithPhoto(imagen.data);
    }
  }
}
