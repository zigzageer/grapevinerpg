import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { StudioStore } from "./studio-store.mjs";
import { StudioService } from "./studio-service.mjs";
import { studioGateway } from "./gateway.mjs";
import { canonicalIp, signature, verifyBridge } from "./bridge.mjs";

const base = {
  id: "friend-8",
  name: "Miel",
  kind: "human",
  preset: "miel",
  skin: "#f1ccab",
  hair: "long",
  hairColor: "#704c33",
  shirt: "#b49acb",
  pants: "#34476b",
  hat: "none",
  hatColor: "#f6e9e3",
  glasses: false,
};
const seed = {
  characters: [
    { ...base, id: "you", name: "Mint", kind: "mint", preset: undefined },
    base,
  ],
  descriptions: { miel: "Long brown hair and bunny ears" },
};
const manifest = (guildId, characters = []) => ({
  version: 1,
  guildId,
  name: "Friends",
  slug: `friends-${guildId}`,
  updatedAt: "2026-11-11T00:00:00Z",
  characters,
});
const IP = "203.0.113.25";
const secret = "local-test-secret-not-a-real-credential";
const png = await sharp({
  create: { width: 8, height: 8, channels: 4, background: "#00000000" },
})
  .png()
  .toBuffer();

function setup(t, options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "mint-studio-regression-"));
  const store = new StudioStore({ directory, seed });
  const service = new StudioService({
    store,
    baseUrl: "https://adventures-of-mint.vercel.app",
    generate: async () => png,
    fetch: async () =>
      new Response(png, { headers: { "Content-Type": "image/png" } }),
    ...options,
  });
  t.after(() => {
    service.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, store, service };
}
const input = (extra = {}) => ({
  requestId: randomUUID(),
  gameId: "mint",
  name: "Miel",
  description: "A green scarf",
  useCurrent: true,
  ...extra,
});
async function done(service) {
  for (let attempt = 0; attempt < 200 && service.running; attempt++)
    await delay(5);
  assert.equal(service.running, false, "The queue finished");
}

test("three attempts are atomic, shared across towns and persistent across database reloads", async (t) => {
  const { service, store, directory } = setup(t);
  const requests = Array.from({ length: 4 }, () =>
    service.enqueue(input(), IP),
  );
  const results = await Promise.allSettled(requests);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.equal(
    results.filter((r) => r.status === "rejected" && r.reason.status === 429)
      .length,
    1,
  );
  await done(service);
  assert.equal(service.quota(IP).remaining, 0);
  const second = new StudioStore({ directory });
  assert.equal(second.quota(service.ipHash(IP)).used, 3);
  second.close();
  const guildId = "123456789012345678";
  store.importManifest(guildId, manifest(guildId));
  await assert.rejects(service.enqueue(input({ gameId: guildId }), IP), {
    status: 429,
  });
  assert.equal(service.quota("203.0.113.26").remaining, 3);
});

test("all generations and the original survive previews, regeneration, and restoring history", async (t) => {
  const calls = [];
  const { service, store } = setup(t, {
    generate: async (value) => {
      calls.push(value);
      return png;
    },
  });
  const original = store.history("mint", "friend-8").currentVersionId;
  const versions = [];
  for (let index = 0; index < 3; index++) {
    const job = await service.enqueue(
      input({
        characterId: "friend-8",
        description: `Version ${index}`,
        ...(versions.length ? { referenceVersionId: versions.at(-1) } : {}),
      }),
      IP,
    );
    await done(service);
    const result = store.job(job.id, service.ipHash(IP));
    assert.equal(result.status, "succeeded");
    versions.push(result.result.versionId);
  }
  assert.equal(
    store.read("mint").characters.find((c) => c.id === "friend-8").preset,
    "miel",
  );
  const history = store.history("mint", "friend-8");
  assert.equal(history.versions.length, 4);
  assert.match(
    history.versions.find((v) => v.id === original).image,
    /^\/api\/studio\/assets\//,
  );
  assert.equal(calls[0].references.length, 1);
  assert.deepEqual(store.image(versions[0]), png);
  store.apply("mint", "friend-8", versions[1]);
  assert.ok(store.read("mint").managedIds.includes("friend-8"));
  store.apply("mint", "friend-8", original);
  assert.equal(store.history("mint", "friend-8").currentVersionId, original);
  assert.equal(service.quota(IP).used, 3);
  assert.equal(store.history("mint", "friend-8").versions.length, 4);
});

