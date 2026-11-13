import { createHash } from "node:crypto";
import { StudioError } from "./studio-store.mjs";

const TTL_MS = 14_000;
// Keep a short sequence fence after a claim ends so late requests cannot revive it.
const SEQUENCE_TTL_MS = 60_000;
const ROOM_LIMIT = 64;
const SESSION_LIMIT = 2048;
const RECENT_SESSION_LIMIT = SESSION_LIMIT * 2;
const sessionTokenPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const characterIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const guildIdPattern = /^[0-9]{17,20}$/;
const builtInBounds = new Map([
  ["mint", { width: 2400, height: 2100 }],
  ["grapevine", { width: 1720, height: 1200 }],
]);
// Custom Discord layouts have these size limits in contracts/town-v1.schema.json.
const guildBounds = { width: 3600, height: 3000 };

const isCoordinate = (value, max) =>
  Number.isFinite(value) && value >= 0 && value <= max;

export class Presence {
  #sessions = new Map();
  #rooms = new Map();
  #recentSequences = new Map();
  #now;
  #canUseCharacter;

  constructor({
    now = () => performance.now(),
    canUseCharacter = () => true,
  } = {}) {
    this.#now = now;
    this.#canUseCharacter = canUseCharacter;
  }

  #removeClaim(sessionId, { worldId, player }) {
    const room = this.#rooms.get(worldId);
    room.delete(player.characterId);
    if (room.size === 0) this.#rooms.delete(worldId);
    this.#sessions.delete(sessionId);
  }

  #rememberSequence(sessionId, seq, now) {
    this.#recentSequences.delete(sessionId);
    this.#recentSequences.set(sessionId, {
      seq,
      expiresAt: now + SEQUENCE_TTL_MS,
    });
    if (this.#recentSequences.size > RECENT_SESSION_LIMIT)
      this.#recentSequences.delete(this.#recentSequences.keys().next().value);
  }

  sweep(now = this.#now()) {
    for (const [sessionId, session] of this.#sessions) {
      if (session.expiresAt > now) break;
      this.#removeClaim(sessionId, session);
      this.#rememberSequence(sessionId, session.seq, now);
    }
    for (const [sessionId, { expiresAt }] of this.#recentSequences) {
      if (expiresAt > now) break;
      this.#recentSequences.delete(sessionId);
    }
  }

  #snapshot(room, ownId, reason) {
    const players = [];
    for (const sessionId of room?.values() ?? []) {
      if (sessionId !== ownId)
        players.push({ ...this.#sessions.get(sessionId).player });
    }
    return reason
      ? { players, accepted: false, reason }
      : { players, accepted: true };
  }

  findPlayer(worldId, sessionId) {
    this.sweep();
    const session = this.#sessions.get(sessionId);
    return session && session.worldId === worldId
      ? { ...session.player, claimId: session.claimId }
      : undefined;
  }

  playerForToken(worldId, sessionToken) {
    if (
      typeof sessionToken !== "string" ||
      !sessionTokenPattern.test(sessionToken)
    )
      return undefined;
    return this.findPlayer(worldId, publicSessionId(sessionToken));
  }

  update(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new StudioError("Invalid player update.");
    const {
      action,
      worldId,
      sessionToken,
      characterId,
      x,
      y,
      facing,
      moving,
      seq,
    } = input;
    const bounds =
      builtInBounds.get(worldId) ??
      (typeof worldId === "string" && guildIdPattern.test(worldId)
        ? guildBounds
        : null);
    if (
      !bounds ||
      typeof sessionToken !== "string" ||
      !sessionTokenPattern.test(sessionToken) ||
      !Number.isSafeInteger(seq) ||
      seq < 0 ||
      (action !== undefined && action !== "watch" && action !== "release") ||
      (action === undefined &&
        (typeof characterId !== "string" ||
          !characterIdPattern.test(characterId) ||
          !isCoordinate(x, bounds.width) ||
          !isCoordinate(y, bounds.height) ||
          (facing !== -1 && facing !== 1) ||
          typeof moving !== "boolean"))
    )
      throw new StudioError("Invalid player update.");

    const now = this.#now();
    this.sweep(now);
    const sessionId = publicSessionId(sessionToken);
    const snapshot = (reason) =>
      this.#snapshot(this.#rooms.get(worldId), sessionId, reason);
    if (action === "watch") return snapshot();

    const previous = this.#sessions.get(sessionId);
    const lastSeq = previous?.seq ?? this.#recentSequences.get(sessionId)?.seq;
    if (lastSeq !== undefined && seq <= lastSeq) return snapshot("stale");

    const sameRoom = previous?.worldId === worldId;
    // Even a rejected switch supersedes older poses without renewing the lease.
    if (previous) previous.seq = seq;
    else this.#rememberSequence(sessionId, seq, now);
    if (action === "release") {
      if (sameRoom) {
        this.#removeClaim(sessionId, previous);
        this.#rememberSequence(sessionId, seq, now);
      }
      return snapshot();
    }

    let room = this.#rooms.get(worldId);
    const owner = room?.get(characterId);
    if (owner && owner !== sessionId) return snapshot("taken");
    if (!this.#canUseCharacter(worldId, characterId))
      throw new StudioError("This character is unavailable in this town.", 404);
    if (!sameRoom && room?.size >= ROOM_LIMIT)
      throw new StudioError("This town is full. Try again shortly.", 429);
    if (!previous && this.#sessions.size >= SESSION_LIMIT)
      throw new StudioError("Multiplayer is full. Try again shortly.", 503);

    const sameClaim = sameRoom && previous.player.characterId === characterId;
    if (previous && !sameClaim) {
      this.#removeClaim(sessionId, previous);
      room = this.#rooms.get(worldId);
    }
    if (!room) {
      room = new Map();
      this.#rooms.set(worldId, room);
    }
    room.set(characterId, sessionId);
    // Keep entries ordered by expiration so sweeping stops at the first live one.
    this.#sessions.delete(sessionId);
    this.#sessions.set(sessionId, {
      worldId,
      seq,
      expiresAt: now + TTL_MS,
      claimId: sameClaim ? previous.claimId : Symbol(),
      player: { sessionId, characterId, x, y, facing, moving },
    });
    this.#recentSequences.delete(sessionId);
    return snapshot();
  }
}

function publicSessionId(sessionToken) {
  return createHash("sha256").update(sessionToken).digest("hex").slice(0, 32);
}
