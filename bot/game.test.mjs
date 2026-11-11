import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { writeFile, access, symlink } from "node:fs/promises";
import path from "node:path";
import { GameService, serverSlug } from "./game-service.mjs";
import { GitHubGameStore } from "./github-store.mjs";
import { createGameCommandHandler, gameCommand } from "./game-command.mjs";
import {
  createImageGenerator,
  downloadReference,
  prepareSprite,
} from "./image-generator.mjs";

const GUILD = "123456789012345678",
  OTHER = "223456789012345678",
  USER = "323456789012345678";
const manifest = (guildId = GUILD) => ({
  version: 1,
  guildId,
  name: "Mint’s Lounge",
  slug: serverSlug("Mint’s Lounge", guildId),
  updatedAt: "2026-01-01",
  characters: [],
});
function setup(generate = async () => Buffer.from("sprite")) {
  const games = new Map(),
    commits = [];
  const store = {
    read: async (id) => games.get(id) || null,
    update: async (id, change, options) => {
      const current = games.get(id) || null;
      const game = change(current);
      games.set(id, game);
      const commit =
        game === current ? null : `commit-${commits.push(options)}`;
      return { game, commit };
    },
  };
  const service = new GameService({
    store,
    generate,
    baseUrl: "https://example.com",
    now: () => "2026-02-01",
  });
  return { service, store, games, commits };
}

test("create starts empty, is repeatable without resetting, and keeps same-named servers separate", async () => {
  const { service, games, commits } = setup();
  const first = await service.create({
    guildId: GUILD,
    guildName: "Mint’s Lounge",
  });
  assert.deepEqual(first.game.characters, []);
  games.get(GUILD).characters.push({ id: "existing" });
  const repeated = await service.create({
    guildId: GUILD,
    guildName: "Renamed server",
  });
  assert.equal(repeated.url, first.url);
  assert.equal(repeated.existing, true);
  assert.equal(repeated.game.characters.length, 1);
  const other = await service.create({
    guildId: OTHER,
    guildName: "Mint’s Lounge",
  });
  assert.notEqual(other.url, first.url);
  assert.equal(other.game.characters.length, 0);
  assert.equal(commits.length, 2);
  assert.equal(serverSlug("✨日本語✨", OTHER), `server-${OTHER}`);
});

test("add uses nickname, avatar and uploaded reference; override and pfp=false are honored", async () => {
  const requests = [];
  const { service, games, commits } = setup(async (request) => {
    requests.push(request);
    return Buffer.from("sprite");
  });
  games.set(GUILD, manifest());
  games.set(OTHER, manifest(OTHER));
  const image = {
    url: "https://cdn.discordapp.com/attachments/photo.png",
    size: 100,
  };
  const first = await service.add({
    guildId: GUILD,
    userId: USER,
    displayName: "Server Bob",
    avatar: "https://cdn.discordapp.com/avatar.png",
    image,
  });
  assert.equal(first.character.name, "Server Bob");
  assert.equal(requests[0].references.length, 2);
  assert.equal(first.character.sprite, `/games/${GUILD}/${USER}.png`);
  assert.equal(commits[0].sprite.bytes.toString(), "sprite");
  await service.add({
    guildId: OTHER,
    userId: USER,
    displayName: "Server Bob",
    name: "Wizard Bob",
    description: "Purple coat",
    usePfp: false,
    avatar: "https://cdn.discordapp.com/avatar.png",
    image,
  });
  assert.equal(requests[1].name, "Wizard Bob");
  assert.equal(requests[1].description, "Purple coat");
  assert.deepEqual(requests[1].references, [image]);
  assert.equal(games.get(GUILD).characters[0].name, "Server Bob");
});

test("missing games, duplicates and full rosters do not spend image-generation calls", async () => {
  let generated = 0;
  const { service, games } = setup(async () => {
    generated++;
  });
  const add = () =>
    service.add({ guildId: GUILD, userId: USER, displayName: "Bob" });
  await assert.rejects(add, /Create this server/);
  games.set(GUILD, { ...manifest(), characters: [{ id: `discord-${USER}` }] });
  await assert.rejects(add, /already has a character/);
  games.set(GUILD, {
    ...manifest(),
    characters: Array.from({ length: 24 }, (_, id) => ({ id: String(id) })),
  });
  await assert.rejects(add, /24 characters/);
  assert.equal(generated, 0);
});

test("failed generation leaves the roster untouched and releases the server lock", async () => {
  const { service, games, commits } = setup(async () => {
    throw new Error("Provider unavailable");
  });
  games.set(GUILD, manifest());
  await assert.rejects(
    () => service.add({ guildId: GUILD, userId: USER, displayName: "Bob" }),
    /Provider unavailable/,
  );
  assert.deepEqual(games.get(GUILD).characters, []);
  assert.equal(commits.length, 0);
  assert.equal(service.pending.size, 0);
});

