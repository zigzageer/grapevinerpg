import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { StudioError } from "./studio-store.mjs";
import { GameService } from "../bot/game-service.mjs";
import { validateReference } from "../bot/image-generator.mjs";

export const validGameId = (id) => id === "mint" || /^\d{17,20}$/.test(id);
const validId = (id) =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const validRequest = (id) =>
  typeof id === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);

export class StudioService {
  constructor({ store, generate, baseUrl, fetch: request = globalThis.fetch }) {
    this.store = store;
    this.generate = generate;
    this.baseUrl = baseUrl;
    this.fetch = request;
    this.running = false;
    this.closing = false;
    this.discord = new GameService({ store, generate, baseUrl });
    store.recoverJobs();
  }

  ipHash(ip) {
    return this.store.hashIp(ip);
  }
  quota(ip) {
    return this.store.quota(this.ipHash(ip));
  }

  game(id) {
    if (!validGameId(id)) throw new StudioError("Invalid game ID.");
    const game = this.store.read(id);
    if (!game)
      throw new StudioError("This town has not been created yet.", 404);
    return game;
  }

  async enqueue(input, ip) {
    const { gameId, characterId, requestId } = input;
    this.game(gameId);
    if (!validRequest(requestId))
      throw new StudioError("Start a new generation request.");
    if (characterId !== undefined && !validId(characterId))
      throw new StudioError("Invalid character ID.");
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 28)
      throw new StudioError("Choose a character name with 1–28 characters.");
    if (
      typeof input.description !== "string" ||
      input.description.length > 1000
    )
      throw new StudioError("Keep appearance details under 1,000 characters.");
    let character;
    if (characterId) {
      const row = this.store.character(gameId, characterId);
      if (!row) throw new StudioError("Character not found.", 404);
      character = JSON.parse(row.data);
    } else {
      const template = this.game("mint").characters.find(
        (c) => c.kind !== "mint",
      );
      character = {
        ...template,
        id: `web-${requestId}`,
        name,
        kind: "human",
        preset: undefined,
        sprite: undefined,
      };
    }
    if (
      input.referenceVersionId &&
      (!characterId || !validRequest(input.referenceVersionId))
    )
      throw new StudioError("Invalid reference version.");
    if (input.referenceVersionId)
      this.store.version(gameId, characterId, input.referenceVersionId);
    const payload = {
      name,
      description: input.description.trim(),
      useCurrent: Boolean(input.useCurrent),
      ...(input.referenceVersionId
        ? { referenceVersionId: input.referenceVersionId }
        : {}),
    };
    if (input.image !== undefined) {
      const image = input.image;
      if (
        !image ||
        !["image/png", "image/jpeg", "image/webp"].includes(image.type) ||
        typeof image.base64 !== "string" ||
        image.base64.length > 2_800_000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)
      )
        throw new StudioError(
          "Upload a PNG, JPEG, or WebP reference smaller than 2 MB.",
        );
      const bytes = Buffer.from(image.base64, "base64");
      try {
        await validateReference(bytes, image.type);
      } catch {
        throw new StudioError(
          "That reference image could not be opened. Choose a PNG, JPEG, or WebP image.",
        );
      }
      payload.image = image;
    }
    const result = this.store.enqueue({
      id: requestId,
      gameId,
      character,
      ipHash: this.ipHash(ip),
      payload,
    });
    void this.drain();
    return result;
  }

  async currentReference(job, payload) {
    const row = this.store.character(job.game_id, job.character_id);
    const versionId = payload.referenceVersionId || row.current_version;
    if (!versionId) return null;
    const version = this.store.version(
      job.game_id,
      job.character_id,
      versionId,
    );
    if (!version.image) return null;
    if (version.image.startsWith("/api/studio/assets/"))
      return { bytes: this.store.image(version.id), type: "image/png" };
    if (
      !/^\/characters\/[a-z0-9-]+\.png$/.test(version.image) &&
      !/^\/games\/\d{17,20}\/\d{17,20}\.png$/.test(version.image)
    )
      throw new StudioError(
        "The current character reference could not be loaded.",
      );
    const response = await this.fetch(new URL(version.image, this.baseUrl), {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 10_000_000
    )
      throw new StudioError(
        "The current character reference could not be loaded. Try an uploaded reference.",
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    await validateReference(bytes, "image/png");
    const png = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .png()
      .toBuffer();
    this.store.backupOriginal(version, png);
    return { bytes: png, type: "image/png" };
  }

  async drain() {
    if (this.running || this.closing) return;
    this.running = true;
    try {
      for (
        let job = this.store.nextJob();
        job && !this.closing;
        job = this.store.nextJob()
      ) {
        this.store.startJob(job.id);
        try {
          const payload = JSON.parse(job.payload);
          if (job.source === "discord") {
            const result = await this.discord.add(payload);
            this.store.finishJob(job.id, result);
          } else {
            const references = [];
            // Preserve an original snapshot even when it is excluded from the prompt.
            const original = await this.currentReference(job, payload);
            if (payload.useCurrent && original) references.push(original);
            if (payload.image)
              references.push({
                bytes: Buffer.from(payload.image.base64, "base64"),
                type: payload.image.type,
              });
            const bytes = await this.generate({
              name: payload.name,
              description: payload.description,
              references,
            });
            this.store.finishGeneration(job, bytes, payload.description);
          }
        } catch (error) {
          const message =
            error instanceof StudioError
              ? error.message
              : "Character generation could not finish. Your previous character and saved history are available.";
          this.store.failJob(job.id, message);
          console.error("[studio] Generation failed.");
        }
      }
    } finally {
      this.running = false;
    }
  }

  async enqueueDiscord(input) {
    const game = this.game(input.guildId);
    if (!/^\d{17,20}$/.test(input.userId))
      throw new StudioError("Invalid Discord member.");
    if (game.characters.some((c) => c.id === `discord-${input.userId}`))
      throw new StudioError(
        "This member already has a character in this server’s game.",
        409,
      );
    const template = this.game("mint").characters.find(
      (c) => c.kind !== "mint",
    );
    const character = {
      ...template,
      id: `discord-${input.userId}`,
      name: input.name || input.displayName,
      preset: undefined,
      sprite: undefined,
    };
    const result = this.store.enqueue({
      id: randomUUID(),
      gameId: input.guildId,
      character,
      payload: input,
      source: "discord",
    });
    void this.drain();
    return result;
  }

  close() {
    this.closing = true;
  }
}
