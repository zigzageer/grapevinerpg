import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { MatchService } from "./match-service.mjs";
import { simulateAutoFight } from "./match-combat.mjs";
import { createStudioServer } from "./studio-http.mjs";
import { signature } from "./bridge.mjs";
import { studioGateway } from "./gateway.mjs";
import { StudioError } from "./studio-store.mjs";

const A = "123456789012345678";
const B = "223456789012345678";
const FIRST = "323456789012345678";
const SECOND = "423456789012345678";
const ADMIN = "523456789012345678";
const DAY = 24 * 60 * 60 * 1000;
const BASE = "https://game.example";
const DAVID_ID = "friend-5";
const ART = "/api/studio/assets/aa2f297b-d811-4f37-8a75-188cab8069a9.png";
const EFFECT = "/api/studio/assets/a749039a-b2f4-485b-ad3d-5f2a477a4db0.png";
const characterId = (userId) => "discord-" + userId;

function setup(t, { grapevineGuildId = A } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "grapevine-auto-fights-"));
  let now = 1794441600000;
  let next = 600000000000000001n;
  const loads = [];
  const games = new Map(
    [A, B].map((guildId) => [
      guildId,
      {
        guildId,
        name: guildId === A ? "Grapevine" : "Signal Yard",
        characters: [FIRST, SECOND].map((userId, index) => ({
          id: characterId(userId),
          name: index ? "Fern" : "Rue",
          sprite: "/games/" + guildId + "/" + userId + ".png",
        })),
      },
    ]),
  );
  games.set("mint", {
    guildId: "mint",
    name: "Adventures of Mint",
    characters: [
      { id: "you", name: "Mint", kind: "mint" },
      { id: "cast-grace", name: "Grace", preset: "grace" },
      { id: DAVID_ID, name: "David" },
    ],
  });
  const loadGame = async (id) => {
    loads.push(id);
    const game = games.get(id);
    if (!game)
      throw new StudioError("This town has not been created yet.", 404);
    return game;
  };
  const open = () =>
    new MatchService({
      directory,
      loadGame,
      baseUrl: BASE,
      grapevineGuildId,
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
  return {
    get matches() {
      return matches;
    },
    advance(ms) {
      now += ms;
    },
    reopen() {
      matches.close();
      matches = open();
    },
    request,
    games,
    loads,
    set(guildId, userId, characterId) {
      return matches.updateFighter(
        request(guildId, userId, {
          action: "set",
          ...(characterId === undefined ? {} : { characterId }),
        }),
      );
    },
    assign(guildId, memberId, characterId, manageGuild = true) {
      return matches.updateFighter(
        request(guildId, ADMIN, {
          action: "assign",
          memberId,
          characterId,
          manageGuild,
        }),
      );
    },
    fight(guildId, userId = FIRST, opponentUserId = SECOND) {
      return matches.fight(request(guildId, userId, { opponentUserId }));
    },
  };
}

function simulate(rng, characters) {
  const match = {
    rng,
    sides: ["left", "right"].map((id) => ({
      players: [{ id, hp: 100, startingHp: 100, ability: "Power Strike" }],
    })),
    events: [],
  };
  simulateAutoFight(match, characters);
  return match;
}

function verifyReplay(match) {
  const players = match.sides.map(({ players }) => players[0]);
  const health = new Map(players.map(({ id, startingHp }) => [id, startingHp]));
  assert.equal(match.status, "finished");
  assert.equal(match.turnFighterId, null);
  assert.ok(match.events.length > 0 && match.events.length <= 23);
  for (const [index, event] of match.events.entries()) {
    assert.equal(event.seq, index + 1);
    assert.ok(
      ["strike", "burst", "rush", "projectile", "spray", "drill"].includes(
        event.visual,
      ),
    );
    assert.ok(health.get(event.actorId) > 0);
    assert.ok(health.get(event.targetId) > 0);
    assert.notEqual(event.actorId, event.targetId);
    assert.ok(event.damage >= 0);
    assert.equal(health.get(event.targetId) - event.damage, event.targetHp);
    health.set(event.targetId, event.targetHp);
    if (event.actorHp !== undefined) {
      assert.equal(event.damage, 0);
      assert.ok(
        event.actorHp > health.get(event.actorId) && event.actorHp <= 100,
      );
      health.set(event.actorId, event.actorHp);
    }
  }
  assert.deepEqual(
    [...health.values()],
    players.map(({ hp }) => hp),
  );
  assert.equal(players[1 - match.winnerSide].hp, 0);
}

test("auto combat is deterministic, symmetric and replays fixed signature effects", () => {
  const characters = [
    { preset: "miel" },
    {
      ability: {
        name: "Paper Rush",
        description: "Two paper hits.",
        style: "rush",
        art: EFFECT,
      },
    },
  ];
  const match = simulate(8294621, characters);
  assert.deepEqual(match, simulate(8294621, characters));
  verifyReplay(match);
  const signature = match.events.find(({ move }) => move === "Paper Rush");
  assert.equal(signature.kind, "ability");
  assert.equal(signature.visual, "rush");
  assert.ok([26, 28, 34].includes(signature.damage));
  assert.equal(match.sides[1].players[0].abilityArt, EFFECT);
  assert.ok(match.events.some(({ move }) => move === "Rosé Spritz"));

  const wins = [0, 0];
  const effects = new Set();
  for (let index = 0; index < 300; index++) {
    const seed = Math.imul(index, 0x9e3779b9) >>> 0;
    const mirror = simulate(seed, [
      { preset: "babashark" },
      { preset: "babashark" },
    ]);
    verifyReplay(mirror);
    wins[mirror.winnerSide]++;
    for (const event of mirror.events) {
      if (event.actorHp !== undefined) effects.add("healing");
      if (event.move === "Asleep") effects.add("sleep");
    }
    const status = simulate(seed, [
      { preset: "miel" },
      { preset: "flag-girl" },
    ]);
    verifyReplay(status);
    for (const event of status.events) {
      if (event.move === "Burning") effects.add("burn");
      if (event.move === "Stunned") effects.add("stun");
    }
  }
  assert.ok(
    wins.every((count) => count >= 100),
    JSON.stringify(wins),
  );
  assert.deepEqual(effects, new Set(["healing", "sleep", "burn", "stun"]));
});

test("Zippy and Footjobofsteel use their new moves in Discord auto fights", () => {
  const moves = new Map([
    [
      "Diarrhea Spray",
      { visual: "spray", art: "/abilities/zippy-diarrhea-spray.webp" },
    ],
    [
      "Needle Toss",
      { visual: "projectile", art: "/abilities/zippy-needle-toss.webp" },
    ],
    [
      "Fleshlight Toss",
      { visual: "projectile", art: "/abilities/zippy-fleshlight-volley.webp" },
    ],
    ["Drill Rush", { visual: "drill" }],
    ["First Aid", { visual: "burst", heal: true }],
  ]);
  for (let index = 0; index < 48 && moves.size; index++) {
    const seed = Math.imul(index, 0x9e3779b9) >>> 0;
    const match = simulate(seed, [{ id: "friend-9" }, { id: "friend-15" }]);
    verifyReplay(match);
    for (const event of match.events.filter(({ kind }) => kind === "ability")) {
      const expected = moves.get(event.move);
      if (!expected) continue;
      const {
        players: [fighter],
      } = match.sides[event.actorId === "left" ? 0 : 1];
      assert.equal(event.visual, expected.visual);
      assert.equal(fighter.abilityArt, expected.art);
      assert.equal(event.actorHp !== undefined, expected.heal === true);
      moves.delete(event.move);
    }
  }
  assert.deepEqual([...moves.keys()], []);
});

test("legacy fighters are guild scoped, owners can equip multiple choices, and pause survives restart", async (t) => {
  const h = setup(t);
  const ownChoice = { id: characterId(FIRST), name: "Rue" };
  assert.deepEqual(await h.matches.getFighter(A, FIRST), {
    userId: FIRST,
    characterId: ownChoice.id,
    name: ownChoice.name,
    enabled: false,
    choices: [ownChoice],
  });
  assert.ok(
    (await h.matches.listFighters(A)).characters.some(({ id }) => id === "you"),
  );
  assert.ok(
    !(await h.matches.listFighters(B)).characters.some(
      ({ id }) => id === "you",
    ),
  );
  await assert.rejects(h.assign(B, FIRST, "you"), { status: 404 });
  await assert.rejects(h.assign(A, FIRST, "you", false), { status: 403 });
  await assert.rejects(h.assign(A, SECOND, characterId(FIRST)), {
    status: 409,
  });

  assert.deepEqual(await h.assign(A, FIRST, "you"), {
    userId: FIRST,
    characterId: "you",
    name: "Mint",
    enabled: false,
  });
  await h.assign(A, FIRST, "cast-grace");
  await assert.rejects(h.assign(A, SECOND, "you"), { status: 409 });
  await assert.rejects(h.set(A, SECOND, "you"), { status: 403 });
  assert.equal((await h.set(A, FIRST)).characterId, ownChoice.id);
  assert.equal((await h.set(A, FIRST, "cast-grace")).enabled, true);
  assert.equal((await h.assign(A, FIRST, "you")).enabled, false);
  assert.equal((await h.assign(A, FIRST, "cast-grace")).enabled, true);
  assert.deepEqual(
    (await h.matches.getFighter(A, FIRST)).choices.map(({ id }) => id).sort(),
    [ownChoice.id, "cast-grace", "you"].sort(),
  );
  await assert.rejects(
    h.matches.updateFighter(
      h.request(A, SECOND, { action: "pause", memberId: FIRST }),
    ),
    { status: 403 },
  );
  const loadCount = h.loads.length;
  const pause = h.request(A, FIRST, { action: "pause" });
  assert.deepEqual(await h.matches.updateFighter(pause), {
    userId: FIRST,
    characterId: "cast-grace",
    name: "Grace",
    enabled: false,
  });
  assert.equal(h.loads.length, loadCount);
  h.reopen();
  assert.equal((await h.matches.getFighter(A, FIRST)).enabled, false);
  assert.equal((await h.set(A, FIRST)).characterId, "cast-grace");
  await h.matches.updateFighter(pause);
  assert.equal((await h.matches.getFighter(A, FIRST)).enabled, true);
  h.games.delete(A);
  assert.ok(
    (await h.matches.listFighters(A)).characters.some(
      ({ id }) => id === "cast-grace",
    ),
  );
  await h.assign(A, SECOND, DAVID_ID);
  assert.equal((await h.matches.getFighter(A, SECOND)).characterId, DAVID_ID);
  assert.equal((await h.set(A, SECOND)).characterId, DAVID_ID);
  assert.deepEqual(await h.matches.getFighter(B, ADMIN), {
    userId: ADMIN,
    characterId: null,
    name: null,
    enabled: false,
    choices: [],
  });
});

test("fights require two opted-in members and protect public match data", async (t) => {
  const h = setup(t);
  await assert.rejects(h.fight(A, FIRST, FIRST), { status: 400 });
  await assert.rejects(h.fight(A), { status: 409 });
  await h.set(A, FIRST);
  await h.set(B, SECOND);
  await assert.rejects(h.fight(A), { status: 409 });
  await h.set(A, SECOND);

  const [firstCharacter, secondCharacter] = h.games.get(A).characters;
  firstCharacter.sprite = ART;
  firstCharacter.ability = {
    name: "Moonbeam",
    description: "A cut-paper beam.",
    style: "projectile",
    art: EFFECT,
  };
  secondCharacter.sprite = "/games/" + B + "/" + SECOND + ".png";
  secondCharacter.ability = {
    name: "Fake Effect",
    description: "An unavailable effect.",
    style: "rush",
    art: "/api/studio/assets/../../../elsewhere.png",
  };
  const request = h.request(A, FIRST, { opponentUserId: SECOND });
  const [result, duplicate] = await Promise.all([
    h.matches.fight(request),
    h.matches.fight(request),
  ]);
  assert.deepEqual(result, duplicate);
  const { match, score } = result;
  assert.equal(score.awarded, 1);
  assert.equal(score.winnerUserId, [FIRST, SECOND][match.winnerSide]);
  assert.equal(match.kind, "duel");
  assert.equal(match.mode, "auto");
  assert.equal(match.replayUrl, BASE + "/wars/" + match.id);
  verifyReplay(match);
  assert.equal(match.sides[0].players[0].sprite, ART);
  assert.equal(match.sides[0].players[0].ability, "Moonbeam");
  assert.equal(match.sides[0].players[0].abilityArt, EFFECT);
  assert.equal(match.sides[1].players[0].sprite, null);
  assert.equal(match.sides[1].players[0].abilityArt, undefined);
  const replay = JSON.stringify(h.matches.getMatch(match.id));
  for (const value of [
    FIRST,
    SECOND,
    request.requestId,
    "userId",
    "rng",
    "score",
  ])
    assert.ok(!replay.includes(value), value);
  await assert.rejects(h.matches.fight({ ...request, guildId: B }), {
    status: 409,
  });
  assert.throws(() => h.matches.getAutoFight("not-a-fight"), { status: 404 });
  const manual = await h.matches.challenge(
    h.request(A, ADMIN, {
      kind: "war",
      manageGuild: true,
      opponentGuildId: B,
    }),
  );
  assert.throws(() => h.matches.getAutoFight(manual.id), { status: 404 });
  h.reopen();
  assert.deepEqual(h.matches.getAutoFight(match.id), result);
  assert.deepEqual(await h.matches.fight(request), result);

  await h.assign(A, SECOND, DAVID_ID);
  await h.set(A, SECOND, DAVID_ID);
  const next = await h.fight(A);
  assert.equal(next.match.sides[1].players[0].sprite, "/characters/david.png");
  assert.equal(
    next.match.sides[1].players[0].abilityArt,
    "/characters/grace.png",
  );
  assert.deepEqual(h.matches.getAutoFight(match.id), result);
});

test("the same unordered pair earns one global point per rolling day while all fights count", async (t) => {
  const h = setup(t);
  assert.deepEqual(h.matches.leaderboard(), { entries: [] });
  for (const guild of [A, B]) {
    await h.set(guild, FIRST);
    await h.set(guild, SECOND);
  }
  const [first, repeated] = await Promise.all([
    h.fight(A),
    h.fight(B, SECOND, FIRST),
  ]);
  assert.equal(first.score.awarded + repeated.score.awarded, 1);
  const awarded = first.score.awarded ? first : repeated;
  const awardGuild = awarded.match.sides[0].guildId;
  const winner = awarded.score.winnerUserId;
  const other = winner === FIRST ? SECOND : FIRST;
  const guildForOther = awardGuild === A ? B : A;
  const order = guildForOther === B ? [SECOND, FIRST] : [FIRST, SECOND];
  h.advance(DAY - 1);
  assert.equal((await h.fight(guildForOther, ...order)).score.awarded, 0);
  h.reopen();
  h.advance(1);
  const boundary = await h.fight(guildForOther, ...order);
  assert.deepEqual(boundary.score, { awarded: 1, winnerUserId: other });
  assert.deepEqual(
    h.matches
      .leaderboard()
      .entries.map(({ rank, userId, wins, losses, points }) => ({
        rank,
        userId,
        wins,
        losses,
        points,
      })),
    [
      { rank: 1, userId: other, wins: 3, losses: 1, points: 1 },
      { rank: 1, userId: winner, wins: 1, losses: 3, points: 1 },
    ],
  );
  assert.deepEqual(
    h.matches
      .leaderboard(awardGuild)
      .entries.map(({ rank, userId, wins, losses, points }) => ({
        rank,
        userId,
        wins,
        losses,
        points,
      })),
    [
      { rank: 1, userId: winner, wins: 1, losses: 0, points: 1 },
      { rank: 2, userId: other, wins: 0, losses: 1, points: 0 },
    ],
  );
  assert.deepEqual(
    h.matches
      .leaderboard(guildForOther)
      .entries.map(({ rank, userId, wins, losses, points }) => ({
        rank,
        userId,
        wins,
        losses,
        points,
      })),
    [
      { rank: 1, userId: other, wins: 3, losses: 0, points: 1 },
      { rank: 2, userId: winner, wins: 0, losses: 3, points: 0 },
    ],
  );
});

test("leaderboards keep ten entries and rank tied players by their points", async (t) => {
  const h = setup(t);
  await h.set(A, FIRST);
  const roster = h.games.get(A).characters;
  for (let index = 0; index < 12; index++) {
    const opponent = String(723456789012345678n + BigInt(index));
    roster.push({ id: characterId(opponent), name: "Fighter " + index });
    await h.set(A, opponent);
    assert.equal((await h.fight(A, FIRST, opponent)).score.awarded, 1);
  }
  const { entries } = h.matches.leaderboard(A);
  assert.equal(entries.length, 10);
  const expectedRanks = new Map();
  for (const [index, entry] of entries.entries()) {
    if (!expectedRanks.has(entry.points))
      expectedRanks.set(entry.points, index + 1);
    assert.equal(entry.rank, expectedRanks.get(entry.points));
  }
  assert.deepEqual(h.matches.leaderboard().entries, entries);
});

test("fighter, fight, and leaderboard routes require the signed bot bridge", async (t) => {
  const h = setup(t);
  const secret = "fixture-studio-secret";
  const matchBotSecret = "fixture-match-secret";
  const server = createStudioServer({
    service: {},
    secret,
    matches: h.matches,
    matchBotSecret,
    verifyVercel: async () => true,
  });
  const handle = server.listeners("request")[0];
  const ip = "127.0.0.1";
  const root = "/internal/v1";
  async function send(method, route, data, key = matchBotSecret) {
    const body =
      data === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(data));
    const timestamp = String(Date.now());
    const headers = {
      "x-mint-ip": ip,
      "x-mint-time": timestamp,
      ...(key
        ? {
            "x-mint-signature": signature({
              secret: key,
              method,
              path: route,
              ip,
              timestamp,
              body,
            }),
          }
        : { authorization: "Bearer fixture-token" }),
    };
    const request = Object.assign(Readable.from([body]), {
      url: route,
      method,
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
  assert.equal(
    (await send("GET", root + "/fighters/" + A, undefined, secret)).status,
    401,
  );
  assert.equal(
    (await send("GET", root + "/leaderboards/global", undefined, null)).status,
    401,
  );
  const list = await send("GET", root + "/fighters/" + A);
  assert.equal(list.status, 200);
  assert.ok(list.response.characters.some(({ id }) => id === "you"));
  const assigned = await send(
    "POST",
    root + "/fighters",
    h.request(A, ADMIN, {
      action: "assign",
      memberId: FIRST,
      characterId: "you",
      manageGuild: true,
    }),
  );
  assert.equal(assigned.status, 200);
  assert.equal(assigned.response.enabled, false);
  const choice = await send("GET", root + "/fighters/" + A + "/" + FIRST);
  assert.ok(choice.response.choices.some(({ id }) => id === "you"));
  for (const [user, character] of [
    [FIRST, "you"],
    [SECOND, characterId(SECOND)],
  ]) {
    const enabled = await send(
      "POST",
      root + "/fighters",
      h.request(A, user, {
        action: "set",
        characterId: character,
      }),
    );
    assert.equal(enabled.status, 200);
    assert.equal(enabled.response.enabled, true);
  }
  const fight = await send(
    "POST",
    root + "/fights",
    h.request(A, FIRST, { opponentUserId: SECOND }),
  );
  assert.equal(fight.status, 201);
  assert.equal(fight.response.score.awarded, 1);
  assert.equal(
    fight.response.match.sides[0].players[0].sprite,
    "/characters/mint.png",
  );
  assert.deepEqual(
    await send("GET", "/matches/" + fight.response.match.id, undefined, secret),
    {
      status: 200,
      response: fight.response.match,
    },
  );
  const global = await send("GET", root + "/leaderboards/global");
  assert.equal(global.status, 200);
  assert.equal(global.response.entries.length, 2);
  assert.deepEqual(
    await send("GET", root + "/leaderboards/guild/" + A),
    global,
  );
  assert.equal(
    (await send("GET", root + "/leaderboards/guild/mint")).status,
    400,
  );
  assert.equal(
    (
      await studioGateway(
        new Request(BASE + "/api/studio" + root + "/fights", {
          method: "POST",
        }),
      )
    ).status,
    404,
  );
});
