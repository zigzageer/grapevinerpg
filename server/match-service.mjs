import { randomBytes, randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { isStudioPng } from "../src/game/ability-moves.mjs";
import { StudioError } from "./studio-store.mjs";
import {
  builtInFightSprite,
  duelHit,
  simulateAutoFight,
  simulateWar,
  startDuel,
} from "./match-combat.mjs";

const SIGNUP_MS = 120_000;
const OFFER_MS = 600_000;
const FIGHT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const snowflake = (value) =>
  typeof value === "string" && /^\d{17,20}$/.test(value);
const validCharacterId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const canonicalCharacterId = (userId) => `discord-${userId}`;
const characterName = (character) => character.name.trim().slice(0, 28);
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

function fighter(character, guildId, userId, { auto = false } = {}) {
  const sprite =
    character.sprite === `/games/${guildId}/${userId}.png` ||
    isStudioPng(character.sprite)
      ? character.sprite
      : auto
        ? builtInFightSprite(character)
        : null;
  const ability = character.ability?.name;
  const hp = 100;
  return {
    id: randomUUID(),
    userId,
    name: auto ? characterName(character) : character.name.slice(0, 28),
    sprite,
    ability:
      typeof ability === "string" && ability.trim()
        ? ability.trim().slice(0, 28)
        : "Power Strike",
    hp,
    ...(auto ? { startingHp: hp } : {}),
    abilityUsed: false,
  };
}

function fighterSelection(userId, character, enabled) {
  return {
    userId,
    characterId: character?.id ?? null,
    name: character ? characterName(character) : null,
    enabled,
  };
}

function defaultFightCharacter(choices, userId, preference) {
  return (
    choices.find(({ id }) => id === preference?.character_id) ??
    choices.find(({ id }) => id === canonicalCharacterId(userId)) ??
    (choices.length === 1 ? choices[0] : undefined)
  );
}

export class MatchService {
  constructor({
    directory,
    loadGame,
    baseUrl,
    grapevineGuildId,
    now = Date.now,
    seed = () => randomBytes(4).readUInt32LE(),
  }) {
    this.loadGame = loadGame;
    this.baseUrl = baseUrl;
    this.grapevineGuildId = grapevineGuildId;
    this.now = now;
    this.seed = seed;
    this.db = new DatabaseSync(path.join(directory, "server-matches.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      PRAGMA foreign_keys=ON;
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
      CREATE TABLE IF NOT EXISTS fight_characters(
        guild_id TEXT NOT NULL, character_id TEXT NOT NULL, user_id TEXT NOT NULL,
        PRIMARY KEY(guild_id, character_id)
      );
      CREATE INDEX IF NOT EXISTS fight_character_owners ON fight_characters(guild_id, user_id);
      CREATE TABLE IF NOT EXISTS fight_preferences(
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, character_id TEXT NOT NULL,
        name TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
        PRIMARY KEY(guild_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS auto_fights(
        match_id TEXT PRIMARY KEY REFERENCES matches(id), guild_id TEXT NOT NULL,
        first_user_id TEXT NOT NULL, first_name TEXT NOT NULL,
        second_user_id TEXT NOT NULL, second_name TEXT NOT NULL,
        winner_user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
        awarded INTEGER NOT NULL CHECK(awarded IN (0,1)),
        CHECK(first_user_id < second_user_id),
        CHECK(winner_user_id IN (first_user_id, second_user_id))
      );
      CREATE INDEX IF NOT EXISTS auto_fight_pair_awards
        ON auto_fights(first_user_id, second_user_id, created_at) WHERE awarded=1;
      CREATE INDEX IF NOT EXISTS auto_fight_guild ON auto_fights(guild_id);
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

  async loadFightRoster(guildId) {
    if (!snowflake(guildId)) invalid("Invalid server ID.");
    let game;
    let legacy;
    if (guildId === this.grapevineGuildId) {
      const optionalGame = async (id) => {
        try {
          return await this.loadGame(id);
        } catch (error) {
          if (!(error instanceof StudioError && error.status === 404))
            throw error;
          return null;
        }
      };
      [game, legacy] = await Promise.all([
        optionalGame(guildId),
        optionalGame("mint"),
      ]);
      if (!game && !legacy) invalid("This town has not been created yet.", 404);
    } else {
      game = await this.loadGame(guildId);
    }
    const characters = new Map();
    for (const roster of [legacy, game]) {
      for (const character of roster?.characters ?? []) {
        if (
          validCharacterId(character?.id) &&
          typeof character.name === "string" &&
          character.name.trim()
        )
          characters.set(character.id, character);
      }
    }
    return { name: game?.name ?? "Grapevine", characters };
  }

  fighterPreference(guildId, userId) {
    return this.db
      .prepare(
        "SELECT character_id,name,enabled FROM fight_preferences WHERE guild_id=? AND user_id=?",
      )
      .get(guildId, userId);
  }

  fightOwner(guildId, characterId) {
    const canonical = /^discord-(\d{17,20})$/.exec(characterId);
    if (canonical) return canonical[1];
    return this.db
      .prepare(
        "SELECT user_id FROM fight_characters WHERE guild_id=? AND character_id=?",
      )
      .get(guildId, characterId)?.user_id;
  }

  async listFighters(guildId) {
    const { characters } = await this.loadFightRoster(guildId);
    return {
      characters: [...characters.values()]
        .map((character) => ({
          id: character.id,
          name: characterName(character),
        }))
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        ),
    };
  }

  fightChoices(guildId, userId, characters) {
    const owned = this.db
      .prepare(
        "SELECT character_id FROM fight_characters WHERE guild_id=? AND user_id=? ORDER BY character_id",
      )
      .all(guildId, userId);
    return [
      canonicalCharacterId(userId),
      ...owned.map((row) => row.character_id),
    ]
      .map((id) => characters.get(id))
      .filter(Boolean);
  }

  async getFighter(guildId, userId) {
    if (!snowflake(userId)) invalid("Invalid member ID.");
    const { characters } = await this.loadFightRoster(guildId);
    const choices = this.fightChoices(guildId, userId, characters);
    const preference = this.fighterPreference(guildId, userId);
    const current = defaultFightCharacter(choices, userId, preference);
    return {
      ...fighterSelection(
        userId,
        current,
        preference?.enabled === 1 && preference.character_id === current?.id,
      ),
      choices: choices.map((character) => ({
        id: character.id,
        name: characterName(character),
      })),
    };
  }

  updateFighter(input) {
    const { action, guildId, userId, memberId, characterId } = input;
    return this.mutate(
      "fighter",
      input,
      async () => {
        if (action === "assign") {
          if (input.manageGuild !== true)
            invalid("Manage Server is required to assign fighters.", 403);
          if (!snowflake(memberId) || !validCharacterId(characterId))
            invalid("Choose a server member and a character.");
        } else if (action === "set" || action === "pause") {
          if (memberId !== undefined && memberId !== userId)
            invalid("Members can only change their own fight settings.", 403);
          if (action === "pause") return null;
          if (characterId !== undefined && !validCharacterId(characterId))
            invalid("Choose a valid character.");
        } else {
          invalid("Unknown fighter action.");
        }
        return this.loadFightRoster(guildId);
      },
      (roster) => {
        const fighterUser = action === "assign" ? memberId : userId;
        const preference = this.fighterPreference(guildId, fighterUser);
        if (action === "pause") {
          this.db
            .prepare(
              "UPDATE fight_preferences SET enabled=0 WHERE guild_id=? AND user_id=?",
            )
            .run(guildId, userId);
          const selected = preference && {
            id: preference.character_id,
            name: preference.name,
          };
          return fighterSelection(userId, selected, false);
        }

        const character =
          characterId === undefined
            ? defaultFightCharacter(
                this.fightChoices(guildId, userId, roster.characters),
                userId,
                preference,
              )
            : roster.characters.get(characterId);
        if (!character && characterId === undefined)
          invalid(
            "Choose one of your assigned characters to enable fights.",
            404,
          );
        if (!character)
          invalid("That character is unavailable in this server.", 404);
        const selected = character.id;
        const owner = this.fightOwner(guildId, selected);
        if (action === "assign") {
          if (owner && owner !== fighterUser)
            invalid("That character already belongs to another member.", 409);
          if (!owner)
            this.db
              .prepare("INSERT INTO fight_characters VALUES(?,?,?)")
              .run(guildId, selected, fighterUser);
          return fighterSelection(
            fighterUser,
            character,
            Boolean(
              preference?.character_id === selected && preference.enabled,
            ),
          );
        }

        if (owner !== userId)
          invalid("Choose a character assigned to you in this server.", 403);
        this.db
          .prepare(
            `
          INSERT INTO fight_preferences VALUES(?,?,?,?,1)
          ON CONFLICT(guild_id,user_id) DO UPDATE SET
            character_id=excluded.character_id, name=excluded.name, enabled=1
        `,
          )
          .run(guildId, userId, selected, characterName(character));
        return fighterSelection(userId, character, true);
      },
    );
  }

  async fight(input) {
    const { guildId, userId, opponentUserId } = input;
    const { fightId } = await this.mutate(
      "fight",
      input,
      async () => {
        if (!snowflake(opponentUserId) || opponentUserId === userId)
          invalid("Choose another member for this fight.");
        return this.loadFightRoster(guildId);
      },
      (roster) => {
        const players = [userId, opponentUserId];
        const characters = players.map((id) => {
          const preference = this.fighterPreference(guildId, id);
          if (!preference?.enabled)
            invalid(
              id === userId
                ? "Enable your fighter with /fighter set first."
                : "That member has not enabled fights in this server.",
              409,
            );
          const character = roster.characters.get(preference.character_id);
          if (!character || this.fightOwner(guildId, character.id) !== id)
            invalid("A selected fighter is unavailable in this server.", 409);
          return character;
        });
        const match = {
          id: randomUUID(),
          kind: "duel",
          mode: "auto",
          status: "running",
          createdAt: this.now(),
          minPlayersPerSide: 1,
          joinUntil: null,
          sides: players.map((id, index) => ({
            guildId,
            name: roster.name,
            players: [fighter(characters[index], guildId, id, { auto: true })],
          })),
          rng: this.seed(),
          turnFighterId: null,
          winnerSide: null,
          reason: null,
          events: [],
        };
        simulateAutoFight(match, characters);
        this.saveMatch(match);

        const [first, second] = match.sides.map(({ players }) => players[0]);
        const [low, high] =
          first.userId < second.userId ? [first, second] : [second, first];
        const recent = this.db
          .prepare(
            `
          SELECT 1 FROM auto_fights
          WHERE first_user_id=? AND second_user_id=? AND created_at>? AND awarded=1
          LIMIT 1
        `,
          )
          .get(low.userId, high.userId, match.createdAt - FIGHT_COOLDOWN_MS);
        this.db
          .prepare("INSERT INTO auto_fights VALUES(?,?,?,?,?,?,?,?,?)")
          .run(
            match.id,
            guildId,
            low.userId,
            low.name,
            high.userId,
            high.name,
            players[match.winnerSide],
            match.createdAt,
            recent ? 0 : 1,
          );
        return { fightId: match.id };
      },
    );
    return this.getAutoFight(fightId);
  }

  getAutoFight(id) {
    if (typeof id !== "string" || !matchId.test(id))
      invalid("Fight not found.", 404);
    const score = this.db
      .prepare(
        "SELECT awarded,winner_user_id AS winnerUserId FROM auto_fights WHERE match_id=?",
      )
      .get(id);
    if (!score) invalid("Fight not found.", 404);
    return { match: this.getMatch(id), score: { ...score } };
  }

  leaderboard(guildId) {
    if (guildId !== undefined && !snowflake(guildId))
      invalid("Invalid server ID.");
    const entries = this.db
      .prepare(
        `
      WITH fights AS (
        SELECT rowid AS fight_number, * FROM auto_fights ${guildId ? "WHERE guild_id=?" : ""}
      ), results AS (
        SELECT fight_number, created_at, first_user_id AS user_id, first_name AS name,
          first_user_id=winner_user_id AS won, awarded FROM fights
        UNION ALL
        SELECT fight_number, created_at, second_user_id AS user_id, second_name AS name,
          second_user_id=winner_user_id AS won, awarded FROM fights
      ), totals AS (
        SELECT user_id, name,
          SUM(won) OVER (PARTITION BY user_id) AS wins,
          SUM(1-won) OVER (PARTITION BY user_id) AS losses,
          SUM(won*awarded) OVER (PARTITION BY user_id) AS points,
          ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC, fight_number DESC
          ) AS recency
        FROM results
      )
      SELECT RANK() OVER (ORDER BY points DESC) AS rank,
        user_id AS userId, name, wins, losses, points
      FROM totals WHERE recency=1
      ORDER BY rank, wins DESC, losses, userId LIMIT 10
    `,
      )
      .all(...(guildId ? [guildId] : []));
    return { entries: entries.map((entry) => ({ ...entry })) };
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
