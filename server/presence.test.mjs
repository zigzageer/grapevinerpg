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
const action = (index, action, seq = 0, worldId = "mint") => ({
  worldId,
  sessionToken: sessionToken(index),
  action,
  seq,
});

test("the first claimant owns a character and subsequent poses share its movement", () => {
  const presence = new Presence();
  assert.deepEqual(presence.update(player(1)), { players: [], accepted: true });

  const conflict = presence.update(player(2));
  const [first] = conflict.players;
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, "taken");
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

  const moved = { x: 901.25, y: 606.5, facing: -1, moving: true };
  presence.update(player(1, { ...moved, seq: 1 }));
  assert.deepEqual(presence.update(action(2, "watch", 1)), {
    accepted: true,
    players: [{ ...first, ...moved }],
  });
  presence.update(player(1, { x: 900, y: 606.5, facing: -1, seq: 2 }));
  assert.deepEqual(presence.update(action(2, "watch", 2)), {
    accepted: true,
    players: [{ ...first, x: 900, y: 606.5, facing: -1, moving: false }],
  });
});

test("a rejected character switch preserves the old claim and supersedes earlier requests", () => {
  const presence = new Presence();
  presence.update(player(1));
  presence.update(player(2, { characterId: "friend-3" }));
  const taken = presence.update(player(1, { characterId: "friend-3", seq: 3 }));
  assert.equal(taken.reason, "taken");
  assert.equal(taken.players[0].characterId, "friend-3");
  assert.equal(
    presence.update(player(1, { characterId: "friend-4", seq: 2 })).reason,
    "stale",
  );
  assert.deepEqual(
    presence.update(action(3, "watch")).players.map((p) => p.characterId),
    ["you", "friend-3"],
  );
  const switched = presence.update(
    player(1, { characterId: "friend-4", seq: 4 }),
  );
  assert.equal(switched.accepted, true);
  assert.equal(presence.update(player(3)).accepted, true);
  assert.equal(
    presence.update(player(4, { characterId: "friend-4" })).reason,
    "taken",
  );
});

test("isolates claims per world and moves a session without leaving a duplicate", () => {
  const presence = new Presence();
  const discord = "123456789012345678";
  const otherDiscord = "123456789012345679";
  for (const [index, worldId] of [
    "mint",
    "grapevine",
    discord,
    otherDiscord,
  ].entries()) {
    assert.deepEqual(presence.update(player(index + 1, { worldId })), {
      players: [],
      accepted: true,
    });
  }

  assert.equal(
    presence.update(player(1, { worldId: "grapevine", seq: 2 })).reason,
    "taken",
  );
  assert.equal(presence.update(player(5)).reason, "taken");
  assert.equal(
    presence.update(
      player(1, { worldId: "grapevine", characterId: "friend-3", seq: 3 }),
    ).accepted,
    true,
  );
  assert.deepEqual(presence.update(action(5, "watch")).players, []);
  assert.equal(
    presence.update(action(5, "watch", 0, "grapevine")).players.length,
    2,
  );
  assert.equal(
    presence.update(action(5, "watch", 0, discord)).players.length,
    1,
  );
  assert.equal(
    presence.update(action(5, "watch", 0, otherDiscord)).players.length,
    1,
  );
  assert.equal(presence.update(player(1, { seq: 1 })).reason, "stale");
  presence.update(action(1, "release", 4));
  assert.equal(
    presence.playerForToken("grapevine", sessionToken(1)).characterId,
    "friend-3",
  );
});

test("release fences reordered poses, including a claim that has not arrived yet", () => {
  const presence = new Presence();
  presence.update(player(1, { seq: 1 }));
  assert.equal(presence.update(action(1, "release", 0)).reason, "stale");
  assert.equal(presence.update(action(1, "release", 3)).accepted, true);
  assert.deepEqual(presence.update(player(1, { seq: 2 })), {
    players: [],
    accepted: false,
    reason: "stale",
  });
  assert.equal(presence.update(player(2)).accepted, true);

  presence.update(action(3, "release", 2));
  assert.equal(
    presence.update(player(3, { characterId: "friend-3", seq: 1 })).reason,
    "stale",
  );
  assert.equal(
    presence.update(player(3, { characterId: "friend-3", seq: 3 })).accepted,
    true,
  );
});