test("an ability-only generation keeps the selected appearance, and later artwork edits preserve the ability", async (t) => {
  const appearanceCalls = [];
  const abilityCalls = [];
  const move = {
    name: "Moonbeam",
    description: "A crescent of light shoots across the street.",
    style: "projectile",
    bytes: png,
  };
  const { service, store } = setup(t, {
    generate: async (value) => {
      appearanceCalls.push(value);
      return png;
    },
    generateAbility: async (value) => {
      abilityCalls.push(value);
      return move;
    },
  });
  const original = store.history("mint", "friend-8").currentVersionId;
  const appearanceJob = await service.enqueue(
    input({ characterId: "friend-8", name: "Moonlit Miel" }),
    IP,
  );
  await done(service);
  const ipHash = service.ipHash(IP);
  const appearance = store.job(appearanceJob.id, ipHash).result;
  const abilityInput = {
    requestId: randomUUID(),
    gameId: "mint",
    characterId: "friend-8",
    referenceVersionId: appearance.versionId,
    abilityPrompt: "  Throw a crescent of light  ",
    abilityOnly: true,
  };
  const job = await service.enqueue(abilityInput, IP);
  await done(service);
  assert.equal(appearanceCalls.length, 1);
  assert.deepEqual(abilityCalls, [
    { name: "Moonlit Miel", prompt: "Throw a crescent of light" },
  ]);
  const version = store.job(job.id, ipHash).result;
  assert.equal(version.image, appearance.image);
  const { ability, ...character } = version.character;
  assert.deepEqual(character, appearance.character);
  assert.match(ability.art, /^\/api\/studio\/assets\/[a-f0-9-]{36}\.png$/);
  assert.notEqual(ability.art, appearance.image);
  assert.deepEqual(
    store.image(ability.art.split("/").at(-1).slice(0, -4)),
    png,
  );
  assert.equal(store.history("mint", "friend-8").currentVersionId, original);

  store.apply("mint", "friend-8", version.versionId);
  const retry = await service.enqueue(abilityInput, IP);
  assert.equal(retry.id, job.id);
  assert.equal(retry.quota.used, 2);
  const editJob = await service.enqueue(
    input({ characterId: "friend-8", name: "Miel with a cape" }),
    IP,
  );
  await done(service);
  const edit = store.job(editJob.id, ipHash).result;
  assert.deepEqual(edit.character.ability, ability);
  assert.deepEqual(appearanceCalls[1].references[0].bytes, png);
  assert.equal(service.quota(IP).used, 3);

  store.apply("mint", "friend-8", appearance.versionId);
  assert.equal(
    JSON.parse(store.character("mint", "friend-8").data).ability,
    undefined,
  );
  store.apply("mint", "friend-8", version.versionId);
  assert.deepEqual(
    JSON.parse(store.character("mint", "friend-8").data).ability,
    ability,
  );
});

test("appearance and ability generation share one attempt, and malformed ability requests are free", async (t) => {
  const { service, store } = setup(t, {
    generateAbility: async () => ({
      name: "Paper Pounce",
      description: "Leaps through a cloud of paper scraps.",
      style: "rush",
      bytes: png,
    }),
  });
  for (const extra of [
    { abilityOnly: true, abilityPrompt: "An effect without a character" },
    { abilityOnly: true, characterId: "friend-8", abilityPrompt: "   " },
    { abilityPrompt: "x".repeat(501) },
    { abilityPrompt: { name: "invalid" } },
  ]) {
    await assert.rejects(service.enqueue(input(extra), IP), { status: 400 });
  }
  assert.equal(service.quota(IP).used, 0);
  const job = await service.enqueue(
    input({ name: "A new fighter", abilityPrompt: "Leap with paper scraps" }),
    IP,
  );
  await done(service);
  const result = store.job(job.id, service.ipHash(IP)).result;
  assert.equal(result.character.ability.name, "Paper Pounce");
  assert.equal(result.character.sprite, result.image);
  assert.notEqual(result.character.ability.art, result.image);
  assert.equal(service.quota(IP).used, 1);

  const original = store.history("mint", "you").versions[0];
  const abilityOnly = await service.enqueue(
    input({
      characterId: "you",
      abilityPrompt: "Leap with paper scraps",
      abilityOnly: true,
    }),
    IP,
  );
  await done(service);
  const mint = store.job(abilityOnly.id, service.ipHash(IP)).result;
  assert.equal(mint.character.name, original.character.name);
  assert.equal(mint.character.sprite, original.character.sprite);
  assert.deepEqual(
    store.history("mint", "you").versions.find((v) => v.id === original.id)
      .character,
    original.character,
  );
  assert.equal(service.quota(IP).used, 2);
});

