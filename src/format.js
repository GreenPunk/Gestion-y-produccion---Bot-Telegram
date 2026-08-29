/**
 * src/format.js
 *
 * Formatea el árbol jerárquico que devuelve interpretarTexto() (Claude) como
 * texto legible en Telegram, para el resumen de confirmación de carga.
 *
 * Nota: esto es distinto del formateador que ya existe en handlers/ver.js
 * (ese arma el árbol a partir de filas planas de Supabase, con ids reales;
 * este arma el árbol a partir del objeto que devuelve la interpretación,
 * antes de guardar nada).
 */

function formatearParametro(p, indent) {
  const unidad = p.unidad ? ` ${p.unidad}` : "";
  const valor = p.valor ? `: ${p.valor}${unidad}` : "";
  const nota = p.nota ? ` (${p.nota})` : "";
  let texto = `${indent}${p.nombre}${valor}${nota}\n`;
  for (const hijo of p.sub_parametros ?? []) {
    texto += formatearParametro(hijo, indent + "  ");
  }
  return texto;
}

export function formatearResumenArbol(arbol) {
  let texto = `*${arbol.modelo.nombre}*`;
  if (arbol.modelo.tipo) texto += ` (${arbol.modelo.tipo})`;
  texto += "\n";
  if (arbol.modelo.notas) texto += `_${arbol.modelo.notas}_\n`;
  texto += "\n";

  for (const p of arbol.parametros_generales ?? []) {
    texto += formatearParametro(p, "");
  }

  for (const pieza of arbol.piezas ?? []) {
    texto += `\n*${pieza.nombre}*`;
    if (pieza.madera) texto += ` — madera: ${pieza.madera}`;
    texto += "\n";

    for (const p of pieza.parametros ?? []) {
      texto += formatearParametro(p, "  ");
    }

    for (const maquina of pieza.maquinas ?? []) {
      texto += `  ${maquina.tipo}`;
      if (maquina.observaciones) texto += ` (${maquina.observaciones})`;
      texto += "\n";
      for (const p of maquina.parametros ?? []) {
        texto += formatearParametro(p, "    ");
      }
    }
  }

  return texto;
}
