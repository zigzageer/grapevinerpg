import { readFileSync } from "node:fs";
import { createImageGenerator } from "../bot/image-generator.mjs";
import { StudioStore } from "./studio-store.mjs";
import { StudioService } from "./studio-service.mjs";
import { createVercelVerifier } from "./vercel-auth.mjs";
import { createStudioServer } from "./studio-http.mjs";

const env = process.env;
for (const key of [
  "MINT_STUDIO_SECRET",
  "MINT_STUDIO_DATA_DIR",
  "MINT_STUDIO_SEED_PATH",
  "MINT_STUDIO_TLS_KEY",
  "MINT_STUDIO_TLS_CERT",
])
  if (!env[key]) throw new Error(`Configure ${key} for the character studio.`);
const store = new StudioStore({
  directory: env.MINT_STUDIO_DATA_DIR,
  seed: JSON.parse(readFileSync(env.MINT_STUDIO_SEED_PATH, "utf8")),
});
const service = new StudioService({
  store,
  generate: createImageGenerator({ codexEnv: env }),
  secret: env.MINT_STUDIO_SECRET,
  baseUrl: env.GAME_BASE_URL || "https://adventures-of-mint.vercel.app",
});
const server = createStudioServer({
  service,
  secret: env.MINT_STUDIO_SECRET,
  verifyVercel: createVercelVerifier({
    teamSlug: env.MINT_STUDIO_VERCEL_TEAM_SLUG || "tensymain-8759s-projects",
    teamId: env.MINT_STUDIO_VERCEL_TEAM_ID || "team_YMxRg3j0ixQCGCc8wjrgWSZz",
    projectName: env.MINT_STUDIO_VERCEL_PROJECT_NAME || "adventures-of-mint",
    projectId:
      env.MINT_STUDIO_VERCEL_PROJECT_ID || "prj_0VQ70aDKzQcB17HfOjJ8UG1U6BL5",
  }),
  tls: {
    key: readFileSync(env.MINT_STUDIO_TLS_KEY),
    cert: readFileSync(env.MINT_STUDIO_TLS_CERT),
  },
});
server.listen(
  Number(env.MINT_STUDIO_PORT || 3443),
  env.MINT_STUDIO_BIND || "0.0.0.0",
  () => {
    console.log("[studio] HTTPS character service ready.");
    void service.drain();
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    service.close();
    server.close(() => {
      if (!service.running) {
        store.close();
        process.exit(0);
      }
    });
    // A running Codex child is terminated with the service process group by systemd.
    const stop = setInterval(() => {
      if (!service.running) {
        clearInterval(stop);
        store.close();
        process.exit(0);
      }
    }, 100);
  });