test("an uploaded reference and appearance edits reach generation while use-current=false is honored", async (t) => {
  let generated;
  const { service, store } = setup(t, {
    generate: async (value) => {
      generated = value;
      return png;
    },
  });
  const job = await service.enqueue(
    input({
      characterId: "friend-8",
      useCurrent: false,
      name: "Miel in green",
      description: "A green coat",
      image: { type: "image/png", base64: png.toString("base64") },
    }),
    IP,
  );
  await done(service);
  assert.equal(generated.name, "Miel in green");
  assert.equal(generated.description, "A green coat");
  assert.equal(generated.references.length, 1);
  assert.deepEqual(generated.references[0].bytes, png);
  // Retrying the identical completed request never spends another attempt, even
  // after the original upload is removed from the private job payload.
  const again = await service.enqueue(
    input({
      requestId: job.id,
      characterId: "friend-8",
      useCurrent: false,
      name: "Miel in green",
      description: "A green coat",
      image: { type: "image/png", base64: png.toString("base64") },
    }),
    IP,
  );
  assert.equal(again.id, job.id);
  assert.equal(service.quota(IP).used, 1);
  assert.equal(store.history("mint", "friend-8").versions.length, 2);
});

test("invalid requests and overlapping edits are rejected before consuming more quota", async (t) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const { service } = setup(t, { generate: () => pending });
  await assert.rejects(
    service.enqueue(
      input({ image: { type: "text/plain", base64: "bad" } }),
      IP,
    ),
  );
  await assert.rejects(service.enqueue(input({ characterId: "missing" }), IP), {
    status: 404,
  });
  assert.equal(service.quota(IP).used, 0);
  await service.enqueue(input({ characterId: "friend-8" }), IP);
  await assert.rejects(
    service.enqueue(input({ characterId: "friend-8" }), IP),
    { status: 409 },
  );
  assert.equal(service.quota(IP).used, 1);
  release(png);
  await done(service);
});

test("a failed generation preserves the active character and charges the accepted attempt", async (t) => {
  const { service, store } = setup(t, {
    generate: async () => {
      throw new Error("Test generator failure");
    },
  });
  const original = store.history("mint", "friend-8").currentVersionId;
  const job = await service.enqueue(input({ characterId: "friend-8" }), IP);
  await done(service);
  assert.equal(store.job(job.id, service.ipHash(IP)).status, "failed");
  assert.equal(store.history("mint", "friend-8").currentVersionId, original);
  assert.equal(store.history("mint", "friend-8").versions.length, 1);
  assert.equal(service.quota(IP).used, 1);
});

test("new characters remain saved drafts until applied and are isolated between servers", async (t) => {
  const { service, store } = setup(t);
  const guildId = "123456789012345678";
  store.importManifest(guildId, manifest(guildId));
  const job = await service.enqueue(
    input({ gameId: guildId, name: "Bob" }),
    IP,
  );
  await done(service);
  assert.equal(store.read(guildId).characters.length, 0);
  assert.equal(store.drafts(guildId, service.ipHash(IP)).length, 1);
  const result = store.job(job.id, service.ipHash(IP)).result;
  assert.throws(() => store.apply("mint", job.characterId, result.versionId), {
    status: 404,
  });
  assert.throws(() => store.job(job.id, service.ipHash("203.0.113.27")), {
    status: 404,
  });
  store.apply(guildId, job.characterId, result.versionId);
  assert.equal(store.read(guildId).characters[0].name, "Bob");
  assert.equal(store.read("mint").characters.length, 2);
});

