import { DatabaseSync } from "node:sqlite";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID, createHash, createHmac, randomBytes } from "node:crypto";

export class StudioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const assetUrl = (id) => `/api/studio/assets/${id}.png`;
const MINT_CREW_LIMIT = 40;
const SERVER_CREW_LIMIT = 24;
const crewLimit = (gameId) =>
  gameId === "mint" ? MINT_CREW_LIMIT : SERVER_CREW_LIMIT;
const now = () => new Date().toISOString();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export class StudioStore {
  constructor({ directory, seed }) {
    this.directory = directory;
    mkdirSync(path.join(directory, "images"), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(directory, "characters.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS characters(
        game_id TEXT NOT NULL REFERENCES games(id), id TEXT NOT NULL,
        data TEXT NOT NULL, visible INTEGER NOT NULL DEFAULT 1,
        current_version TEXT, managed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        PRIMARY KEY(game_id,id)
      );
      CREATE TABLE IF NOT EXISTS versions(
        id TEXT PRIMARY KEY, game_id TEXT NOT NULL, character_id TEXT NOT NULL,
        character TEXT NOT NULL, description TEXT NOT NULL, image TEXT,
        source TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY(game_id,character_id) REFERENCES characters(game_id,id)
      );
      CREATE TABLE IF NOT EXISTS jobs(
        id TEXT PRIMARY KEY, game_id TEXT NOT NULL, character_id TEXT NOT NULL,
        ip_hash TEXT, source TEXT NOT NULL, status TEXT NOT NULL,
        payload TEXT NOT NULL, request_hash TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS active_character_job ON jobs(game_id,character_id)
        WHERE status IN ('queued','running');
    `);
    // Keep the existing salt so saved jobs and drafts can still be reopened.
    this.db
      .prepare("INSERT OR IGNORE INTO settings VALUES('quota_salt',?)")
      .run(randomBytes(32).toString("hex"));
    this.ownerSalt = this.db
      .prepare("SELECT value FROM settings WHERE key='quota_salt'")
      .get().value;
    if (seed) this.addMintRoster(seed);
  }

  addMintRoster(seed) {
    const characters = seed?.characters;
    if (
      !Array.isArray(characters) ||
      !characters.length ||
      characters.length > MINT_CREW_LIMIT ||
      new Set(characters.map((character) => character?.id)).size !==
        characters.length ||
      characters.some(
        (character) =>
          !character ||
          typeof character.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(character.id) ||
          typeof character.name !== "string" ||
          !character.name.trim() ||
          character.name.length > 28,
      ) ||
      (seed.descriptions !== undefined &&
        (!seed.descriptions ||
          typeof seed.descriptions !== "object" ||
          Array.isArray(seed.descriptions) ||
          Object.values(seed.descriptions).some(
            (value) => typeof value !== "string",
          )))
    )
      throw new StudioError("The published Mint roster could not be read.");

    this.update(
      "mint",
      (game) => {
        const additions = characters
          .filter((character) => !this.character("mint", character.id))
          .slice(0, Math.max(0, MINT_CREW_LIMIT - (game?.characters.length || 0)));
        if (game && !additions.length) return game;
        return {
          ...(game || {
            version: 1,
            guildId: "mint",
            slug: "",
            name: "Adventures of Mint",
            updatedAt: now(),
          }),
          characters: [...(game?.characters || []), ...additions],
        };
      },
      { descriptions: seed.descriptions },
    );
  }

  transaction(task) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = task();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  character(gameId, id) {
    return this.db
      .prepare("SELECT * FROM characters WHERE game_id=? AND id=?")
      .get(gameId, id);
  }

  read(gameId) {
    const game = this.db
      .prepare("SELECT metadata FROM games WHERE id=?")
      .get(gameId);
    if (!game) return null;
    const characters = this.db
      .prepare(
        "SELECT data FROM characters WHERE game_id=? AND visible=1 ORDER BY rowid",
      )
      .all(gameId);
    const managedRows = this.db
      .prepare(
        "SELECT id,current_version FROM characters WHERE game_id=? AND managed=1 AND visible=1",
      )
      .all(gameId);
    return {
      ...JSON.parse(game.metadata),
      managedIds: managedRows.map((row) => row.id),
      managedVersions: Object.fromEntries(
        managedRows.map((row) => [row.id, row.current_version]),
      ),
      characters: characters.map((row) => JSON.parse(row.data)),
    };
  }

  importManifest(gameId, game) {
    if (
      !game ||
      game.version !== 1 ||
      game.guildId !== gameId ||
      typeof game.name !== "string" ||
      !game.name.trim() ||
      typeof game.slug !== "string" ||
      !/^[a-z0-9-]+$/.test(game.slug) ||
      !game.slug.endsWith(`-${gameId}`) ||
      !Number.isFinite(Date.parse(game.updatedAt)) ||
      (game.town !== undefined &&
        game.town?.path !== `/games/${gameId}/town.json`) ||
      !Array.isArray(game.characters) ||
      game.characters.length > SERVER_CREW_LIMIT ||
      new Set(game.characters.map((character) => character?.id)).size !==
        game.characters.length ||
      game.characters.some(
        (character) =>
          !character ||
          !/^discord-\d{17,20}$/.test(character.id) ||
          typeof character.name !== "string" ||
          !character.name.trim() ||
          character.sprite !== `/games/${gameId}/${character.id.slice(8)}.png`,
      )
    )
      throw new StudioError("This town’s published roster could not be read.");
    const key = `manifest:${gameId}`;
    const hash = createHash("sha256")
      .update(JSON.stringify(game))
      .digest("hex");
    if (
      this.db.prepare("SELECT value FROM settings WHERE key=?").get(key)
        ?.value === hash
    )
      return this.read(gameId);
    const current = this.read(gameId);
    const characters = new Map(
      (current?.characters || []).map((character) => [character.id, character]),
    );
    for (const character of game.characters) {
      if (!this.character(gameId, character.id)?.managed)
        characters.set(character.id, character);
    }
    if (characters.size > SERVER_CREW_LIMIT)
      throw new StudioError(
        `This town already has ${SERVER_CREW_LIMIT} characters.`,
        409,
      );
    const result = this.update(gameId, () => ({
      ...game,
      slug: current?.slug || game.slug,
      characters: [...characters.values()],
    }));
    this.db
      .prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, hash);
    return result.game;
  }

  touch(gameId) {
    const row = this.db
      .prepare("SELECT metadata FROM games WHERE id=?")
      .get(gameId);
    const metadata = JSON.parse(row.metadata);
    metadata.updatedAt = new Date(
      Math.max(Date.now(), Date.parse(metadata.updatedAt) + 1 || 0),
    ).toISOString();
    this.db
      .prepare("UPDATE games SET metadata=? WHERE id=?")
      .run(JSON.stringify(metadata), gameId);
  }

  addVersion(
    gameId,
    character,
    {
      image = character.sprite ||
        (character.kind === "mint"
          ? "/characters/mint.png"
          : character.preset
            ? `/characters/${character.preset}.png`
            : null),
      description = "",
      source = "website",
      id = randomUUID(),
    } = {},
  ) {
    this.db
      .prepare("INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)")
      .run(
        id,
        gameId,
        character.id,
        JSON.stringify(character),
        description,
        image,
        source,
        now(),
      );
    return { id, character, image, description, source };
  }

  update(gameId, change, { descriptions = {} } = {}) {
    return this.transaction(() => {
      const current = this.read(gameId);
      const next = change(current);
      if (next === current)
        return { game: current, commit: null, deployment: { state: "READY" } };
      if (next.guildId !== gameId)
        throw new StudioError("Server ID cannot change.");
      const { characters, ...metadata } = next;
      this.db
        .prepare(
          "INSERT INTO games VALUES(?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata",
        )
        .run(gameId, JSON.stringify(metadata));
      for (const character of characters) {
        if (!this.character(gameId, character.id)) {
          this.db
            .prepare(
              "INSERT INTO characters(game_id,id,data,created_at) VALUES(?,?,?,?)",
            )
            .run(gameId, character.id, JSON.stringify(character), now());
          const version = this.addVersion(gameId, character, {
            source: "original",
            description: descriptions[character.preset] || "",
          });
          this.db
            .prepare(
              "UPDATE characters SET current_version=? WHERE game_id=? AND id=?",
            )
            .run(version.id, gameId, character.id);
        }
        this.db
          .prepare(
            "UPDATE characters SET data=?, visible=1 WHERE game_id=? AND id=?",
          )
          .run(JSON.stringify(character), gameId, character.id);
      }
      this.touch(gameId);
      return {
        game: this.read(gameId),
        commit: `saved-${randomUUID()}`,
        deployment: { state: "READY" },
      };
    });
  }

  hashIp(ip) {
    return createHmac("sha256", this.ownerSalt).update(ip).digest("hex");
  }

  enqueue({
    id,
    gameId,
    character,
    ipHash = null,
    payload,
    source = "website",
  }) {
    return this.transaction(() => {
      const requestHash = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      const previous = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (previous) {
        if (
          previous.ip_hash !== ipHash ||
          previous.game_id !== gameId ||
          previous.character_id !== character.id ||
          previous.source !== source ||
          previous.request_hash !== requestHash
        )
          throw new StudioError(
            "That request ID has already been used. Start a new generation.",
            409,
          );
        return this.job(id, ipHash);
      }
      const row = this.character(gameId, character.id);
      const baseVersionId = payload.referenceVersionId || row?.current_version;
      const baseVersion = baseVersionId
        ? this.version(gameId, character.id, baseVersionId)
        : null;
      if (payload.abilityOnly && !baseVersion)
        throw new StudioError(
          "Choose a saved character version for this ability.",
        );
      const baseCharacter = row
        ? JSON.parse(
            baseVersion && baseVersion.id !== row.current_version
              ? baseVersion.character
              : row.data,
          )
        : character;
      if (
        this.db
          .prepare(
            "SELECT id FROM jobs WHERE game_id=? AND character_id=? AND status IN ('queued','running')",
          )
          .get(gameId, character.id)
      )
        throw new StudioError(
          "This character is already being generated. Wait for it to finish.",
          409,
        );
      const disk = statfsSync(this.directory);
      if (disk.bavail * disk.bsize < 8_000_000)
        throw new StudioError(
          "Character storage is temporarily full. Please try later.",
          503,
        );
      if (!row) {
        const limit = crewLimit(gameId);
        const count = this.db
          .prepare(
            "SELECT COUNT(*) AS count FROM characters c WHERE game_id=? AND (visible=1 OR EXISTS(SELECT 1 FROM jobs j WHERE j.game_id=c.game_id AND j.character_id=c.id AND j.status IN ('queued','running')))",
          )
          .get(gameId).count;
        if (count >= limit)
          throw new StudioError(
            `This town already has ${limit} characters.`,
            409,
          );
        this.db
          .prepare(
            "INSERT INTO characters(game_id,id,data,visible,created_at) VALUES(?,?,?,0,?)",
          )
          .run(gameId, character.id, JSON.stringify(character), now());
      }
      this.db
        .prepare(
          "INSERT INTO jobs(id,game_id,character_id,ip_hash,source,status,payload,request_hash,created_at) VALUES(?,?,?,?,?,'queued',?,?,?)",
        )
        .run(
          id,
          gameId,
          character.id,
          ipHash,
          source,
          JSON.stringify({ ...payload, baseVersionId, baseCharacter }),
          requestHash,
          now(),
        );
      return this.job(id, ipHash);
    });
  }

  job(id, ipHash) {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
    if (!row || row.ip_hash !== ipHash)
      throw new StudioError("Generation not found.", 404);
    return {
      id: row.id,
      gameId: row.game_id,
      characterId: row.character_id,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : null,
      error: row.error,
    };
  }

  nextJob() {
    return this.db
      .prepare(
        "SELECT * FROM jobs WHERE status='queued' ORDER BY rowid LIMIT 1",
      )
      .get();
  }

  startJob(id) {
    const result = this.db
      .prepare(
        "UPDATE jobs SET status='running' WHERE id=? AND status='queued'",
      )
      .run(id);
    return result.changes === 1;
  }

  finishGeneration(job, { character, bytes, description, image, ability }) {
    const files = [];
    try {
      return this.transaction(() => {
        let snapshot = character;
        if (bytes) {
          files.push(this.saveImage(job.id, bytes));
          image = assetUrl(job.id);
          snapshot = { ...snapshot, sprite: image, preset: undefined };
        }
        if (ability) {
          const id = randomUUID();
          files.push(this.saveImage(id, ability.bytes));
          snapshot = {
            ...snapshot,
            ability: {
              name: ability.name,
              description: ability.description,
              style: ability.style,
              art: assetUrl(id),
            },
          };
        }
        const version = this.addVersion(job.game_id, snapshot, {
          description,
          image,
          id: job.id,
        });
        const result = {
          character: version.character,
          versionId: version.id,
          image: version.image,
        };
        this.finishJob(job.id, result);
        return result;
      });
    } catch (error) {
      for (const file of files) rmSync(file, { force: true });
      throw error;
    }
  }

  finishJob(id, result) {
    this.db
      .prepare("UPDATE jobs SET status='succeeded',result=? WHERE id=?")
      .run(JSON.stringify(result), id);
    this.clearUpload(id);
  }

  failJob(id, message) {
    this.db
      .prepare("UPDATE jobs SET status='failed',error=? WHERE id=?")
      .run(message, id);
    this.clearUpload(id);
  }

  clearUpload(id) {
    const row = this.db.prepare("SELECT payload FROM jobs WHERE id=?").get(id);
    const payload = JSON.parse(row.payload);
    if (payload.image) {
      delete payload.image;
      this.db
        .prepare("UPDATE jobs SET payload=? WHERE id=?")
        .run(JSON.stringify(payload), id);
    }
  }

  recoverJobs() {
    this.db
      .prepare(
        "UPDATE jobs SET status='failed',error='The worker restarted during generation. Your previous character and saved history are available.' WHERE status='running'",
      )
      .run();
  }

  drafts(gameId, ipHash) {
    return this.db
      .prepare(
        "SELECT c.id,c.data FROM characters c WHERE c.game_id=? AND c.visible=0 AND EXISTS(SELECT 1 FROM jobs j WHERE j.game_id=c.game_id AND j.character_id=c.id AND j.ip_hash=?) ORDER BY c.rowid DESC",
      )
      .all(gameId, ipHash)
      .map((row) => {
        const version = this.db
          .prepare(
            "SELECT character FROM versions WHERE game_id=? AND character_id=? ORDER BY rowid DESC LIMIT 1",
          )
          .get(gameId, row.id);
        return JSON.parse(version?.character || row.data);
      });
  }

  history(gameId, characterId) {
    const character = this.character(gameId, characterId);
    if (!character) throw new StudioError("Character not found.", 404);
    const versions = this.db
      .prepare(
        "SELECT * FROM versions WHERE game_id=? AND character_id=? ORDER BY rowid DESC",
      )
      .all(gameId, characterId);
    return {
      currentVersionId: character.current_version,
      versions: versions.map((row) => ({
        id: row.id,
        character: JSON.parse(row.character),
        description: row.description,
        image: row.image,
        source: row.source,
        createdAt: row.created_at,
      })),
    };
  }

  version(gameId, characterId, versionId) {
    const row = this.db
      .prepare(
        "SELECT * FROM versions WHERE id=? AND game_id=? AND character_id=?",
      )
      .get(versionId, gameId, characterId);
    if (!row) throw new StudioError("Character version not found.", 404);
    return row;
  }

  apply(gameId, characterId, versionId) {
    return this.transaction(() => {
      const version = this.version(gameId, characterId, versionId);
      const limit = crewLimit(gameId);
      if (
        !this.character(gameId, characterId).visible &&
        this.read(gameId).characters.length >= limit
      )
        throw new StudioError(
          `This town already has ${limit} characters. Your generation is saved in history.`,
          409,
        );
      this.db
        .prepare(
          "UPDATE characters SET data=?,current_version=?,visible=1,managed=1 WHERE game_id=? AND id=?",
        )
        .run(version.character, versionId, gameId, characterId);
      this.touch(gameId);
      return this.read(gameId);
    });
  }

  saveImage(id, bytes) {
    if (!uuid.test(id)) throw new StudioError("Invalid image ID.");
    const file = path.join(this.directory, "images", `${id}.png`);
    const handle = openSync(file, "wx", 0o600);
    try {
      try {
        writeFileSync(handle, bytes);
      } finally {
        closeSync(handle);
      }
    } catch (error) {
      rmSync(file, { force: true });
      throw error;
    }
    return file;
  }

  image(id) {
    if (!uuid.test(id)) throw new StudioError("Invalid image ID.", 404);
    const file = path.join(this.directory, "images", `${id}.png`);
    if (!existsSync(file)) throw new StudioError("Image not found.", 404);
    return readFileSync(file);
  }

  backupOriginal(version, bytes, preserveCharacter = false) {
    if (version.image?.startsWith("/api/studio/assets/")) return;
    const image = assetUrl(version.id);
    this.saveImage(version.id, bytes);
    // An ability-only edit keeps the character's built-in rendering layout.
    const snapshot = preserveCharacter
      ? version.character
      : JSON.stringify({
          ...JSON.parse(version.character),
          sprite: image,
          preset: undefined,
        });
    this.db
      .prepare("UPDATE versions SET image=?,character=? WHERE id=?")
      .run(image, snapshot, version.id);
  }

  close() {
    this.db.close();
  }
}
