import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { DEFAULT_CREW } = await server.ssrLoadModule("/src/game/model.ts");
  const { ADDITIONAL_BIOS } = await server.ssrLoadModule(
    "/src/game/character-bios.ts",
  );
  console.log(
    JSON.stringify({
      characters: DEFAULT_CREW.filter(
        (c) => c.kind === "mint" || c.preset || c.sprite,
      ),
      descriptions: Object.fromEntries(
        Object.entries(ADDITIONAL_BIOS).map(([key, value]) => [
          key,
          value.description,
        ]),
      ),
    }),
  );
} finally {
  await server.close();
}
