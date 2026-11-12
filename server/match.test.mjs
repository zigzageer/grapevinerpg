import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { MatchService } from "./match-service.mjs";
import { simulateWar } from "./match-combat.mjs";
import { createStudioServer } from "./studio-http.mjs";
import { signature } from "./bridge.mjs";
import { studioGateway } from "./gateway.mjs";

const A = "123456789012345678";
const B = "223456789012345678";
const FIRST = "323456789012345678";
const SECOND = "423456789012345678";
const BOTH = "523456789012345678";
const baseUrl = "https://game.example";

function setup(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "grapevine-matches-"));
  let now = 1794441600000;
  let next = 600000000000000001n;
  const loadGame = async (guildId) => ({
    guildId,
    name: guildId === A ? "Grapevine" : "Signal Yard",
    characters: [FIRST, SECOND, BOTH].map((userId, i) => ({
      id: `discord-${userId}`,
      name: ["Miel", "Mint", "Zippy"][i],
      sprite: `/games/${guildId}/${userId}.png`,
      ...(i === 0 ? { ability: { name: "Moonbeam" } } : {}),
    })),
  });
  const open = () =>
    new MatchService({
      directory,
      loadGame,
      baseUrl,
      now: () => now,
      seed: () => 8294621,
    });
  let matches = open();
  t.after(() => {
    matches.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const request = (guildId, userId, details = {}) => ({
    requestId: String(next++),
    guildId,
    userId,
    ...details,
  });
  const link = (guildId, userId) =>
    matches.link(
      request(guildId, userId, { characterId: `discord-${userId}` }),
    );
  return {
    get matches() {
      return matches;
    },
    get now() {
      return now;
    },
    advance(ms) {
      now += ms;
    },
    reopen() {
      matches.close();
      matches = open();
    },
    request,
    link,
  };
}

test("a war starts its deadline at acceptance and resolves once after restart", async (t) => {
  const h = setup(t);
  await Promise.all([
    h.link(A, FIRST),
    h.link(A, BOTH),
    h.link(B, SECOND),
    h.link(B, BOTH),
  ]);
  const offer = h.request(A, FIRST, {
    kind: "war",
    opponentGuildId: B,
    minPlayersPerSide: 1,
    manageGuild: true,
  });
  const created = await h.matches.challenge(offer);
  assert.equal(created.status, "offered");
  assert.equal(created.joinUntil, null);
  assert.equal((await h.matches.challenge(offer)).id, created.id);
  await assert.rejects(
    h.matches.challenge({ ...offer, minPlayersPerSide: 2 }),
    { status: 409 },
  );
  await assert.rejects(
    h.matches.act(
      created.id,
      h.request(A, FIRST, { action: "accept", manageGuild: true }),
    ),
    { status: 403 },
  );
  h.advance(1000);
  const accepted = await h.matches.act(
    created.id,
    h.request(B, SECOND, { action: "accept", manageGuild: true }),
  );
  assert.equal(accepted.joinUntil, h.now + 120_000);
  const firstJoin = h.request(A, FIRST, { action: "join" });
  await h.matches.act(created.id, firstJoin);
  assert.equal(
    (await h.matches.act(created.id, firstJoin)).sides[0].players.length,
    1,
  );
  await h.matches.act(created.id, h.request(A, BOTH, { action: "join" }));
  await assert.rejects(
    h.matches.act(created.id, h.request(B, BOTH, { action: "join" })),
    { status: 409 },
  );
  await h.matches.act(created.id, h.request(B, SECOND, { action: "join" }));
  h.reopen();
  h.advance(119_999);
  assert.equal(h.matches.getMatch(created.id).status, "signup");
  h.advance(1);
  h.matches.sweep();
  const result = h.matches.getMatch(created.id);
  assert.equal(result.status, "finished");
  assert.ok([0, 1].includes(result.winnerSide));
  assert.equal(result.replayUrl, `${baseUrl}/wars/${created.id}`);
  assert.ok(result.events.length >= 1);
  assert.equal(result.sides[0].players[0].userId, undefined);
  assert.equal(result.rng, undefined);
  assert.deepEqual(h.matches.getMatch(created.id), result);
  await assert.rejects(
    h.matches.act(created.id, h.request(B, SECOND, { action: "join" })),
    { status: 409 },
  );
});

test("underfilled wars cancel and only the opponent can accept a duel", async (t) => {
  const h = setup(t);
  const war = await h.matches.challenge(
    h.request(A, FIRST, {
      kind: "war",
      opponentGuildId: B,
      manageGuild: true,
    }),
  );
  await h.matches.act(
    war.id,
    h.request(B, SECOND, { action: "accept", manageGuild: true }),
  );
  h.advance(120_000);
  assert.equal(h.matches.getMatch(war.id).reason, "not-enough-players");
  await assert.rejects(
    h.matches.link(
      h.request(A, FIRST, {
        characterId: `discord-${SECOND}`,
      }),
    ),
    { status: 403 },
  );
  await h.link(A, FIRST);
  await h.link(A, SECOND);
  const duel = await h.matches.challenge(
    h.request(A, FIRST, { kind: "duel", opponentUserId: SECOND }),
  );
  await assert.rejects(
    h.matches.act(duel.id, h.request(A, FIRST, { action: "accept" })),
    { status: 403 },
  );
  let snapshot = await h.matches.act(
    duel.id,
    h.request(A, SECOND, { action: "accept" }),
  );
  const actor = () =>
    snapshot.sides[0].players[0].id === snapshot.turnFighterId ? FIRST : SECOND;
  const firstActor = actor();
  const power = h.request(A, firstActor, { action: "ability" });
  snapshot = await h.matches.act(duel.id, power);
  assert.equal(snapshot.events[0].kind, "ability");
  assert.equal((await h.matches.act(duel.id, power)).events.length, 1);
  snapshot = await h.matches.act(
    duel.id,
    h.request(A, actor(), { action: "attack" }),
  );
  await assert.rejects(
    h.matches.act(duel.id, h.request(A, firstActor, { action: "ability" })),
    { status: 409 },
  );
  for (let move = 0; move < 20 && snapshot.status === "running"; move++)
    snapshot = await h.matches.act(
      duel.id,
      h.request(A, actor(), { action: "attack" }),
    );
  assert.equal(snapshot.status, "finished");
  assert.equal(snapshot.events.at(-1).targetHp, 0);
});

test("larger war teams win more often while smaller teams can win", () => {
  const wins = [0, 0];
  for (let run = 0; run < 500; run++) {
    const match = {
      rng: Math.imul(run, 0x9e3779b9) >>> 0,
      sides: [3, 2].map((size, side) => ({
        players: Array.from({ length: size }, (_, i) => ({
          id: `${side}:${i}`,
          hp: 100,
          ability: "Power Strike",
        })),
      })),
      events: [],
    };
    simulateWar(match);
    wins[match.winnerSide]++;
  }
  assert.ok(wins[0] > wins[1] && wins[1] > 0, JSON.stringify(wins));
});

test("the match bridge accepts its dedicated signature and keeps writes off the public gateway", async (t) => {
  const h = setup(t);
  const studioSecret = "fixture-studio-secret";
  const matchBotSecret = "fixture-match-secret";
  const server = createStudioServer({
    service: {},
    secret: studioSecret,
    matches: h.matches,
    matchBotSecret,
    verifyVercel: async () => true,
  });
  const handle = server.listeners("request")[0];
  const route = "/internal/v1/links";
  const body = Buffer.from(
    JSON.stringify(h.request(A, FIRST, { characterId: `discord-${FIRST}` })),
  );
  const ip = "127.0.0.1";
  const timestamp = String(Date.now());
  async function send(secret, requestPath = route) {
    const headers = {
      "x-mint-ip": ip,
      "x-mint-time": timestamp,
      ...(secret
        ? {
            "x-mint-signature": signature({
              secret,
              method: "POST",
              path: requestPath,
              ip,
              timestamp,
              body,
            }),
          }
        : { authorization: "Bearer fixture-token" }),
    };
    const request = Object.assign(Readable.from([body]), {
      url: requestPath,
      method: "POST",
      headers,
    });
    let status;
    let response;
    await handle(request, {
      setHeader() {},
      writeHead(code) {
        status = code;
      },
      end(json) {
        response = JSON.parse(json);
      },
    });
    return { status, response };
  }
  assert.equal((await send(studioSecret)).status, 401);
  assert.equal((await send(null, "/a/../internal/v1/links")).status, 401);
  assert.deepEqual(await send(matchBotSecret), {
    status: 200,
    response: { guildId: A, userId: FIRST, characterId: `discord-${FIRST}` },
  });
  const blocked = await studioGateway(
    new Request(`${baseUrl}/api/studio/internal/v1/links`, { method: "POST" }),
  );
  assert.equal(blocked.status, 404);
});
