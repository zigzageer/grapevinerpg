import assert from "node:assert/strict";
import test from "node:test";
import { Presence } from "./presence.mjs";
import { TownDuels } from "./town-duels.mjs";

const token = (index) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const EMPTY = { fights: [], own: null };
const GRAPEVINE = "grapevine";
const DISCORD = "123456789012345678";

function setup() {
  let time = 0;
  const now = () => time;
  const presence = new Presence({ now });
  const duels = new TownDuels({
    presence,
    now,
    getCharacter: (worldId, characterId) => ({
      id: characterId,
      kind: characterId === "you" ? "mint" : "human",
    }),
  });
  const seq = new Map();
  const credentials = (index, worldId) => ({
    worldId,
    sessionToken: token(index),
  });
  const next = (index) => {
    const value = (seq.get(index) ?? 0) + 1;
    seq.set(index, value);
    return value;
  };
  const player = (index, worldId = GRAPEVINE) =>
    presence.playerForToken(worldId, token(index));
  return {
    duels,
    at(ms) {
      time = ms;
    },
    pose(index, characterId, { worldId = GRAPEVINE, x = 850, y = 590 } = {}) {
      assert.equal(
        presence.update({
          ...credentials(index, worldId),
          characterId,
          x,
          y,
          facing: 1,
          moving: false,
          seq: next(index),
        }).accepted,
        true,
      );
      return player(index, worldId);
    },
    release(index, worldId = GRAPEVINE) {
      presence.update({
        ...credentials(index, worldId),
        action: "release",
        seq: next(index),
      });
    },
    challenge(index, opponentSessionId, worldId = GRAPEVINE) {
      return duels.act({
        ...credentials(index, worldId),
        action: "challenge",
        opponentSessionId,
      });
    },
    respond(index, action, duelId, worldId = GRAPEVINE) {
      return duels.act({ ...credentials(index, worldId), action, duelId });
    },
    snapshot(index, worldId = GRAPEVINE) {
      return duels.snapshot(worldId, token(index));
    },
  };
}

test("only the challenged live session can accept a private offer", () => {
  const h = setup();
  const alice = h.pose(1, "you");
  const bob = h.pose(2, "friend-3");
  h.pose(3, "friend-4");

  assert.throws(() => h.challenge(4, bob.sessionId), { status: 409 });
  assert.throws(() => h.challenge(1, alice.sessionId), { status: 409 });
  assert.throws(() => h.challenge(1, token(2)), { status: 400 });
  const offered = h.challenge(1, bob.sessionId);
  const { id, characterIds } = offered.own;
  assert.deepEqual(characterIds, ["you", "friend-3"]);
  assert.deepEqual(offered, {
    fights: [],
    own: { id, characterIds, status: "offered", role: "challenger" },
  });
  assert.deepEqual(h.snapshot(2), {
    fights: [],
    own: { id, characterIds, status: "offered", role: "opponent" },
  });
  assert.deepEqual(h.snapshot(3), EMPTY);

  assert.throws(() => h.respond(1, "accept", id), { status: 409 });
  assert.throws(() => h.respond(2, "cancel", id), { status: 409 });
  assert.throws(
    () =>
      h.duels.act({
        worldId: GRAPEVINE,
        sessionToken: token(3),
        sessionId: bob.sessionId,
        role: "opponent",
        action: "accept",
        duelId: id,
      }),
    { status: 409 },
  );
  assert.throws(
    () =>
      h.duels.act({
        worldId: GRAPEVINE,
        sessionToken: bob.sessionId,
        action: "accept",
        duelId: id,
      }),
    { status: 409 },
  );
  assert.equal(h.snapshot(2).own.status, "offered");
  assert.equal(h.respond(2, "accept", id).own.status, "fighting");
});

test("a duplicate offer is idempotent and a player can join only one pending or active fight", () => {
  const h = setup();
  const alice = h.pose(1, "you");
  const bob = h.pose(2, "friend-3");
  const carol = h.pose(3, "friend-4");
  const david = h.pose(4, "friend-5");

  const first = h.challenge(1, bob.sessionId);
  assert.deepEqual(h.challenge(1, bob.sessionId), first);
  assert.throws(() => h.challenge(1, carol.sessionId), { status: 409 });
  assert.throws(() => h.challenge(2, alice.sessionId), { status: 409 });
  assert.throws(() => h.challenge(3, bob.sessionId), { status: 409 });
  const second = h.challenge(3, david.sessionId);
  assert.notEqual(second.own.id, first.own.id);

  const started = h.respond(2, "accept", first.own.id);
  assert.deepEqual(h.respond(2, "accept", first.own.id), started);
  assert.throws(() => h.respond(1, "cancel", first.own.id), { status: 409 });
  assert.throws(() => h.respond(2, "decline", first.own.id), { status: 409 });
  assert.throws(() => h.challenge(1, bob.sessionId), { status: 409 });
  assert.equal(h.respond(4, "accept", second.own.id).fights.length, 2);
});