test("website towns read published manifests and preserve website versions during bot updates", async (t) => {
  const guildId = "123456789012345678";
  const userId = "223456789012345678";
  let published = manifest(guildId, [
    {
      ...base,
      id: `discord-${userId}`,
      name: "Server Bob",
      preset: undefined,
      sprite: `/games/${guildId}/${userId}.png`,
    },
  ]);
  const requests = [];
  const { service, store } = setup(t, {
    fetch: async (url, options) => {
      requests.push({
        path: new URL(url).pathname,
        method: options?.method || "GET",
      });
      return new URL(url).pathname.endsWith("game.json")
        ? Response.json(published)
        : new Response(png);
    },
  });
  const first = await service.loadGame(guildId);
  assert.equal(first.characters[0].name, "Server Bob");
  assert.equal((await service.loadGame(guildId)).updatedAt, first.updatedAt);
  const job = await service.enqueue(
    input({
      gameId: guildId,
      characterId: `discord-${userId}`,
      name: "Website Bob",
      useCurrent: false,
    }),
    IP,
  );
  await done(service);
  const version = store.job(job.id, service.ipHash(IP)).result.versionId;
  store.apply(guildId, job.characterId, version);
  const secondUser = "323456789012345678";
  published = {
    ...published,
    characters: [
      ...published.characters,
      {
        ...base,
        id: `discord-${secondUser}`,
        name: "New member",
        preset: undefined,
        sprite: `/games/${guildId}/${secondUser}.png`,
      },
    ],
  };
  const refreshed = await service.loadGame(guildId);
  assert.deepEqual(
    refreshed.characters.map((c) => c.name),
    ["Website Bob", "New member"],
  );
  assert.equal(store.history(guildId, job.characterId).versions.length, 2);
  assert.ok(requests.every((request) => request.method === "GET"));
  assert.equal(service.quota(IP).used, 1);
});

test("all nine built-ins join a full pre-upgrade Mint roster without replacing custom characters or history", async (t) => {
  const { service, store, directory } = setup(t);
  const oldBuiltins = [
    ...seed.characters,
    ...Array.from({ length: 14 }, (_, index) => ({
      ...base,
      id: `old-cast-${index}`,
      name: `Original fighter ${index + 1}`,
      preset: undefined,
    })),
  ];
  const custom = Array.from({ length: 8 }, (_, index) => ({
    ...base,
    id: `web-${randomUUID()}`,
    name: `Custom fighter ${index + 1}`,
    preset: undefined,
  }));
  store.update("mint", (game) => ({
    ...game,
    characters: [...oldBuiltins, ...custom],
  }));
  assert.equal(store.read("mint").characters.length, 24);
  const savedCustom = store
    .read("mint")
    .characters.filter((c) => c.id.startsWith("web-"));
  const job = await service.enqueue(
    input({ characterId: "friend-8", name: "Custom Miel" }),
    IP,
  );
  await done(service);
  const version = store.job(job.id, service.ipHash(IP)).result.versionId;
  store.apply("mint", "friend-8", version);
  const history = store.history("mint", "friend-8");
  const additions = [
    {
      ...base,
      id: "cast-steakbutterfan",
      name: "steakbutterfan",
      preset: "steakbutterfan",
    },
    {
      ...base,
      id: "cast-blindian",
      name: "blindian",
      preset: "blindian",
      heightScale: 1.45,
    },
    ...Array.from({ length: 7 }, (_, index) => ({
      ...base,
      id: `new-cast-${index}`,
      name: `New fighter ${index + 1}`,
      preset: undefined,
    })),
  ];
  const updatedSeed = {
    ...seed,
    characters: [...oldBuiltins, ...additions],
    descriptions: {
      ...seed.descriptions,
      steakbutterfan: "An oversized burger",
      blindian: "Very tall, with a split outfit",
    },
  };
  for (let restart = 0; restart < 2; restart++) {
    const reopened = new StudioStore({ directory, seed: updatedSeed });
    try {
      const roster = reopened.read("mint").characters;
      assert.equal(roster.length, 33);
      assert.deepEqual(
        roster.filter((c) => c.id.startsWith("web-")),
        savedCustom,
      );
      assert.ok(additions.every(({ id }) => roster.some((c) => c.id === id)));
      assert.equal(roster.find((c) => c.id === "friend-8").name, "Custom Miel");
      assert.deepEqual(reopened.history("mint", "friend-8"), history);
      assert.equal(reopened.quota(service.ipHash(IP)).used, 1);
      assert.equal(
        reopened.history("mint", "cast-blindian").versions.length,
        1,
      );
      assert.equal(
        reopened.history("mint", "cast-blindian").versions[0].description,
        updatedSeed.descriptions.blindian,
      );
      assert.equal(
        reopened.read("mint").characters.find((c) => c.id === "cast-blindian")
          .heightScale,
        1.45,
      );
    } finally {
      reopened.close();
    }
  }
});

