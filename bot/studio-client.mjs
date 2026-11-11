import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { bridgeRequest } from "./studio-bridge.mjs";

export function createStudioDiscordService(
  env = process.env,
  { transport = bridgeRequest, sleep = delay, now = Date.now } = {},
) {
  const origin = env.MINT_STUDIO_INTERNAL_ORIGIN || env.MINT_STUDIO_ORIGIN;
  const ca =
    env.MINT_STUDIO_CA ||
    (env.MINT_STUDIO_CA_PATH
      ? readFileSync(env.MINT_STUDIO_CA_PATH, "utf8")
      : undefined);
  if (!origin || !env.MINT_STUDIO_SECRET || !ca)
    throw new Error("Configure the shared character studio for this bot.");
  const call = async (path, input) => {
    const result = await transport({
      origin,
      ca,
      secret: env.MINT_STUDIO_SECRET,
      path,
      ip: "127.0.0.1",
      method: input ? "POST" : "GET",
      body: input ? Buffer.from(JSON.stringify(input)) : undefined,
    });
    const data = JSON.parse(result.bytes.toString("utf8"));
    if (result.status >= 400)
      throw new Error(data.error || "The character studio request failed.");
    return data;
  };
  return {
    create: (input) => call("/internal/create", input),
    add: async (input) => {
      let job = await call("/internal/add", input);
      const deadline = now() + 4 * 60 * 1000;
      while (["queued", "running"].includes(job.status) && now() < deadline) {
        await sleep(2000);
        job = await call(`/internal/jobs/${job.id}`);
      }
      if (job.status === "failed")
        throw new Error(job.error || "Character generation failed.");
      if (job.status === "succeeded") return job.result;
      const game = await call(`/games/${input.guildId}`);
      return {
        pending: true,
        character: { name: input.name || input.displayName },
        url: `${(env.GAME_BASE_URL || "https://adventures-of-mint.vercel.app").replace(/\/$/, "")}/${game.slug}`,
      };
    },
  };
}
