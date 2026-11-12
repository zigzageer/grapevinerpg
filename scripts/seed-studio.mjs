import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { mintStudioSeed } = await server.ssrLoadModule(
    "/src/game/studio-seed.ts",
  );
  console.log(JSON.stringify(mintStudioSeed));
} finally {
  await server.close();
}
