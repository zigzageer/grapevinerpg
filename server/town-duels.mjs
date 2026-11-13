import { randomBytes, randomUUID } from "node:crypto";
import { simulateAutoFight } from "./match-combat.mjs";
import { StudioError } from "./studio-store.mjs";

const OFFER_MS = 25_000;
const FIGHT_MS = 6_000;
const RESULT_MS = 8_000;
const sessionIdPattern = /^[a-f0-9]{32}$/;
const duelIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

const unavailable = () =>
  new StudioError("That player is no longer available.", 409);

export class TownDuels {
  #rooms = new Map();

  constructor({ presence, getCharacter, now = () => performance.now() }) {
    this.presence = presence;
    this.getCharacter = getCharacter;
    this.now = now;
  }

  #currentPlayer(worldId, player) {
    return (
      this.presence.findPlayer(worldId, player.sessionId)?.claimId ===
      player.claimId
    );
  }

  #sweepRoom(worldId, now) {
    const room = this.#rooms.get(worldId);
    if (!room) return;
    for (const [id, duel] of room) {
      const expires =
        (duel.endsAt ?? duel.offerExpires) +
        (duel.endsAt === undefined ? 0 : RESULT_MS);
      if (
        expires <= now ||
        !duel.fighters.every((player) => this.#currentPlayer(worldId, player))
      )
        room.delete(id);
    }
    if (!room.size) this.#rooms.delete(worldId);
    return room;
  }

  sweep() {
    const now = this.now();
    for (const worldId of this.#rooms.keys()) this.#sweepRoom(worldId, now);
  }

  snapshot(worldId, sessionToken) {
    const now = this.now();
    const room = this.#sweepRoom(worldId, now);
    if (!room?.size) return { fights: [], own: null };
    const player = this.presence.playerForToken(worldId, sessionToken);
    const fights = [];
    let own = null;
    for (const duel of room.values()) {
      const { id, fighters, endsAt } = duel;
      const characterIds = fighters.map(({ characterId }) => characterId);
      const status =
        endsAt === undefined
          ? "offered"
          : endsAt > now
            ? "fighting"
            : "finished";
      if (status === "fighting") {
        fights.push({ id, characterIds, x: duel.x, y: duel.y });
      }
      const side = fighters.findIndex(
        (fighter) => fighter.claimId === player?.claimId,
      );
      // A finished result can coexist with a newer challenge.
      if (side !== -1 && (!own || own.status === "finished")) {
        own = {
          id,
          characterIds,
          status,
          role: side === 0 ? "challenger" : "opponent",
          ...(status === "finished"
            ? { winnerCharacterId: characterIds[duel.winnerSide] }
            : {}),
        };
      }
    }
    return { fights, own };
  }

  act(input) {
    const { worldId, sessionToken, action, opponentSessionId, duelId } = input;
    const actor = this.presence.playerForToken(worldId, sessionToken);
    if (!actor)
      throw new StudioError("Choose an available character first.", 409);
    const now = this.now();
    const room = this.#sweepRoom(worldId, now) ?? new Map();
    if (action === "challenge") {
      if (
        typeof opponentSessionId !== "string" ||
        !sessionIdPattern.test(opponentSessionId)
      )
        throw new StudioError("Choose a player to fight.");
      const opponent = this.presence.findPlayer(worldId, opponentSessionId);
      if (!opponent || opponent.sessionId === actor.sessionId)
        throw unavailable();
      const active = [...room.values()].find(
        (duel) =>
          (duel.endsAt ?? Infinity) > now &&
          duel.fighters.some(
            ({ sessionId }) =>
              sessionId === actor.sessionId || sessionId === opponent.sessionId,
          ),
      );
      if (active) {
        if (
          active.endsAt === undefined &&
          active.fighters[0].sessionId === actor.sessionId &&
          active.fighters[1].sessionId === opponent.sessionId
        )
          return this.snapshot(worldId, sessionToken);
        throw new StudioError(
          "A player already has a fight or challenge.",
          409,
        );
      }
      const id = randomUUID();
      room.set(id, {
        id,
        fighters: [actor, opponent],
        offerExpires: now + OFFER_MS,
      });
      this.#rooms.set(worldId, room);
    } else {
      if (
        !["accept", "decline", "cancel"].includes(action) ||
        typeof duelId !== "string" ||
        !duelIdPattern.test(duelId)
      )
        throw new StudioError("Invalid fight request.");
      const duel = room.get(duelId);
      const side = action === "cancel" ? 0 : 1;
      if (duel?.fighters[side].claimId !== actor.claimId) throw unavailable();
      if (duel.endsAt !== undefined) {
        if (action === "accept") return this.snapshot(worldId, sessionToken);
        throw unavailable();
      }
      if (action === "accept") this.#start(worldId, duel, now);
      else room.delete(duelId);
    }
    return this.snapshot(worldId, sessionToken);
  }

  #start(worldId, duel, now) {
    const poses = duel.fighters.map(({ sessionId }) =>
      this.presence.findPlayer(worldId, sessionId),
    );
    if (poses.some((pose, i) => pose?.claimId !== duel.fighters[i].claimId))
      throw unavailable();
    const characters = poses.map(({ characterId }) =>
      this.getCharacter(worldId, characterId),
    );
    if (characters.some((character) => !character)) throw unavailable();
    const match = {
      rng: randomBytes(4).readUInt32BE(),
      sides: poses.map(({ sessionId }) => ({
        players: [
          { id: sessionId, hp: 100, startingHp: 100, ability: "Power Strike" },
        ],
      })),
      events: [],
    };
    simulateAutoFight(match, characters);
    duel.winnerSide = match.winnerSide;
    duel.x = (poses[0].x + poses[1].x) / 2;
    duel.y = (poses[0].y + poses[1].y) / 2;
    duel.endsAt = now + FIGHT_MS;
  }
}
