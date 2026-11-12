import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { signature } from "./bridge.mjs";
import { createFightGifRenderer, FightGifQueue } from "./fight-gif-queue.mjs";
import { createStudioServer } from "./studio-http.mjs";

const fixtureGif = Buffer.from("GIF89a\x01\0\x01\0\x80\0\0;", "binary");

test("the GIF queue deduplicates polling and bounds concurrent rendering", async (t) => {
  const renders = [];
  const queue = new FightGifQueue({
    maxWaiting: 1,
    render: (match, signal) =>
      new Promise((resolve, reject) => {
        renders.push({ id: match.id, resolve });
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  t.after(() => queue.close());
  assert.deepEqual(queue.request({ id: "a" }), { status: "queued" });
  assert.deepEqual(queue.request({ id: "a" }), { status: "queued" });
  assert.deepEqual(queue.request({ id: "b" }), { status: "queued" });
  assert.deepEqual(queue.request({ id: "c" }), { status: "unavailable" });
  assert.deepEqual(
    renders.map(({ id }) => id),
    ["a"],
  );

  renders[0].resolve(fixtureGif);
  await queue.running;
  assert.deepEqual(
    renders.map(({ id }) => id),
    ["a", "b"],
  );
  assert.deepEqual(queue.request({ id: "a" }), {
    status: "ready",
    bytes: fixtureGif,
  });
  renders[1].resolve(fixtureGif);
  await queue.running;
  assert.equal(queue.request({ id: "b" }).status, "ready");
});

test("the GIF renderer uses only trusted asset paths and reuses duplicate artwork", async () => {
  const studioAsset = "2df32d56-20d4-45b4-9d8e-50ea7df937c2";
  const fetched = [];
  const loaded = [];
  const makeGif = createFightGifRenderer({
    baseUrl: "https://game.example",
    fetch: async (url, options) => {
      fetched.push(url.href);
      assert.equal(options.redirect, "error");
      return new Response("arena", {
        headers: { "Content-Type": "image/webp" },
      });
    },
    readStudioImage: (id) => {
      loaded.push(id);
      return Buffer.from("studio art");
    },
    render: ({ background, sprites, effects }) => {
      assert.equal(background.toString(), "arena");
      assert.equal(sprites.first.toString(), "studio art");
      assert.equal(sprites.second, undefined);
      assert.equal(effects.second, sprites.first);
      return fixtureGif;
    },
  });
  const studioUrl = `/api/studio/assets/${studioAsset}.png`;
  const match = {
    sides: [
      { players: [{ id: "first", sprite: studioUrl }] },
      {
        players: [
          {
            id: "second",
            sprite: "https://other.example/avatar.png",
            abilityArt: studioUrl,
          },
        ],
      },
    ],
  };
  assert.equal(await makeGif(match, new AbortController().signal), fixtureGif);
  assert.deepEqual(loaded, [studioAsset]);
  assert.deepEqual(fetched, [
    "https://game.example/abilities/duel-street.webp",
  ]);
});

test("only signed bot requests can queue or fetch a fight GIF", async () => {
  const secret = "match-fixture";
  const path = "/internal/v1/fights/8ad5ab71-a3cd-40be-907a-8bc02b443145/gif";
  let requests = 0;
  const server = createStudioServer({
    matchBotSecret: secret,
    matches: { getAutoFight: (id) => ({ match: { id } }) },
    fightGifs: {
      request: () =>
        ++requests === 1
          ? { status: "queued" }
          : { status: "ready", bytes: fixtureGif },
    },
  });
  const get = (headers = {}) =>
    new Promise((resolve) => {
      const request = Object.assign(Readable.from([]), {
        method: "GET",
        url: path,
        headers,
      });
      const response = {
        setHeader() {},
        writeHead(status, headers) {
          this.status = status;
          this.headers = headers;
          this.headersSent = true;
        },
        end(body) {
          resolve({ status: this.status, headers: this.headers, body });
        },
      };
      server.emit("request", request, response);
    });
  const anonymous = await get();
  assert.equal(anonymous.status, 401);
  assert.equal(requests, 0);

  const timestamp = String(Date.now());
  const ip = "127.0.0.1";
  const headers = {
    "x-mint-ip": ip,
    "x-mint-time": timestamp,
    "x-mint-signature": signature({
      secret,
      method: "GET",
      path,
      ip,
      timestamp,
      body: Buffer.alloc(0),
    }),
  };
  const queued = await get(headers);
  assert.equal(queued.status, 202);
  assert.deepEqual(JSON.parse(queued.body), { status: "queued" });
  const finished = await get(headers);
  assert.equal(finished.status, 200);
  assert.equal(finished.headers["Content-Type"], "image/gif");
  assert.deepEqual(finished.body, fixtureGif);
});