test("same-server generation is serialized while other servers can update", async () => {
  let release;
  const generated = new Promise((resolve) => {
    release = resolve;
  });
  const { service, games } = setup(() => generated);
  games.set(GUILD, manifest());
  const pending = service.add({
    guildId: GUILD,
    userId: USER,
    displayName: "Bob",
  });
  await assert.rejects(
    () => service.create({ guildId: GUILD, guildName: "Same" }),
    /already running/,
  );
  await service.create({ guildId: OTHER, guildName: "Other" });
  release(Buffer.from("sprite"));
  await pending;
  assert.equal(games.get(GUILD).characters.length, 1);
});

test("GitHub publishes sprite and roster atomically and retries on a concurrent commit", async () => {
  const calls = [],
    trees = [];
  let head = 0,
    refUpdates = 0;
  const request = async (input, options) => {
    const url = new URL(input),
      path = url.pathname.split("/grapevinerpg")[1];
    const body = options.body && JSON.parse(options.body);
    calls.push({ path, body, authorization: options.headers.Authorization });
    const ok = (value) => Response.json(value);
    if (path.startsWith("/git/ref/"))
      return ok({ object: { sha: `head-${head++}` } });
    if (path.startsWith("/contents/"))
      return ok({
        encoding: "base64",
        content: Buffer.from(
          JSON.stringify({
            ...manifest(),
            characters:
              url.searchParams.get("ref") === "head-0"
                ? []
                : [{ id: "concurrent-character" }],
          }),
        ).toString("base64"),
      });
    if (path.startsWith("/git/commits/") && options.method === "GET")
      return ok({ tree: { sha: "base-tree" } });
    if (path === "/git/blobs") return ok({ sha: "sprite-blob" });
    if (path === "/git/trees") {
      trees.push(body);
      return ok({ sha: "new-tree" });
    }
    if (path === "/git/commits") return ok({ sha: `new-commit-${head}` });
    if (path.startsWith("/git/refs/"))
      return refUpdates++ === 0 ? new Response(null, { status: 422 }) : ok({});
    throw new Error(`Unexpected request: ${path}`);
  };
  const store = new GitHubGameStore({
    repository: "zigzageer/grapevinerpg",
    token: "test-token",
    fetch: request,
  });
  const result = await store.update(
    GUILD,
    (game) => ({
      ...game,
      characters: [...game.characters, { id: "new-character" }],
    }),
    { sprite: { userId: USER, bytes: Buffer.from("png") } },
  );
  assert.equal(result.game.characters.length, 2);
  assert.equal(trees.length, 2);
  assert.equal(trees[1].base_tree, "base-tree");
  assert.equal(trees[1].tree.length, 2);
  assert.equal(trees[1].tree[1].path, `public/games/${GUILD}/${USER}.png`);
  assert.equal(
    JSON.parse(trees[1].tree[0].content).characters[0].id,
    "concurrent-character",
  );
  assert.equal(calls.filter((c) => c.path === "/git/blobs").length, 1);
  assert.ok(calls.every((c) => c.authorization === "Bearer test-token"));
  assert.ok(
    calls
      .filter((c) => c.path.startsWith("/git/refs/"))
      .every((c) => c.body.force === false),
  );
});

function fakeInteraction(
  command,
  {
    permission = true,
    guild = true,
    strings = {},
    usePfp = null,
    image = null,
  } = {},
) {
  const calls = [];
  return {
    calls,
    commandName: "game",
    guildId: guild ? GUILD : null,
    user: { id: USER },
    isChatInputCommand: () => true,
    memberPermissions: { has: () => permission },
    guild: guild
      ? {
          name: "Server",
          members: {
            fetch: async () => ({
              displayName: "Guild Nickname",
              displayAvatarURL: () =>
                "https://cdn.discordapp.com/guild-avatar.png",
            }),
          },
        }
      : null,
    options: {
      getSubcommand: () => command,
      getUser: () => ({ id: USER, username: "username" }),
      getString: (key) => strings[key],
      getBoolean: () => usePfp,
      getAttachment: () => image,
    },
    reply: async (value) => calls.push(["reply", value]),
    deferReply: async (value) => calls.push(["defer", value]),
    editReply: async (value) => calls.push(["edit", value]),
  };
}

test("slash handler acknowledges first and resolves the guild nickname and guild avatar", async () => {
  let input;
  const interaction = fakeInteraction("add", {
    strings: { desc: "A wizard" },
    usePfp: false,
  });
  const handle = createGameCommandHandler({
    service: {
      add: async (value) => {
        assert.equal(interaction.calls[0][0], "defer");
        input = value;
        return {
          character: { name: value.displayName },
          url: "https://example.com",
        };
      },
    },
  });
  assert.equal(await handle(interaction), true);
  assert.equal(input.displayName, "Guild Nickname");
  assert.match(input.avatar, /guild-avatar/);
  assert.equal(input.usePfp, false);
  assert.equal(input.description, "A wizard");
  assert.equal(interaction.calls[0][1].flags, 64);
  assert.deepEqual(interaction.calls[1][1].allowedMentions, { parse: [] });
});

