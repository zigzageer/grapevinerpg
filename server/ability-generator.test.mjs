import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createAbilityGenerator } from "./ability-generator.mjs";

const details = {
  name: " Frost Flash ",
  description: " Ice crystals burst around the target. ",
  style: "burst",
  damage: 9999,
  art: "https://example.invalid/replacement.png",
};
const pixels = Buffer.alloc(4 * 4 * 4);
for (const index of [5, 6, 9]) pixels.set([30, 100, 200, 255], index * 4);
const transparent = await sharp(pixels, {
  raw: { width: 4, height: 4, channels: 4 },
})
  .png()
  .toBuffer();

function runnerWriting(data, art, inspect = () => {}) {
  return (options) => {
    inspect(options);
    return {
      async run() {
        await writeFile(
          path.join(options.workdir, "ability.json"),
          JSON.stringify(data),
        );
        await writeFile(path.join(options.workdir, "effect.png"), art);
        return { status: "completed" };
      },
    };
  };
}

test("generated abilities return sanitized move data and a bounded local PNG", async () => {
  const generate = createAbilityGenerator({
    codexEnv: { OPENAI_API_KEY: "unused", CODEX_API_KEY: "unused" },
    runnerFactory: runnerWriting(details, transparent, (options) => {
      assert.equal(options.env.OPENAI_API_KEY, undefined);
      assert.equal(options.env.CODEX_API_KEY, undefined);
      assert.ok(
        options.extraArgs.includes(
          "sandbox_workspace_write.network_access=false",
        ),
      );
      assert.match(
        options.promptForTask(),
        /Move idea: "A small burst of ice"/,
      );
    }),
  });
  const { bytes, ...ability } = await generate({
    name: "Miel",
    prompt: "A small burst of ice",
  });
  assert.deepEqual(ability, {
    name: "Frost Flash",
    description: "Ice crystals burst around the target.",
    style: "burst",
  });
  const { format, hasAlpha } = await sharp(bytes).metadata();
  assert.equal(format, "png");
  assert.equal(hasAlpha, true);
});

test("a generated effect needs a known style and usable transparent art", async () => {
  const input = { name: "Miel", prompt: "A small burst of ice" };
  const badStyle = createAbilityGenerator({
    runnerFactory: runnerWriting(
      { ...details, style: "run-code" },
      transparent,
    ),
  });
  await assert.rejects(badStyle(input), /Invalid generated ability details/);
  const opaque = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#1e64c8" },
  })
    .png()
    .toBuffer();
  const badArt = createAbilityGenerator({
    runnerFactory: runnerWriting(details, opaque),
  });
  await assert.rejects(badArt(input), /transparent background/);
});
