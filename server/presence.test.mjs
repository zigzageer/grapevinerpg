import assert from "node:assert/strict";
import test from "node:test";
import { Presence } from "./presence.mjs";

const sessionToken = (index) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const player = (index, overrides = {}) => ({
  worldId: "mint",
  sessionToken: sessionToken(index),
  characterId: "you",
  x: 850.125,
  y: 590,
  facing: 1,
  moving: false,
  seq: 0,
  ...overrides,
});

test("shares positions between sessions, including players using the same character", () => {
  const presence = new Presence();
  assert.deepEqual(presence.update(player(1)), { players: [] });

  const {
    players: [first],
  } = presence.update(player(2));
  assert.match(first.sessionId, /^[0-9a-f]{32}$/);
  assert.notEqual(first.sessionId, sessionToken(1).replaceAll("-", ""));
  assert.deepEqual(first, {
    sessionId: first.sessionId,
    characterId: "you",
    x: 850.125,
    y: 590,
    facing: 1,
    moving: false,
  });
  assert.throws(
    () => presence.update(player(2, { sessionToken: first.sessionId })),
    { status: 400 },
  );

  const {
    players: [second],
  } = presence.update(
    player(1, { x: 901.25, y: 606.5, facing: -1, moving: true, seq: 1 }),
  );
  assert.notEqual(second.sessionId, first.sessionId);
  assert.equal(second.characterId, first.characterId);
  assert.deepEqual(presence.update(player(2, { seq: 1 })), {
    players: [{ ...first, x: 901.25, y: 606.5, facing: -1, moving: true }],
  });
  presence.update(player(1, { x: 900, y: 606.5, facing: -1, seq: 2 }));
  assert.deepEqual(presence.update(player(2, { seq: 2 })), {
    players: [{ ...first, x: 900, y: 606.5, facing: -1, moving: false }],
  });
});

test("isolates each world and moves a session without duplicating it", () => {
  const presence = new Presence();
  const clan = player(3, { worldId: "grapevine" });
  const discord = player(4, { worldId: "123456789012345678" });
  const otherDiscord = player(5, { worldId: "123456789012345679" });

  assert.deepEqual(presence.update(player(1)), { players: [] });
  assert.deepEqual(presence.update(clan), { players: [] });
  assert.deepEqual(presence.update(discord), { players: [] });
  assert.deepEqual(presence.update(otherDiscord), { players: [] });
  const {
    players: [before],
  } = presence.update(player(2));

  assert.equal(
    presence.update(player(1, { worldId: "grapevine", seq: 2 })).players.length,
    1,
  );
  assert.deepEqual(presence.update(player(1, { seq: 1 })), { players: [] });
  assert.deepEqual(presence.update(player(2, { seq: 1 })), { players: [] });
  assert.deepEqual(presence.update(clan), { players: [before] });
  assert.deepEqual(presence.update(discord), { players: [] });
  assert.deepEqual(presence.update(otherDiscord), { players: [] });

  presence.update(
    player(1, { worldId: "grapevine", characterId: "friend-3", seq: 3 }),
  );
  assert.deepEqual(presence.update(clan), {
    players: [{ ...before, characterId: "friend-3" }],
  });
});

test("prunes expired sessions and keeps newer positions across reordered updates", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  presence.update(player(1, { seq: 4 }));

  now = 5000;
  presence.update(player(1, { x: 999, seq: 5 }));
  presence.update(player(2));
  now = 10_000;
  presence.update(player(1, { x: 888, seq: 4 }));
  presence.update(player(1, { x: 777, seq: 5 }));

  now = 18_999;
  assert.equal(presence.update(player(2, { seq: 1 })).players[0].x, 999);
  now = 19_000;
  assert.deepEqual(presence.update(player(2, { seq: 2 })), { players: [] });

  assert.equal(presence.update(player(1, { seq: 6 })).players.length, 1);
  now = 33_001;
  presence.sweep();
  assert.deepEqual(presence.update(player(1, { seq: 7 })), { players: [] });
});

test("rejects invalid updates and bounds coordinates for each map type", () => {
  const presence = new Presence();
  for (const input of [null, [], "", {}])
    assert.throws(() => presence.update(input), { status: 400 });
  for (const invalid of [
    { worldId: "town-preview" },
    { worldId: ["mint"] },
    { worldId: "1234567890123456" },
    { sessionToken: "not-a-token" },
    { sessionToken: "00000000-0000-1000-8000-000000000000" },
    { characterId: "../../assets" },
    { characterId: "x".repeat(81) },
    { x: "850" },
    { x: NaN },
    { x: 2400.01 },
    { y: -1 },
    { y: Infinity },
    { facing: 0 },
    { facing: "-1" },
    { moving: 1 },
    { seq: -1 },
    { seq: 0.5 },
    { seq: Number.MAX_SAFE_INTEGER + 1 },
    { worldId: "grapevine", y: 1200.01 },
    { worldId: "123456789012345678", x: 3600.01 },
    { worldId: "123456789012345678", y: 3000.01 },
  ])
    assert.throws(() => presence.update(player(1, invalid)), { status: 400 });

  assert.deepEqual(
    presence.update(
      player(1, { worldId: "123456789012345678", x: 3600, y: 3000 }),
    ),
    { players: [] },
  );
});

test("rejects unpublished characters before changing a player's presence", () => {
  const presence = new Presence({
    canUseCharacter: (worldId, characterId) =>
      worldId === "mint" && characterId === "you",
  });
  presence.update(player(1));
  assert.throws(
    () => presence.update(player(1, { characterId: "draft", seq: 1 })),
    { status: 404 },
  );
  assert.throws(
    () => presence.update(player(1, { worldId: "grapevine", seq: 1 })),
    {
      status: 404,
    },
  );
  assert.equal(presence.update(player(2)).players[0].characterId, "you");
});

test("caps active players per world and keeps an existing player during a refused switch", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  presence.update(player(1, { worldId: "grapevine" }));
  for (let index = 2; index <= 65; index++) presence.update(player(index));

  assert.throws(() => presence.update(player(66)), { status: 429 });
  assert.throws(() => presence.update(player(1, { seq: 1 })), { status: 429 });
  assert.equal(
    presence.update(player(66, { worldId: "grapevine" })).players.length,
    1,
  );
  assert.equal(presence.update(player(2, { seq: 1 })).players.length, 63);

  now = 14_000;
  assert.deepEqual(presence.update(player(66, { seq: 1 })), { players: [] });
});

test("bounds retained sessions across all rooms and reclaims space after expiry", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  for (let index = 1; index <= 2048; index++)
    presence.update(
      player(index, { worldId: `1${String(index).padStart(16, "0")}` }),
    );
  assert.throws(() => presence.update(player(2049)), { status: 503 });
  assert.deepEqual(presence.update(player(1, { seq: 1 })), { players: [] });

  now = 14_000;
  assert.deepEqual(presence.update(player(2049)), { players: [] });
});