test("only the current town sees the fight marker and only its participants see the result", () => {
  const h = setup();
  h.pose(1, "you", { x: 841, y: 590 });
  const bob = h.pose(2, "friend-3", { x: 861, y: 590 });
  h.pose(3, "friend-4");
  const outsider = h.pose(4, "you", { worldId: DISCORD });
  h.pose(5, "friend-3", { worldId: DISCORD });

  assert.throws(() => h.challenge(1, outsider.sessionId), { status: 409 });
  assert.throws(() => h.challenge(4, bob.sessionId, DISCORD), { status: 409 });
  const { id, characterIds } = h.challenge(1, bob.sessionId).own;
  assert.throws(() => h.respond(5, "accept", id, DISCORD), { status: 409 });

  h.pose(2, "friend-3", { x: 901, y: 640 });
  h.respond(2, "accept", id);
  const marker = { id, characterIds, x: 871, y: 615 };
  assert.deepEqual(h.snapshot(3), { fights: [marker], own: null });
  assert.deepEqual(h.snapshot(4, DISCORD), EMPTY);
  assert.deepEqual(h.snapshot(1).own, {
    id,
    characterIds,
    role: "challenger",
    status: "fighting",
  });

  h.at(5_999);
  assert.deepEqual(h.snapshot(3).fights, [marker]);
  h.at(6_000);
  assert.deepEqual(h.snapshot(3), EMPTY);
  assert.deepEqual(h.snapshot(4, DISCORD), EMPTY);
  const { winnerCharacterId } = h.snapshot(1).own;
  assert.ok(characterIds.includes(winnerCharacterId));
  assert.deepEqual(h.snapshot(2), {
    fights: [],
    own: {
      id,
      characterIds,
      role: "opponent",
      status: "finished",
      winnerCharacterId,
    },
  });

  h.at(13_999);
  assert.equal(h.snapshot(1).own.winnerCharacterId, winnerCharacterId);
  h.pose(1, "you");
  h.pose(2, "friend-3");
  h.at(14_000);
  h.duels.sweep();
  assert.deepEqual(h.snapshot(1), EMPTY);
  assert.deepEqual(h.snapshot(2), EMPTY);
});

test("offers can be withdrawn, declined, or dropped when either player changes character or leaves", () => {
  const h = setup();
  h.pose(1, "you");
  const bob = h.pose(2, "friend-3");
  let offer = h.challenge(1, bob.sessionId).own;
  assert.deepEqual(h.respond(1, "cancel", offer.id), EMPTY);
  assert.deepEqual(h.snapshot(2), EMPTY);

  offer = h.challenge(1, bob.sessionId).own;
  assert.deepEqual(h.respond(2, "decline", offer.id), EMPTY);
  assert.deepEqual(h.snapshot(1), EMPTY);

  offer = h.challenge(1, bob.sessionId).own;
  h.pose(2, "friend-4");
  h.pose(2, "friend-3");
  assert.throws(() => h.respond(2, "accept", offer.id), { status: 409 });
  assert.deepEqual(h.snapshot(1), EMPTY);

  offer = h.challenge(1, bob.sessionId).own;
  h.release(1);
  assert.deepEqual(h.snapshot(2), EMPTY);
  assert.throws(() => h.respond(2, "accept", offer.id), { status: 409 });
});

test("leaving an active duel clears its marker before a new player claims that character", () => {
  const h = setup();
  h.pose(1, "you");
  const bob = h.pose(2, "friend-3");
  const { id } = h.challenge(1, bob.sessionId).own;
  assert.equal(h.respond(2, "accept", id).fights.length, 1);
  h.release(2);
  h.pose(3, "friend-3");
  assert.deepEqual(h.snapshot(1), EMPTY);
  assert.deepEqual(h.snapshot(3), EMPTY);
});

test("an offer expires at 25 seconds even while both claims remain live", () => {
  const h = setup();
  h.pose(1, "you");
  const bob = h.pose(2, "friend-3");
  const { id } = h.challenge(1, bob.sessionId).own;
  h.at(12_000);
  h.pose(1, "you");
  h.pose(2, "friend-3");
  h.at(24_999);
  assert.equal(h.snapshot(2).own.id, id);
  h.at(25_000);
  assert.deepEqual(h.snapshot(1), EMPTY);
  assert.throws(() => h.respond(2, "accept", id), { status: 409 });
  assert.notEqual(h.challenge(1, bob.sessionId).own.id, id);
});
