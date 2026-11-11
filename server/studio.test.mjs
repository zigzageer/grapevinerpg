import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { StudioStore } from "./studio-store.mjs";
import { StudioService } from "./studio-service.mjs";
import { studioGateway } from "./gateway.mjs";
import { canonicalIp, signature, verifyBridge } from "../bot/studio-bridge.mjs";

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
const IP = "203.0.113.25";
const secret = "local-test-secret-not-a-real-credential";
const png = await sharp({
  create: { width: 8, height: 8, channels: 4, background: "#00000000" },
})
  .png()
  .toBuffer();

function setup(t, options = {}) {
  const directory = mkdtempSync("/tmp/mint-studio-regression-");
  const store = new StudioStore({ directory, seed });
  const service = new StudioService({
    store,
    secret,
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
  await service.discord.create({ guildId, guildName: "A server" });
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
  await service.discord.create({ guildId, guildName: "Friends" });
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

test("Discord create/add use the same roster, native generator inputs and generation history", async (t) => {
  const { service, store } = setup(t);
  const guildId = "123456789012345678",
    userId = "223456789012345678";
  const created = await service.discord.create({
    guildId,
    guildName: "Friends",
  });
  assert.equal(created.game.characters.length, 0);
  const job = await service.enqueueDiscord({
    guildId,
    userId,
    displayName: "Server Bob",
    usePfp: false,
    description: "A blue coat",
  });
  await done(service);
  const result = store.job(job.id, null, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.result.character.name, "Server Bob");
  const character = store.read(guildId).characters[0];
  assert.match(character.sprite, /^\/api\/studio\/assets\//);
  assert.equal(result.result.character.sprite, character.sprite);
  assert.equal(
    store.history(guildId, `discord-${userId}`).versions[0].description,
    "A blue coat",
  );
  assert.equal(service.quota(IP).used, 0);
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
