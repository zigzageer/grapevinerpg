import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mintStudioSeed } from "./src/game/studio-seed.ts";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "mint-studio-roster",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "games/mint-studio.json",
          source: JSON.stringify(mintStudioSeed),
        });
      },
    },
  ],
  server: { port: 5173 },
});