test("Mint drafts can publish up to 40 characters and server towns are capped at 24", async (t) => {
  const { service, store } = setup(t);
  const waiting = await service.enqueue(input({ name: "Waiting" }), IP);
  await done(service);
  store.update("mint", (game) => ({
    ...game,
    characters: [
      ...game.characters,
      ...Array.from({ length: 39 - game.characters.length }, (_, index) => ({
        ...base,
        id: `extra-${index}`,
      })),
    ],
  }));
  const final = await service.enqueue(input({ name: "Final slot" }), IP);
  await done(service);
  const roster = store.apply("mint", final.characterId, final.id);
  assert.equal(roster.characters.length, 40);
  await assert.rejects(service.enqueue(input(), IP), {
    status: 409,
    message: /40 characters/,
  });
  assert.throws(() => store.apply("mint", waiting.characterId, waiting.id), {
    status: 409,
    message: /40 characters/,
  });

  const guildId = "123456789012345678";
  const guildIp = "203.0.113.26";
  store.importManifest(guildId, manifest(guildId));
  const serverDraft = await service.enqueue(
    input({ gameId: guildId }),
    guildIp,
  );
  await done(service);
  const serverCharacters = Array.from({ length: 25 }, (_, index) => {
    const userId = String(223456789012345678n + BigInt(index));
    return {
      ...base,
      id: `discord-${userId}`,
      sprite: `/games/${guildId}/${userId}.png`,
    };
  });
  assert.throws(
    () => store.importManifest(guildId, manifest(guildId, serverCharacters)),
    {
      status: 400,
    },
  );
  store.importManifest(
    guildId,
    manifest(guildId, serverCharacters.slice(0, 24)),
  );
  await assert.rejects(service.enqueue(input({ gameId: guildId }), guildIp), {
    status: 409,
    message: /24 characters/,
  });
  assert.throws(
    () => store.apply(guildId, serverDraft.characterId, serverDraft.id),
    {
      status: 409,
      message: /24 characters/,
    },
  );
});

test("bridge signatures bind method, path, client IP, timestamp and body", () => {
  const timestamp = String(Date.now());
  const body = Buffer.from('{"name":"Bob"}');
  const args = {
    secret,
    method: "POST",
    path: "/generations",
    ip: IP,
    timestamp,
    body,
  };
  const headers = {
    "x-mint-ip": IP,
    "x-mint-time": timestamp,
    "x-mint-signature": signature(args),
  };
  assert.equal(verifyBridge({ ...args, headers }), IP);
  assert.equal(
    verifyBridge({ ...args, headers, body: Buffer.from("changed") }),
    null,
  );
  assert.equal(
    verifyBridge({ ...args, headers, path: "/internal/create" }),
    null,
  );
  assert.equal(
    verifyBridge({ ...args, headers, time: Number(timestamp) + 120_000 }),
    null,
  );
  assert.equal(canonicalIp("::ffff:203.0.113.25"), IP);
  assert.equal(canonicalIp("2001:0db8:0:0::1"), canonicalIp("2001:db8::1"));
});

