import sharp from "sharp";
import { assetUrl, StudioError } from "./studio-store.mjs";
import { validateReference } from "../bot/image-generator.mjs";

export const validGameId = (id) => id === "mint" || /^\d{17,20}$/.test(id);
const validId = (id) =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const validRequest = (id) =>
  typeof id === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);

export class StudioService {
  constructor({
    store,
    generate,
    generateAbility,
    baseUrl,
    fetch: request = globalThis.fetch,
  }) {
    this.store = store;
    this.generate = generate;
    this.generateAbility = generateAbility;
    this.baseUrl = baseUrl;
    this.fetch = request;
    this.running = false;
    this.closing = false;
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

  async loadGame(id) {
    if (!validGameId(id)) throw new StudioError("Invalid game ID.");
    if (id !== "mint") {
      try {
        const response = await this.fetch(
          new URL(`/games/${id}/game.json`, this.baseUrl),
          {
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
          },
        );
        if (
          response.ok &&
          response.headers.get("content-type")?.includes("application/json")
        )
          this.store.importManifest(id, await response.json());
      } catch (error) {
        if (error instanceof StudioError) throw error;
        // Saved website characters remain available during a deployment outage.
      }
    }
    return this.game(id);
  }

  async enqueue(input, ip) {
    const { gameId, characterId, requestId, abilityOnly = false } = input;
    this.game(gameId);
    if (!validRequest(requestId))
      throw new StudioError("Start a new generation request.");
    if (characterId !== undefined && !validId(characterId))
      throw new StudioError("Invalid character ID.");
    if (
      typeof abilityOnly !== "boolean" ||
      (input.abilityPrompt !== undefined &&
        (typeof input.abilityPrompt !== "string" ||
          input.abilityPrompt.trim().length > 500))
    )
      throw new StudioError(
        "Use up to 500 characters for a signature ability.",
      );
    const abilityPrompt = input.abilityPrompt?.trim();
    if (abilityOnly && (!characterId || !abilityPrompt))
      throw new StudioError(
        "Choose a character and describe their signature ability.",
      );
    if (abilityPrompt && !this.generateAbility)
      throw new StudioError(
        "Signature ability generation is temporarily unavailable.",
        503,
      );
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!abilityOnly) {
      if (!name || name.length > 28)
        throw new StudioError("Choose a character name with 1–28 characters.");
      if (
        typeof input.description !== "string" ||
        input.description.length > 1000
      )
        throw new StudioError(
          "Keep appearance details under 1,000 characters.",
        );
    }
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
        ability: undefined,
      };
    }
    if (
      input.referenceVersionId &&
      (!characterId || !validRequest(input.referenceVersionId))
    )
      throw new StudioError("Invalid reference version.");
    const payload = {
      ...(abilityOnly
        ? { abilityOnly: true }
        : {
            name,
            description: input.description.trim(),
            useCurrent: Boolean(input.useCurrent),
          }),
      ...(abilityPrompt ? { abilityPrompt } : {}),
      ...(input.referenceVersionId
        ? { referenceVersionId: input.referenceVersionId }
        : {}),
    };
    if (!abilityOnly && input.image !== undefined) {
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

  async currentReference(version, preserveCharacter) {
    if (!version?.image) return null;
    const stored = /^\/api\/studio\/assets\/([a-f0-9-]{36})\.png$/.exec(
      version.image,
    );
    if (stored)
      return {
        bytes: this.store.image(stored[1]),
        type: "image/png",
        image: version.image,
      };
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
    this.store.backupOriginal(version, png, preserveCharacter);
    return { bytes: png, type: "image/png", image: assetUrl(version.id) };
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
        if (!this.store.startJob(job.id)) continue;
        try {
          const payload = JSON.parse(job.payload);
          const row = this.store.character(job.game_id, job.character_id);
          const versionId = payload.baseCharacter
            ? payload.baseVersionId
            : payload.referenceVersionId || row.current_version;
          const version = versionId
            ? this.store.version(job.game_id, job.character_id, versionId)
            : null;
          const character = {
            ...(payload.baseCharacter || JSON.parse(row.data)),
          };
          const references = [];
          // Preserve an original snapshot even when it is excluded from the prompt.
          const original = await this.currentReference(
            version,
            payload.abilityOnly,
          );
          if (payload.useCurrent && original)
            references.push({ bytes: original.bytes, type: original.type });
          if (payload.image)
            references.push({
              bytes: Buffer.from(payload.image.base64, "base64"),
              type: payload.image.type,
            });
          let bytes;
          let description = version?.description || "";
          if (!payload.abilityOnly) {
            character.name = payload.name;
            description = payload.description;
            bytes = await this.generate({
              name: character.name,
              description,
              references,
            });
          }
          let ability;
          if (payload.abilityPrompt) {
            try {
              ability = await this.generateAbility({
                name: character.name,
                prompt: payload.abilityPrompt,
              });
            } catch {
              throw new StudioError(
                "The signature ability could not be generated. Your saved versions are still available.",
                502,
              );
            }
          }
          this.store.finishGeneration(job, {
            character,
            bytes,
            description,
            image: original?.image,
            ability,
          });
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

  close() {
    this.closing = true;
  }
}
