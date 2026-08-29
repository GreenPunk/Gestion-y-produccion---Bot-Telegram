import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Falta ANTHROPIC_API_KEY en las variables de entorno");
}

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// NOTA: el prompt de sistema real (el "contrato" Modelo > Piezas > Parámetros
// con Barreno/Espigadora, mapeo a la base, router de intención, etc.) se
// desarrolla en la Fase 3. Esto es un stub para dejar el cliente listo.
export async function interpretarMensaje(texto) {
  const respuesta = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      "Sos un asistente que ayuda a catalogar medidas de muebles de una fábrica. Por ahora solo respondé de forma breve confirmando que recibiste el mensaje; la lógica completa de interpretación se implementa en la próxima fase.",
    messages: [{ role: "user", content: texto }],
  });

  return respuesta.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("\n");
}