test("watch, reordered poses and rejected switches cannot keep a claim alive", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  presence.update(player(1, { seq: 4 }));

  now = 5000;
  presence.update(player(1, { x: 999, seq: 5 }));
  now = 10_000;
  assert.equal(presence.update(player(1, { x: 888, seq: 4 })).reason, "stale");
  assert.equal(presence.update(player(1, { x: 777, seq: 5 })).reason, "stale");
  presence.update(player(2, { characterId: "friend-3" }));
  assert.equal(
    presence.update(player(1, { characterId: "friend-3", seq: 6 })).reason,
    "taken",
  );

  now = 18_999;
  assert.equal(presence.update(action(1, "watch", 7)).players.length, 1);
  assert.equal(presence.update(action(2, "watch", 1)).players[0].x, 999);
  now = 19_000;
  assert.deepEqual(presence.update(action(2, "watch", 2)).players, []);
  assert.equal(presence.update(player(1, { seq: 5 })).reason, "stale");
  assert.equal(presence.update(player(2, { seq: 3 })).accepted, true);
  assert.equal(presence.update(player(1, { seq: 8 })).reason, "taken");
});

test("the server can read only the active claim for a public ID or its private token", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  presence.update(player(1, { worldId: "grapevine", fighting: true }));
  const pose = presence.playerForToken("grapevine", sessionToken(1));
  assert.equal(pose.characterId, "you");
  assert.equal(pose.fighting, undefined);
  assert.deepEqual(presence.findPlayer("grapevine", pose.sessionId), pose);
  assert.equal(presence.findPlayer("mint", pose.sessionId), undefined);
  assert.equal(presence.playerForToken("grapevine", pose.sessionId), undefined);
  pose.x = 0;
  assert.equal(presence.findPlayer("grapevine", pose.sessionId).x, 850.125);
  now = 14_000;
  assert.equal(presence.findPlayer("grapevine", pose.sessionId), undefined);
});

test("validates actions, IDs, and coordinates for each map type", () => {
  const presence = new Presence();
  for (const input of [null, [], "", {}])
    assert.throws(() => presence.update(input), { status: 400 });
  for (const invalid of [
    { action: "unknown" },
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
    { players: [], accepted: true },
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
    () => presence.update(player(1, { worldId: "grapevine", seq: 2 })),
    { status: 404 },
  );
  assert.equal(
    presence.update(action(2, "watch")).players[0].characterId,
    "you",
  );
});

test("caps room occupancy and keeps the previous claim after a refused switch", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  presence.update(player(1, { worldId: "grapevine" }));
  for (let index = 2; index <= 65; index++)
    presence.update(player(index, { characterId: `friend-${index}` }));

  assert.equal(presence.update(action(66, "watch")).players.length, 64);
  assert.throws(() => presence.update(player(66)), { status: 429 });
  assert.throws(() => presence.update(player(1, { seq: 1 })), { status: 429 });
  assert.equal(
    presence.update(action(66, "watch", 1, "grapevine")).players.length,
    1,
  );
  assert.equal(
    presence.update(player(2, { characterId: "friend-2", seq: 1 })).players
      .length,
    63,
  );

  now = 14_000;
  assert.deepEqual(presence.update(player(66, { seq: 2 })), {
    players: [],
    accepted: true,
  });
});

test("caps active claims across rooms without counting spectators", () => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  const guild = (index) => `1${String(index).padStart(16, "0")}`;
  for (let index = 1; index <= 2048; index++) {
    presence.update(action(index + 2048, "watch"));
    assert.equal(
      presence.update(player(index, { worldId: guild(index) })).accepted,
      true,
    );
  }
  assert.throws(() => presence.update(player(2049)), { status: 503 });
  assert.equal(
    presence.update(action(2050, "watch", 1, guild(1))).players.length,
    1,
  );
  assert.equal(
    presence.update(player(1, { worldId: guild(1), seq: 1 })).accepted,
    true,
  );

  now = 14_000;
  assert.deepEqual(presence.update(player(2049, { seq: 1 })), {
    players: [],
    accepted: true,
  });
});
