import { supabase } from "./supabase.js";

// Estados posibles del bot para un usuario.
export const ESTADOS = {
  IDLE: "idle",
  CARGANDO_MODELO: "cargando_modelo",
  CARGANDO_MODELO_CONFIRMANDO: "cargando_modelo_confirmando",
  MODIFICANDO: "modificando",
};

export async function obtenerSesion(telegramUserId) {
  const { data, error } = await supabase
    .from("sesiones_bot")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return crearSesion(telegramUserId);
  }

  return data;
}

async function crearSesion(telegramUserId) {
  const { data, error } = await supabase
    .from("sesiones_bot")
    .insert({ telegram_user_id: telegramUserId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarSesion(telegramUserId, cambios) {
  const { data, error } = await supabase
    .from("sesiones_bot")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("telegram_user_id", telegramUserId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reiniciarSesion(telegramUserId) {
  return actualizarSesion(telegramUserId, {
    estado: ESTADOS.IDLE,
    contexto: {},
    mueble_id_en_curso: null,
    pieza_id_en_curso: null,
  });
}
