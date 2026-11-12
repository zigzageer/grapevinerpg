import { randomBytes, randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { StudioError } from "./studio-store.mjs";
import { duelHit, simulateWar, startDuel } from "./match-combat.mjs";

const SIGNUP_MS = 120_000;
const OFFER_MS = 600_000;
const snowflake = (value) =>
  typeof value === "string" && /^\d{17,20}$/.test(value);
export const matchIdPattern = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const matchId = new RegExp(`^${matchIdPattern}$`);
const activeDeadline = (match) =>
  match.status === "offered"
    ? match.createdAt + OFFER_MS
    : match.status === "signup"
      ? match.joinUntil
      : null;

const invalid = (message, status = 400) => {
  throw new StudioError(message, status);
};

function fighter(character, guildId, userId) {
  const sprite =
    typeof character.sprite === "string" &&
    (character.sprite === `/games/${guildId}/${userId}.png` ||
      /^\/api\/studio\/assets\/[a-f0-9-]{36}\.png$/.test(character.sprite))
      ? character.sprite
      : null;
  const ability = character.ability?.name;
  return {
    id: randomUUID(),
    userId,
    name: character.name.slice(0, 28),
    sprite,
    ability:
      typeof ability === "string" && ability.trim()
        ? ability.trim().slice(0, 28)
        : "Power Strike",
    hp: 100,
    abilityUsed: false,
  };
}

export class MatchService {
  constructor({
    directory,
    loadGame,
    baseUrl,
    now = Date.now,
    seed = () => randomBytes(4).readUInt32LE(),
  }) {
    this.loadGame = loadGame;
    this.baseUrl = baseUrl;
    this.now = now;
    this.seed = seed;
    this.db = new DatabaseSync(path.join(directory, "server-matches.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS links(
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, character_id TEXT NOT NULL,
        PRIMARY KEY(guild_id, user_id), UNIQUE(guild_id, character_id)
      );
      CREATE TABLE IF NOT EXISTS matches(
        id TEXT PRIMARY KEY, deadline INTEGER, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS match_deadlines ON matches(deadline) WHERE deadline IS NOT NULL;
      CREATE TABLE IF NOT EXISTS match_requests(
        id TEXT PRIMARY KEY, hash TEXT NOT NULL, result TEXT NOT NULL
      );
    `);
  }

  close() {
    this.db.close();
  }

  transaction(run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  readMatch(id) {
    if (typeof id !== "string" || !matchId.test(id))
      invalid("Invalid match ID.");
    const row = this.db.prepare("SELECT data FROM matches WHERE id=?").get(id);
    if (!row) invalid("Match not found.", 404);
    return JSON.parse(row.data);
  }

  saveMatch(match) {
    this.db
      .prepare(
        "INSERT INTO matches VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET deadline=excluded.deadline,data=excluded.data",
      )
      .run(match.id, activeDeadline(match), JSON.stringify(match));
    return { matchId: match.id };
  }

  dueMatch(id) {
    const match = this.readMatch(id);
    const deadline = activeDeadline(match);
    if (deadline === null || deadline > this.now()) return match;
    return this.transaction(() => {
      const current = this.readMatch(id);
      const due = activeDeadline(current);
      if (due === null || due > this.now()) return current;
      if (current.status === "offered") {
        current.status = "cancelled";
        current.reason = "challenge-expired";
      } else if (
        current.sides.some(
          (side) => side.players.length < current.minPlayersPerSide,
        )
      ) {
        current.status = "cancelled";
        current.reason = "not-enough-players";
      } else simulateWar(current);
      this.saveMatch(current);
      return current;
    });
  }

  sweep() {
    const due = this.db
      .prepare(
        "SELECT id FROM matches WHERE deadline<=? ORDER BY deadline LIMIT 100",
      )
      .all(this.now());
    for (const { id } of due) this.dueMatch(id);
  }

  getMatch(id) {
    const { challengerUserId, opponentUserId, rng, sides, ...match } =
      this.dueMatch(id);
    return {
      ...match,
      sides: sides.map((side) => ({
        ...side,
        players: side.players.map(({ userId, ...player }) => player),
      })),
      replayUrl: new URL(`/wars/${id}`, this.baseUrl).href,
    };
  }

  getLink(guildId, userId) {
    if (!snowflake(guildId) || !snowflake(userId))
      invalid("Invalid server or member ID.");
    const row = this.db
      .prepare("SELECT character_id FROM links WHERE guild_id=? AND user_id=?")
      .get(guildId, userId);
    if (!row) invalid("Link your character with /game link first.", 404);
    return { guildId, userId, characterId: row.character_id };
  }

  linkedCharacter(game, userId) {
    const { characterId } = this.getLink(game.guildId, userId);
    const character = game.characters.find((c) => c.id === characterId);
    if (!character)
      invalid("That linked character is unavailable in this town.", 409);
    return character;
  }

  previous(id, hash) {
    const row = this.db
      .prepare("SELECT hash,result FROM match_requests WHERE id=?")
      .get(id);
    if (!row) return undefined;
    if (row.hash !== hash)
      invalid("That Discord interaction was already used.", 409);
    return JSON.parse(row.result);
  }

  async mutate(route, input, prepare, write) {
    if (![input.requestId, input.guildId, input.userId].every(snowflake))
      invalid("A Discord interaction, server, and member are required.");
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          route,
          Object.entries(input).sort(([a], [b]) => a.localeCompare(b)),
        ]),
      )
      .digest("hex");
    let result = this.previous(input.requestId, hash);
    if (!result) {
      const prepared = await prepare();
      result = this.transaction(() => {
        const existing = this.previous(input.requestId, hash);
        if (existing) return existing;
        const next = write(prepared);
        this.db
          .prepare("INSERT INTO match_requests VALUES(?,?,?)")
          .run(input.requestId, hash, JSON.stringify(next));
        return next;
      });
    }
    return result.matchId ? this.getMatch(result.matchId) : result;
  }

  link(input) {
    return this.mutate(
      "link",
      input,
      async () => {
        if (input.characterId !== `discord-${input.userId}`)
          invalid("Link the character created for you in this server.", 403);
        const game = await this.loadGame(input.guildId);
        if (!game.characters.some((c) => c.id === input.characterId))
          invalid(
            "Your character has not been added to this server’s game.",
            404,
          );
      },
      () => {
        const { guildId, userId, characterId } = input;
        this.db
          .prepare(
            "INSERT INTO links VALUES(?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET character_id=excluded.character_id",
          )
          .run(guildId, userId, characterId);
        return { guildId, userId, characterId };
      },
    );
  }

  challenge(input) {
    return this.mutate(
      "challenge",
      input,
      async () => {
        if (input.kind === "war") {
          if (input.manageGuild !== true)
            invalid("Manage Server is required to challenge a server.", 403);
          if (
            !snowflake(input.opponentGuildId) ||
            input.opponentGuildId === input.guildId
          )
            invalid("Choose another server with a game.");
          const minimum = input.minPlayersPerSide ?? 2;
          if (!Number.isInteger(minimum) || minimum < 1 || minimum > 24)
            invalid("Choose a minimum of 1–24 players per side.");
          return Promise.all([
            this.loadGame(input.guildId),
            this.loadGame(input.opponentGuildId),
          ]);
        }
        if (
          input.kind !== "duel" ||
          !snowflake(input.opponentUserId) ||
          input.opponentUserId === input.userId
        )
          invalid("Choose another member for this duel.");
        const game = await this.loadGame(input.guildId);
        this.linkedCharacter(game, input.userId);
        this.linkedCharacter(game, input.opponentUserId);
        return [game, game];
      },
      (games) =>
        this.saveMatch({
          id: randomUUID(),
          kind: input.kind,
          status: "offered",
          createdAt: this.now(),
          challengerUserId: input.userId,
          opponentUserId: input.kind === "duel" ? input.opponentUserId : null,
          minPlayersPerSide:
            input.kind === "war" ? (input.minPlayersPerSide ?? 2) : 1,
          joinUntil: null,
          sides: games.map(({ guildId, name }) => ({
            guildId,
            name,
            players: [],
          })),
          rng: this.seed(),
          turnFighterId: null,
          winnerSide: null,
          reason: null,
          events: [],
        }),
    );
  }

  act(id, input) {
    return this.mutate(
      `match:${id}`,
      input,
      async () => {
        const match = this.dueMatch(id);
        this.checkAction(match, input);
        if (
          input.action === "join" ||
          (input.action === "accept" && match.kind === "duel")
        )
          return this.loadGame(input.guildId);
        return null;
      },
      (game) => {
        const match = this.readMatch(id);
        const deadline = activeDeadline(match);
        if (deadline !== null && deadline <= this.now())
          invalid("The deadline for this action has passed.", 409);
        const side = this.checkAction(match, input);
        switch (input.action) {
          case "accept":
            if (match.kind === "war") {
              match.status = "signup";
              match.joinUntil = this.now() + SIGNUP_MS;
            } else {
              const users = [match.challengerUserId, match.opponentUserId];
              for (const [index, user] of users.entries())
                match.sides[index].players.push(
                  fighter(
                    this.linkedCharacter(game, user),
                    input.guildId,
                    user,
                  ),
                );
              startDuel(match);
            }
            break;
          case "decline":
            match.status = "cancelled";
            match.reason = "declined";
            break;
          case "join":
            if (
              !match.sides[side].players.some((p) => p.userId === input.userId)
            ) {
              match.sides[side].players.push(
                fighter(
                  this.linkedCharacter(game, input.userId),
                  input.guildId,
                  input.userId,
                ),
              );
            }
            break;
          case "attack":
          case "ability":
            duelHit(match, side, input.action === "ability");
            break;
        }
        return this.saveMatch(match);
      },
    );
  }

  checkAction(match, input) {
    const { guildId, userId, action, manageGuild } = input;
    if (action === "accept" || action === "decline") {
      if (
        guildId !== match.sides[1].guildId ||
        (match.kind === "war"
          ? manageGuild !== true
          : userId !== match.opponentUserId)
      )
        invalid("Only the challenged side can respond to this offer.", 403);
      if (match.status !== "offered") invalid("This offer is closed.", 409);
      return 1;
    }
    if (action === "join") {
      const side = match.sides.findIndex((team) => team.guildId === guildId);
      if (side < 0) invalid("This server is not in the match.", 403);
      if (match.kind !== "war" || match.status !== "signup")
        invalid("Signups are closed for this match.", 409);
      if (match.sides[1 - side].players.some((p) => p.userId === userId))
        invalid("You already joined the other side.", 409);
      return side;
    }
    if (action === "attack" || action === "ability") {
      if (match.kind !== "duel" || match.status !== "running")
        invalid("This duel is not taking turns.", 409);
      const side = match.sides.findIndex(
        (team) =>
          team.guildId === guildId && team.players[0]?.userId === userId,
      );
      if (side < 0) invalid("You are not in this duel.", 403);
      const actor = match.sides[side].players[0];
      if (match.turnFighterId !== actor.id)
        invalid("It is the other fighter’s turn.", 409);
      if (action === "ability" && actor.abilityUsed)
        invalid("You already used your signature ability.", 409);
      return side;
    }
    invalid("Unknown match action.");
  }
}
