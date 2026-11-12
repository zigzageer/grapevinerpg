import { Worker } from "node:worker_threads";

export const MAX_FIGHT_GIF_BYTES = 3_000_000;
const MAX_ART_BYTES = 4_000_000;
const STUDIO_ART = /^\/api\/studio\/assets\/([a-f0-9-]{36})\.png$/;
const PUBLIC_ART =
  /^\/(?:(?:characters|abilities)\/[\w-]+|games\/\d{17,20}\/\d{17,20})\.(?:png|webp)$/;
const ARENA = "/abilities/duel-street.webp";

function validGif(bytes) {
  return (
    Buffer.isBuffer(bytes) &&
    bytes.length >= 14 &&
    bytes.length <= MAX_FIGHT_GIF_BYTES &&
    ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
  );
}

async function readArt(response) {
  if (
    !response.ok ||
    !/^image\/(?:png|webp)(?:;|$)/i.test(
      response.headers.get("content-type") ?? "",
    ) ||
    Number(response.headers.get("content-length")) > MAX_ART_BYTES ||
    !response.body
  ) {
    await response.body?.cancel();
    return undefined;
  }

  const parts = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > MAX_ART_BYTES) return undefined;
    parts.push(part);
  }
  return Buffer.concat(parts, size);
}

export function createFightGifRenderer({
  baseUrl,
  readStudioImage,
  fetch: request = globalThis.fetch,
  render = renderInWorker,
}) {
  const origin = new URL(baseUrl).origin;

  return async (match, signal) => {
    const art = new Map();
    const load = (href) => {
      if (typeof href !== "string") return undefined;
      if (!art.has(href)) art.set(href, loadArt(href));
      return art.get(href);
    };
    async function loadArt(href) {
      try {
        const studio = STUDIO_ART.exec(href);
        if (studio) {
          const bytes = readStudioImage(studio[1]);
          return bytes?.length <= MAX_ART_BYTES ? bytes : undefined;
        }
        if (!PUBLIC_ART.test(href)) return undefined;
        const response = await request(new URL(href, origin), {
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        });
        return await readArt(response);
      } catch {
        return undefined;
      }
    }

    const fighters = match.sides.flatMap(({ players }) => players);
    const [background, sprites, effects] = await Promise.all([
      load(ARENA),
      Promise.all(
        fighters.map(async ({ id, sprite }) => [id, await load(sprite)]),
      ),
      Promise.all(
        fighters.map(async ({ id, abilityArt }) => [
          id,
          await load(abilityArt),
        ]),
      ),
    ]);
    signal.throwIfAborted();
    return render(
      {
        match,
        background,
        sprites: Object.fromEntries(sprites),
        effects: Object.fromEntries(effects),
        maxBytes: MAX_FIGHT_GIF_BYTES,
      },
      signal,
    );
  };
}

async function renderInWorker(input, signal) {
  signal.throwIfAborted();
  const worker = new Worker(
    new URL("./fight-gif-worker.mjs", import.meta.url),
    {
      workerData: input,
      env: {},
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 192 },
    },
  );
  let abort;
  try {
    return await new Promise((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      worker.once("message", (bytes) => resolve(Buffer.from(bytes)));
      worker.once("error", reject);
      worker.once("exit", () =>
        reject(new Error("The GIF worker exited without a result.")),
      );
    });
  } finally {
    signal.removeEventListener("abort", abort);
    await worker.terminate();
  }
}

export class FightGifQueue {
  constructor({ render, logger = console, now = Date.now, maxWaiting = 8 }) {
    this.render = render;
    this.logger = logger;
    this.now = now;
    this.maxWaiting = maxWaiting;
    this.waiting = [];
    this.pending = new Set();
    this.results = new Map();
    this.shutdown = new AbortController();
    this.running = undefined;
  }

  request(match) {
    if (this.shutdown.signal.aborted) return { status: "unavailable" };
    const saved = this.results.get(match.id);
    if (saved?.expires > this.now()) return saved.result;
    this.results.delete(match.id);
    if (this.pending.has(match.id)) return { status: "queued" };
    if (this.waiting.length >= this.maxWaiting)
      return { status: "unavailable" };
    this.pending.add(match.id);
    this.waiting.push(match);
    this.drain();
    return { status: "queued" };
  }

  drain() {
    if (this.running || this.shutdown.signal.aborted) return;
    const match = this.waiting.shift();
    if (!match) return;
    const signal = AbortSignal.any([
      this.shutdown.signal,
      AbortSignal.timeout(30_000),
    ]);
    this.running = this.run(match, signal).finally(() => {
      this.pending.delete(match.id);
      this.running = undefined;
      this.drain();
    });
  }

  async run(match, signal) {
    let result;
    try {
      const bytes = await this.render(match, signal);
      if (!validGif(bytes)) throw new Error("Invalid or oversize fight GIF.");
      result = { status: "ready", bytes };
    } catch (error) {
      if (this.shutdown.signal.aborted) return;
      this.logger.warn?.(
        "[fight GIF] Render unavailable",
        match.id,
        error.message,
      );
      result = { status: "unavailable" };
    }
    this.results.set(match.id, {
      result,
      expires: this.now() + (result.bytes ? 300_000 : 30_000),
    });
    while (this.results.size > 12)
      this.results.delete(this.results.keys().next().value);
  }

  async close() {
    this.shutdown.abort();
    this.waiting.length = 0;
    this.pending.clear();
    this.results.clear();
    await this.running;
  }
}
