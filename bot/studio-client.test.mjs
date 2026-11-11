import test from "node:test";
import assert from "node:assert/strict";
import { createStudioDiscordService } from "./studio-client.mjs";

const env = {
  MINT_STUDIO_INTERNAL_ORIGIN: "https://127.0.0.1:3443",
  MINT_STUDIO_SECRET: "local-test-secret",
  MINT_STUDIO_CA: "unit-test-certificate",
  GAME_BASE_URL: "https://adventures-of-mint.vercel.app",
};
const input = {
  guildId: "123456789012345678",
  userId: "223456789012345678",
  displayName: "Server Bob",
  description: "Blue coat",
  usePfp: false,
};
const response = (body, status = 200) => ({
  status,
  bytes: Buffer.from(JSON.stringify(body)),
});

test("the Discord studio adapter creates empty games and returns a completed character", async () => {
  const calls = [];
  const service = createStudioDiscordService(env, {
    sleep: async () => {},
    transport: async (request) => {
      calls.push(request);
      if (request.path === "/internal/create")
        return response({
          game: { characters: [] },
          url: "https://adventures-of-mint.vercel.app/friends-123456789012345678",
        });
      if (request.path === "/internal/add")
        return response({ id: "job", status: "queued" }, 202);
      return response({
        status: "succeeded",
        result: {
          character: { name: "Server Bob" },
          deployment: { state: "READY" },
        },
      });
    },
  });
  assert.equal(
    (await service.create({ guildId: input.guildId, guildName: "Friends" }))
      .game.characters.length,
    0,
  );
  assert.equal((await service.add(input)).character.name, "Server Bob");
  assert.deepEqual(JSON.parse(calls[1].body.toString()), input);
  assert.equal(calls[1].ip, "127.0.0.1");
});

test("long queued Discord jobs return their town link before the interaction expires", async () => {
  let time = 0;
  const service = createStudioDiscordService(env, {
    now: () => time,
    sleep: async () => {
      time += 5 * 60 * 1000;
    },
    transport: async ({ path }) =>
      path.startsWith("/games/")
        ? response({ slug: "friends-123456789012345678" })
        : response({ id: "job", status: "queued" }),
  });
  const result = await service.add(input);
  assert.equal(result.pending, true);
  assert.equal(result.character.name, "Server Bob");
  assert.match(result.url, /friends-123456789012345678$/);
});
