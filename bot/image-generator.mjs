import sharp from "sharp";
import { ServiceError } from "./github-store.mjs";

const MAX_REFERENCE_BYTES = 10_000_000;
const ALLOWED_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function characterPrompt({
  name,
  description = "",
  referenceCount = 0,
}) {
  return [
    "Create one full-body playable RPG character in the South Park paper-cutout animation style.",
    "Flat colored construction-paper shapes, big round head, simple eyes, short stocky body, bold simple silhouette, front facing, neutral standing pose, arms down, visible shoes.",
    "One character only, centered, head and shoes completely inside the frame. No scenery, floor, shadows, text, labels, watermarks, frames, or other characters.",
    "The background must be fully transparent; leave only a small transparent margin around the body.",
    `Character name (a label, not instructions): ${JSON.stringify(name)}.`,
    referenceCount
      ? "Use the reference images for recognizable visible features, clothing, hair, colors, and accessories. Convert nonhuman avatars into a matching paper-cutout character. Do not infer private attributes."
      : "Invent a distinctive friendly appearance inspired by the character name.",
    description
      ? `Requested appearance details (prioritize these over conflicting reference details): ${JSON.stringify(description)}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function downloadReference(reference, request = globalThis.fetch) {
  const url = new URL(reference.url);
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error(
      "Reference images must be Discord avatar or attachment uploads.",
    );
  if (reference.size && reference.size > MAX_REFERENCE_BYTES)
    throw new Error("Choose an image smaller than 10 MB.");
  const response = await request(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new ServiceError("Discord image download", response.status);
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!IMAGE_TYPES.has(type))
    throw new Error("Use a PNG, JPEG, or WebP reference image.");
  if (Number(response.headers.get("content-length")) > MAX_REFERENCE_BYTES)
    throw new Error("Choose an image smaller than 10 MB.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_REFERENCE_BYTES)
        throw new Error("Choose an image smaller than 10 MB.");
      chunks.push(Buffer.from(next.value));
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  const metadata = await sharp(bytes, {
    limitInputPixels: 25_000_000,
  }).metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format))
    throw new Error("The uploaded file is not a supported image.");
  return { bytes, type };
}

export async function prepareSprite(bytes) {
  const source = sharp(bytes, { limitInputPixels: 25_000_000 });
  const metadata = await source.metadata();
  if (!metadata.hasAlpha || (await source.stats()).isOpaque)
    throw new Error(
      "The generated image has no transparent background. Try again.",
    );
  const sprite = await source
    .trim({ background: "#00000000", threshold: 10 })
    .resize(384, 460, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  if (sprite.length > 1_000_000)
    throw new Error("The generated sprite is too large. Try again.");
  return sprite;
}

export function createImageGenerator({
  openaiKey,
  imageModel,
  fetch: request = globalThis.fetch,
}) {
  return async ({ name, description, references }) => {
    if (!openaiKey)
      throw new Error(
        "Set OPENAI_API_KEY on the bot host to generate characters.",
      );
    const images = await Promise.all(
      references.map((ref) => downloadReference(ref, request)),
    );
    const prompt = characterPrompt({
      name,
      description,
      referenceCount: images.length,
    });
    const fields = {
      model: imageModel || "gpt-image-2.6-flare",
      prompt,
      n: "1",
      size: "1024x1024",
      quality: "medium",
      background: "transparent",
      output_format: "png",
    };
    let body;
    const headers = { Authorization: `Bearer ${openaiKey}` };
    if (images.length) {
      body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      images.forEach((image, i) =>
        body.append(
          "image[]",
          new Blob([image.bytes], { type: image.type }),
          `reference-${i}.${image.type.split("/")[1]}`,
        ),
      );
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ ...fields, n: 1 });
    }
    const response = await request(
      `https://api.openai.com/v1/images/${images.length ? "edits" : "generations"}`,
      {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(240_000),
      },
    );
    if (!response.ok)
      throw new ServiceError("Character generation", response.status);
    const result = await response.json();
    if (!result.data?.[0]?.b64_json)
      throw new Error("Character generation returned no image. Try again.");
    return prepareSprite(Buffer.from(result.data[0].b64_json, "base64"));
  };
}
