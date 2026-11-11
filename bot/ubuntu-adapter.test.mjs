import test from "node:test";
import assert from "node:assert/strict";
import { createUbuntuGameHandler, gameDefinition } from "./ubuntu-adapter.mjs";

test("Ubuntu adapter includes the existing bot owner and configures once on first command", async () => {
  let configurations = 0;
  const requests = [];
  const handle = createUbuntuGameHandler({
    ownerId: "573614648239194186",
    env: { GAME_ALLOWED_USER_IDS: "123456789012345678" },
    configure: (env) => {
      configurations++;
      assert.equal(
        env.GAME_ALLOWED_USER_IDS,
        "123456789012345678,573614648239194186",
      );
      return async (interaction) => {
        requests.push(interaction);
        return true;
      };
    },
  });
  assert.equal(configurations, 0);
  const interaction = { commandName: "game" };
  await handle(interaction);
  await handle(interaction);
  assert.equal(configurations, 1);
  assert.equal(requests.length, 2);
  assert.equal(gameDefinition.dm_permission, false);
  assert.equal(gameDefinition.default_member_permissions, null);
});

test("missing credentials report setup failure without breaking the bot or revealing secrets", async () => {
  let response;
  const handle = createUbuntuGameHandler({
    configure: () => {
      throw new Error("sensitive provider configuration");
    },
  });
  await handle({
    reply: async (message) => {
      response = message;
    },
  });
  assert.equal(response.flags, 64);
  assert.match(response.content, /finish setup/);
  assert.doesNotMatch(response.content, /sensitive/);
});
