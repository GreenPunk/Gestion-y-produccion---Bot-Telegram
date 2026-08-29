/**
 * src/services/guardarModelo.js
 *
 * Persiste el árbol jerárquico que devuelve interpretarTexto() (Claude) en
 * las tablas reales de Supabase: muebles, piezas, maquinas, parametros.
 *
 * Decisión de modelado: el esquema (Fase 1) no tiene una columna "madera"
 * dedicada en `piezas` — así que la madera de cada pieza se guarda como un
 * parametro más, con nombre "Madera", colgado de la pieza. Si preferís una
 * columna propia en `piezas`, se puede migrar después sin tocar el resto
 * del contrato.
 */

import { supabase } from "../supabase.js";

async function insertarParametro(muebleId, piezaId, maquinaId, parametroPadreId, p, orden) {
  const { data: fila, error } = await supabase
    .from("parametros")
    .insert({
      mueble_id: muebleId,
      pieza_id: piezaId,
      maquina_id: maquinaId,
      parametro_padre_id: parametroPadreId,
      nombre: p.nombre,
      valor: p.valor,
      unidad: p.unidad,
      nota: p.nota,
      orden,
    })
    .select()
    .single();

  if (error) throw error;

  let ordenHijo = 0;
  for (const hijo of p.sub_parametros ?? []) {
    // Los sub-parámetros cuelgan del padre vía parametro_padre_id únicamente
    // (mismo criterio que usa handlers/ver.js al reconstruir el árbol).
    await insertarParametro(muebleId, null, null, fila.id, hijo, ordenHijo++);
  }

  return fila;
}

export async function guardarArbolEnSupabase(arbol) {
  const { data: mueble, error: errorMueble } = await supabase
    .from("muebles")
    .insert({
      nombre: arbol.modelo.nombre,
      tipo: arbol.modelo.tipo,
      notas: arbol.modelo.notas,
    })
    .select()
    .single();

  if (errorMueble) throw errorMueble;

  let ordenGeneral = 0;
  for (const p of arbol.parametros_generales ?? []) {
    await insertarParametro(mueble.id, null, null, null, p, ordenGeneral++);
  }

  let ordenPieza = 0;
  for (const pieza of arbol.piezas ?? []) {
    const { data: piezaFila, error: errorPieza } = await supabase
      .from("piezas")
      .insert({
        mueble_id: mueble.id,
        nombre: pieza.nombre,
        orden: ordenPieza++,
      })
      .select()
      .single();

    if (errorPieza) throw errorPieza;

    let ordenParam = 0;

    if (pieza.madera) {
      await insertarParametro(
        mueble.id,
        piezaFila.id,
        null,
        null,
        { nombre: "Madera", valor: pieza.madera, unidad: null, nota: null, sub_parametros: [] },
        ordenParam++
      );
    }

    for (const p of pieza.parametros ?? []) {
      await insertarParametro(mueble.id, piezaFila.id, null, null, p, ordenParam++);
    }

    let ordenMaquina = 0;
    for (const maquina of pieza.maquinas ?? []) {
      const { data: maquinaFila, error: errorMaquina } = await supabase
        .from("maquinas")
        .insert({
          mueble_id: mueble.id,
          pieza_id: piezaFila.id,
          tipo: maquina.tipo,
          observaciones: maquina.observaciones,
          orden: ordenMaquina++,
        })
        .select()
        .single();

      if (errorMaquina) throw errorMaquina;

      let ordenParamMaquina = 0;
      for (const p of maquina.parametros ?? []) {
        await insertarParametro(mueble.id, null, maquinaFila.id, null, p, ordenParamMaquina++);
      }
    }
  }

  return mueble;
}
