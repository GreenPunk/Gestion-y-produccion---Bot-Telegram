export async function handleStart(ctx) {
  await ctx.reply(
    "Hola! Soy el catálogo de modelos de muebles.\n\n" +
      "Podés escribirme en lenguaje natural (ej: 'mostrame la Roma', 'quiero cargar un modelo nuevo') " +
      "o usar los comandos:\n" +
      "/nuevo_modelo — cargar un mueble nuevo\n" +
      "/listar — ver todos los modelos\n" +
      "/ver [nombre] — ver un modelo puntual\n" +
      "/modificar [nombre] — editar o borrar datos de un modelo\n" +
      "/fotos [nombre] — agregar, borrar o reemplazar fotos\n" +
      "/borrar [nombre] — borrar un modelo completo\n" +
      "/cancelar — cancelar lo que esté en curso"
  );
}
