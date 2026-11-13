import { createHash } from "node:crypto";
import { StudioError } from "./studio-store.mjs";

const TTL_MS = 14_000;
const ROOM_LIMIT = 64;
const SESSION_LIMIT = 2048;
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
  #now;
  #canUseCharacter;

  constructor({
    now = () => performance.now(),
    canUseCharacter = () => true,
  } = {}) {
    this.#now = now;
    this.#canUseCharacter = canUseCharacter;
  }

  #leaveRoom(worldId, sessionId) {
    const room = this.#rooms.get(worldId);
    room.delete(sessionId);
    if (room.size === 0) this.#rooms.delete(worldId);
  }

  sweep(now = this.#now()) {
    for (const [sessionId, { worldId, expiresAt }] of this.#sessions) {
      if (expiresAt > now) break;
      this.#sessions.delete(sessionId);
      this.#leaveRoom(worldId, sessionId);
    }
  }

  #snapshot(room, ownId) {
    const players = [];
    for (const sessionId of room) {
      if (sessionId !== ownId)
        players.push({ ...this.#sessions.get(sessionId).player });
    }
    return { players };
  }

  update(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new StudioError("Invalid player update.");
    const { worldId, sessionToken, characterId, x, y, facing, moving, seq } =
      input;
    const bounds =
      builtInBounds.get(worldId) ??
      (typeof worldId === "string" && guildIdPattern.test(worldId)
        ? guildBounds
        : null);
    if (
      !bounds ||
      typeof sessionToken !== "string" ||
      !sessionTokenPattern.test(sessionToken) ||
      typeof characterId !== "string" ||
      !characterIdPattern.test(characterId) ||
      !isCoordinate(x, bounds.width) ||
      !isCoordinate(y, bounds.height) ||
      (facing !== -1 && facing !== 1) ||
      typeof moving !== "boolean" ||
      !Number.isSafeInteger(seq) ||
      seq < 0
    )
      throw new StudioError("Invalid player update.");

    const now = this.#now();
    this.sweep(now);
    const sessionId = createHash("sha256")
      .update(sessionToken)
      .digest("hex")
      .slice(0, 32);
    const previous = this.#sessions.get(sessionId);
    const sameRoom = previous?.worldId === worldId;
    let room = this.#rooms.get(worldId);
    if (previous && seq <= previous.seq)
      return sameRoom ? this.#snapshot(room, sessionId) : { players: [] };
    if (!this.#canUseCharacter(worldId, characterId))
      throw new StudioError("This character is unavailable in this town.", 404);
    if (!sameRoom && room?.size >= ROOM_LIMIT)
      throw new StudioError("This town is full. Try again shortly.", 429);
    if (!previous && this.#sessions.size >= SESSION_LIMIT)
      throw new StudioError("Multiplayer is full. Try again shortly.", 503);

    if (previous && !sameRoom) this.#leaveRoom(previous.worldId, sessionId);
    if (!room) {
      room = new Set();
      this.#rooms.set(worldId, room);
    }
    room.add(sessionId);
    // Keep entries ordered by expiration so sweeping stops at the first live one.
    this.#sessions.delete(sessionId);
    this.#sessions.set(sessionId, {
      worldId,
      seq,
      expiresAt: now + TTL_MS,
      player: { sessionId, characterId, x, y, facing, moving },
    });
    return this.#snapshot(room, sessionId);
  }
}