test("DMs and unauthorized users cannot mutate; configured bot owners can", async () => {
  let mutations = 0;
  const service = {
    create: async () => {
      mutations++;
      return { existing: false, url: "url" };
    },
  };
  const handle = createGameCommandHandler({ service });
  await handle(fakeInteraction("create", { guild: false }));
  await handle(fakeInteraction("create", { permission: false }));
  assert.equal(mutations, 0);
  await createGameCommandHandler({ service, allowedUserIds: new Set([USER]) })(
    fakeInteraction("create", { permission: false }),
  );
  assert.equal(mutations, 1);
  assert.deepEqual(
    gameCommand.options
      .find((c) => c.name === "add")
      .options.filter((o) => o.required)
      .map((o) => o.name),
    ["user"],
  );
});

test("reference downloading blocks non-Discord hosts before making a request", async () => {
  for (const url of [
    "http://127.0.0.1/private",
    "https://evil.example/a.png",
    "https://cdn.discordapp.com.evil.example/a.png",
    "https://cdn.discordapp.com:444/a.png",
  ]) {
    await assert.rejects(
      () =>
        downloadReference({ url }, () => {
          throw new Error("must not fetch");
        }),
      /Discord avatar/,
    );
  }
});

async function transparentCharacter() {
  const body = await sharp({
    create: { width: 80, height: 100, channels: 4, background: "red" },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 200, height: 200, channels: 4, background: "#00000000" },
  })
    .composite([{ input: body, left: 60, top: 50 }])
    .png()
    .toBuffer();
}

test("sprite processing crops empty margins, preserves alpha and rejects opaque output", async () => {
  const result = await prepareSprite(await transparentCharacter());
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.width, 80);
  assert.equal(metadata.height, 100);
  const opaque = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => prepareSprite(opaque), /transparent background/);
});

test("character generation uses the existing Codex login and native image prompt", async () => {
  const png = await transparentCharacter();
  let worker;
  const generate = createImageGenerator({
    codexEnv: {
      CODEX_ENABLED: "true",
      CODEX_HOME: "/saved/codex",
      OPENAI_API_KEY: "unused-key",
      CODEX_API_KEY: "unused-code-key",
    },
    fetch: async () => assert.fail("No image provider request should be made"),
    runnerFactory: (options) => {
      worker = options;
      return {
        run: async () => {
          assert.match(options.promptForTask(), /image_gen__imagegen/);
          assert.match(options.promptForTask(), /Blue hat/);
          await writeFile(path.join(options.workdir, "sprite.png"), png);
          return { status: "completed" };
        },
      };
    },
  });
  const result = await generate({
    name: "Bob",
    description: "Blue hat",
    references: [],
  });
  assert.ok(result.length > 0);
  assert.equal(worker.env.CODEX_HOME, "/saved/codex");
  assert.equal("OPENAI_API_KEY" in worker.env, false);
  assert.equal("CODEX_API_KEY" in worker.env, false);
  assert.deepEqual(worker.extraArgs, ["--skip-git-repo-check"]);
  await assert.rejects(() => access(worker.workdir), { code: "ENOENT" });
});

test("avatar and uploaded references become local image attachments for Codex", async () => {
  const png = await transparentCharacter(),
    calls = [];
  const generate = createImageGenerator({
    fetch: async (url) => {
      calls.push(String(url));
      return new Response(png, { headers: { "content-type": "image/png" } });
    },
    runnerFactory: (options) => ({
      run: async () => {
        assert.equal(
          options.extraArgs.filter((arg) => arg === "--image").length,
          2,
        );
        await writeFile(path.join(options.workdir, "sprite.png"), png);
        return { status: "completed" };
      },
    }),
  });
  await generate({
    name: "Bob",
    references: [
      { url: "https://cdn.discordapp.com/avatar.png" },
      { url: "https://cdn.discordapp.com/upload.png" },
    ],
  });
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((url) => url.startsWith("https://cdn.discordapp.com/")),
  );
});

test("failed Codex jobs and absent output are reported without accepting a sprite", async () => {
  for (const status of ["failed", "completed"]) {
    let directory;
    const generate = createImageGenerator({
      runnerFactory: (options) => {
        directory = options.workdir;
        return { run: async () => ({ status }) };
      },
    });
    await assert.rejects(
      () => generate({ name: "Bob", references: [] }),
      /Codex/,
    );
    await assert.rejects(() => access(directory), { code: "ENOENT" });
  }
});

test("a Codex output symlink cannot be read as a character file", async () => {
  const generate = createImageGenerator({
    runnerFactory: (options) => ({
      run: async () => {
        await symlink("/etc/passwd", path.join(options.workdir, "sprite.png"));
        return { status: "completed" };
      },
    }),
  });
  await assert.rejects(
    () => generate({ name: "Bob", references: [] }),
    /usable character PNG/,
  );
});
