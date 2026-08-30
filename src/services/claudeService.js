/**
 * src/services/claudeService.js
 *
 * Capa de acceso a la API de Claude. Expone dos funciones:
 *
 *   - clasificarIntencion(mensaje, contexto)
 *       Usa INTENT_ROUTER_SYSTEM_PROMPT. Devuelve { intencion, confianza, entidades }.
 *
 *   - interpretarTexto(texto)
 *       Usa INTERPRETATION_SYSTEM_PROMPT. Devuelve el árbol jerárquico
 *       { modelo, parametros_generales, piezas, preguntas }.
 *
 * Ninguna de las dos toca Supabase ni Telegram — solo hablan con la API de
 * Claude y devuelven objetos JS ya parseados y validados. El handler que
 * las llama decide qué hacer con el resultado (mostrar resumen, repreguntar
 * por "preguntas", guardar en Supabase, etc.).
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  INTENT_ROUTER_SYSTEM_PROMPT,
  INTERPRETATION_SYSTEM_PROMPT,
} from '../prompts.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Mismo modelo que usa el resto del ecosistema (SaaS de Inmobiliaria Álvarez).
const MODEL = 'claude-sonnet-4-6';

/**
 * Claude a veces envuelve el JSON en ```json ... ``` a pesar de la
 * instrucción de no hacerlo. Esto lo pela de forma defensiva antes de
 * parsear, para no romper el flujo por un capricho de formato.
 */
function limpiarYParsearJSON(textoCrudo, stopReason) {
  const limpio = textoCrudo
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(limpio);
  } catch (err) {
    // Log completo (sin recortar) para poder diagnosticar en los logs de
    // Render, aparte del mensaje corto que sube el error hacia el handler.
    console.error('JSON crudo que no se pudo parsear (stop_reason:', stopReason, '):');
    console.error(textoCrudo);

    if (stopReason === 'max_tokens') {
      // Se cortó por límite de tokens, no es un problema de formato: la
      // respuesta quedó incompleta a mitad de camino.
      const error = new Error(
        'La respuesta de Claude se cortó por exceder el límite de tokens antes de terminar el JSON.'
      );
      error.truncadoPorTokens = true;
      throw error;
    }

    throw new Error(
      `No se pudo interpretar la respuesta de Claude como JSON. ` +
      `Respuesta cruda (primeros 500 caracteres): ${textoCrudo.slice(0, 500)}`
    );
  }
}

/**
 * Extrae el texto de la respuesta de la API, concatenando todos los
 * bloques de tipo "text" (por si en algún momento se agregan tools).
 */
function extraerTexto(response) {
  return response.content
    .filter((bloque) => bloque.type === 'text')
    .map((bloque) => bloque.text)
    .join('\n')
    .trim();
}

/**
 * Clasifica la intención de un mensaje del usuario.
 *
 * @param {string} mensaje - último mensaje del usuario, tal cual lo escribió.
 * @param {Array<{rol: 'usuario'|'bot', texto: string}>} [contexto] - últimos
 *        mensajes de la conversación (opcional), para resolver referencias
 *        como "esa foto" o "el mismo modelo". Se recomienda pasar como
 *        máximo los últimos 6-8 mensajes para no gastar tokens de más.
 * @returns {Promise<{
 *   intencion: string,
 *   confianza: 'alta'|'media'|'baja',
 *   entidades: { modelo: ?string, pieza: ?string, maquina: ?string, parametro: ?string, valor_nuevo: ?string }
 * }>}
 */
export async function clasificarIntencion(mensaje, contexto = []) {
  const bloqueContexto = contexto.length
    ? `Contexto de la conversación (más reciente al final):\n` +
      contexto.map((m) => `${m.rol === 'usuario' ? 'Usuario' : 'Bot'}: ${m.texto}`).join('\n') +
      `\n\nÚltimo mensaje a clasificar: "${mensaje}"`
    : `Mensaje a clasificar: "${mensaje}"`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: INTENT_ROUTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: bloqueContexto }],
  });

  const resultado = limpiarYParsearJSON(extraerTexto(response), response.stop_reason);

  if (!resultado.intencion || !resultado.entidades) {
    throw new Error(
      `Respuesta de clasificación incompleta: ${JSON.stringify(resultado)}`
    );
  }

  return resultado;
}

/**
 * Interpreta texto libre (la descripción de un modelo) y devuelve el árbol
 * jerárquico listo para revisar/confirmar antes de guardar en Supabase.
 *
 * Si el resultado trae "preguntas" no vacío, el handler NO debe guardar
 * nada todavía: debe repreguntar al usuario, incorporar sus respuestas al
 * texto original (o a un mensaje de seguimiento) y volver a llamar a esta
 * función, hasta que "preguntas" venga vacío o el usuario confirme que
 * quiere guardar igual con lo que hay.
 *
 * @param {string} texto - descripción en lenguaje natural del modelo.
 * @returns {Promise<{
 *   modelo: { nombre: string, tipo: ?string, notas: ?string },
 *   parametros_generales: Array<object>,
 *   piezas: Array<object>,
 *   preguntas: string[]
 * }>}
 */
export async function interpretarTexto(texto) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: INTERPRETATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: texto }],
  });

  const resultado = limpiarYParsearJSON(extraerTexto(response), response.stop_reason);

  if (!resultado.modelo || !Array.isArray(resultado.piezas)) {
    throw new Error(
      `Respuesta de interpretación incompleta: ${JSON.stringify(resultado)}`
    );
  }

  // Normalizamos por si Claude omite el campo en vez de devolver [].
  resultado.parametros_generales = resultado.parametros_generales || [];
  resultado.preguntas = resultado.preguntas || [];

  return resultado;
}
