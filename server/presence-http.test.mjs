import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { PRESENCE_BODY_LIMIT } from "./bridge.mjs";
import { studioGateway } from "./gateway.mjs";
import { Presence } from "./presence.mjs";
import { createStudioServer } from "./studio-http.mjs";

const browserOrigin = "https://thesharty.online";
const studioToken = "production-project-test-identity";
const env = {
  MINT_STUDIO_ORIGIN: "https://studio.example",
  MINT_STUDIO_CA: "test CA",
  VERCEL_OIDC_TOKEN: studioToken,
};
const basePose = {
  worldId: "grapevine",
  characterId: "you",
  x: 851,
  y: 592,
  facing: 1,
  moving: true,
  seq: 1,
};

function connectStudio(presence) {
  const server = createStudioServer({
    presence,
    verifyVercel: async (token) => token === studioToken,
  });
  return ({ method, path, body, headers }) =>
    new Promise((resolve) => {
      const request = Object.assign(Readable.from([body]), {
        method,
        url: path,
        headers,
      });
      const response = {
        headers: {},
        setHeader(name, value) {
          this.headers[name] = value;
        },
        writeHead(status, headers) {
          this.status = status;
          Object.assign(this.headers, headers);
          this.headersSent = true;
        },
        end(body) {
          resolve({
            status: this.status,
            type: this.headers["Content-Type"],
            bytes: Buffer.from(body),
          });
        },
      };
      server.emit("request", request, response);
    });
}

test("same-origin updates reach shared town presence through the authenticated gateway", async () => {
  const send = connectStudio(new Presence());
  const post = async (pose, path = "/api/studio/presence") => {
    const reply = await studioGateway(
      new Request(browserOrigin + path, {
        method: "POST",
        headers: {
          origin: browserOrigin,
          "content-type": "application/json",
          "x-vercel-forwarded-for": "203.0.113.1",
        },
        body: JSON.stringify(pose),
      }),
      {
        env,
        transport: ({ method, path, body, token, ip, timeoutMs }) => {
          assert.equal(path, "/presence");
          assert.equal(timeoutMs, 4000);
          return send({
            method,
            path,
            body,
            headers: {
              authorization: `Bearer ${token}`,
              "x-mint-ip": ip,
              "content-length": String(body.length),
            },
          });
        },
      },
    );
    assert.equal(reply.status, 200);
    assert.equal(reply.headers.get("cache-control"), "no-store");
    return reply.json();
  };

  const first = {
    ...basePose,
    sessionToken: "08fb8e8e-ce55-47a2-bba3-00b0f1a43687",
  };
  const second = {
    ...basePose,
    sessionToken: "4f318cc0-3958-4afa-99e0-a86dd55e17f2",
  };
  assert.deepEqual(await post(first), { players: [] });
  const snapshot = await post(second, "/api/studio?route=presence");
  assert.equal(snapshot.players.length, 1);
  assert.equal(snapshot.players[0].x, first.x);
  assert.equal(snapshot.players[0].characterId, first.characterId);
  assert.match(snapshot.players[0].sessionId, /^[0-9a-f]{32}$/);
  assert.equal(JSON.stringify(snapshot).includes(first.sessionToken), false);

  await post({ ...first, x: first.x + 40, seq: 2 });
  const moved = await post({ ...second, seq: 2 });
  assert.equal(moved.players[0].x, first.x + 40);
  assert.equal(moved.players[0].sessionId, snapshot.players[0].sessionId);
  assert.deepEqual(await post({ ...second, worldId: "mint", seq: 3 }), {
    players: [],
  });
});

test("movement cannot bypass the gateway origin, authentication, or request size checks", async () => {
  const transport = () => assert.fail("Invalid update reached the studio");
  const post = (origin, body) =>
    studioGateway(
      new Request(`${browserOrigin}/api/studio/presence`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "x-vercel-forwarded-for": "203.0.113.2",
        },
        body,
      }),
      { env, transport },
    );
  assert.equal((await post("https://other.example", "{}")).status, 403);
  assert.equal(
    (await post(browserOrigin, "x".repeat(PRESENCE_BODY_LIMIT + 1))).status,
    413,
  );
  assert.equal(
    (
      await studioGateway(new Request(`${browserOrigin}/api/studio/presence`), {
        env,
        transport,
      })
    ).status,
    404,
  );

  const send = connectStudio({ update: transport });
  const request = {
    method: "POST",
    path: "/presence",
    body: Buffer.from("{}"),
    headers: {},
  };
  assert.equal((await send(request)).status, 401);
  const large = Buffer.from("x".repeat(PRESENCE_BODY_LIMIT + 1));
  assert.equal((await send({ ...request, body: large })).status, 413);
  assert.equal(
    (
      await send({
        ...request,
        body: large,
        headers: { "content-length": String(large.length) },
      })
    ).status,
    413,
  );
});
