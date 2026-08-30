/**
 * src/services/precios.js
 *
 * Lectura y escritura de la tabla precios_tareas (módulo Producción y
 * Ganancias). Las 6 tareas ya existen como filas (creadas en la migración
 * inicial con precio 0) — este servicio solo lee y actualiza, nunca
 * inserta ni borra filas nuevas, porque el vocabulario de tareas es fijo.
 */

import { supabase } from "../supabase.js";

const ETIQUETAS = {
  elaboracion: "Elaboración de estructura",
  tinte_claro: "Tinte claro",
  tinte_medio: "Tinte medio",
  tinte_oscuro: "Tinte oscuro",
  laqueado: "Laqueado",
  reparacion: "Reparación",
};

export function etiquetaTarea(tipoTarea) {
  return ETIQUETAS[tipoTarea] ?? tipoTarea;
}

export async function obtenerPrecios() {
  const { data, error } = await supabase
    .from("precios_tareas")
    .select("tipo_tarea, descripcion, precio_unitario, updated_at")
    .order("tipo_tarea");

  if (error) throw error;
  return data;
}

/**
 * Aplica una lista de actualizaciones { tipo_tarea, precio_unitario }.
 * Devuelve la lista de filas efectivamente actualizadas.
 */
export async function actualizarPrecios(actualizaciones) {
  const aplicadas = [];

  for (const u of actualizaciones) {
    const { data, error } = await supabase
      .from("precios_tareas")
      .update({ precio_unitario: u.precio_unitario, updated_at: new Date().toISOString() })
      .eq("tipo_tarea", u.tipo_tarea)
      .select()
      .single();

    if (error) throw error;
    aplicadas.push(data);
  }

  return aplicadas;
}