test("Vercel gateway forwards its trusted IP and blocks internal routes and cross-origin writes", async () => {
  const env = {
    MINT_STUDIO_ORIGIN: "https://studio.example",
    VERCEL_OIDC_TOKEN: "unit-test-project-identity",
    MINT_STUDIO_CA: "test CA",
  };
  let calls = 0;
  const transport = async (args) => {
    calls++;
    assert.equal(args.ip, IP);
    assert.equal(args.path, "/quota");
    return {
      status: 200,
      type: "application/json",
      bytes: Buffer.from('{"remaining":3}'),
    };
  };
  const response = await studioGateway(
    new Request("https://game.example/api/studio/quota", {
      headers: {
        "x-vercel-forwarded-for": IP,
        "x-mint-ip": "192.0.2.1",
        "x-forwarded-for": "192.0.2.2",
      },
    }),
    { env, transport },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).remaining, 3);
  assert.equal(
    (
      await studioGateway(
        new Request("https://game.example/api/studio/internal/create"),
        { env, transport },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await studioGateway(
        new Request("https://game.example/api/studio/generations", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
        { env, transport },
      )
    ).status,
    403,
  );
  assert.equal(calls, 1);
});

test("Vercel identity verification accepts only the configured production project", async () => {
  const { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } =
    await import("jose");
  const { createVercelVerifier } = await import("./vercel-auth.mjs");
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = await exportJWK(publicKey);
  key.kid = "test-key";
  key.alg = "RS256";
  const verify = createVercelVerifier({
    teamSlug: "test-team",
    teamId: "team_test",
    projectName: "mint",
    projectId: "prj_test",
    jwks: createLocalJWKSet({ keys: [key] }),
  });
  const token = async (
    fields = {},
    subject = "owner:test-team:project:mint:environment:production",
  ) =>
    new SignJWT({
      owner_id: "team_test",
      project_id: "prj_test",
      environment: "production",
      ...fields,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://oidc.vercel.com/test-team")
      .setAudience("https://vercel.com/test-team")
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  assert.equal(await verify(await token()), true);
  assert.equal(
    await verify(await token({ project_id: "other-project" })),
    false,
  );
  assert.equal(await verify(await token({ environment: "preview" })), false);
  assert.equal(
    await verify(
      await token({}, "owner:test-team:project:other:environment:production"),
    ),
    false,
  );
  assert.equal(await verify("invalid.token.data"), false);
});

test("gateway supports Vercel catch-all query routing while preserving its public route boundary", async () => {
  const env = {
    MINT_STUDIO_ORIGIN: "https://studio.example",
    MINT_STUDIO_CA: "test certificate",
    VERCEL_OIDC_TOKEN: "test-project-identity",
  };
  let forwarded;
  const transport = async (args) => {
    forwarded = args.path;
    return {
      status: 200,
      type: "application/json",
      bytes: Buffer.from('{"ok":true}'),
    };
  };
  const headers = { "x-vercel-forwarded-for": IP };
  const response = await studioGateway(
    new Request("https://game.example/api/studio/[...route]?route=health", {
      headers,
    }),
    { env, transport },
  );
  assert.equal(response.status, 200);
  assert.equal(forwarded, "/health");
  assert.equal(
    (
      await studioGateway(
        new Request(
          "https://game.example/api/studio/[...route]?route=internal/create",
          { headers },
        ),
        { env, transport },
      )
    ).status,
    404,
  );
});

test("public studio routes tolerate framework query metadata", async () => {
  const env = {
    MINT_STUDIO_ORIGIN: "https://studio.example",
    MINT_STUDIO_CA: "test certificate",
    VERCEL_OIDC_TOKEN: "test identity",
  };
  const response = await studioGateway(
    new Request(
      "https://game.example/api/studio/health?__framework_path=health",
      { headers: { "x-vercel-forwarded-for": IP } },
    ),
    {
      env,
      transport: async () => ({
        status: 200,
        type: "application/json",
        bytes: Buffer.from('{"ok":true}'),
      }),
    },
  );
  assert.equal(response.status, 200);
});
