import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { renderFightGif } from "./fight-gif.mjs";

function fixture(moves, { hp = [100, 100], names = ["Miel", "Mint"] } = {}) {
  const remaining = [...hp];
  const events = moves.map(
    (
      {
        side,
        move = "Strike",
        damage = 0,
        kind = "attack",
        visual = "strike",
        actorHp,
      },
      index,
    ) => {
      const target = 1 - side;
      remaining[target] = Math.max(0, remaining[target] - damage);
      if (actorHp !== undefined) remaining[side] = actorHp;
      return {
        seq: index + 1,
        actorId: String(side),
        targetId: String(target),
        kind,
        move,
        damage,
        targetHp: remaining[target],
        visual,
        ...(actorHp !== undefined ? { actorHp } : {}),
      };
    },
  );
  return {
    kind: "duel",
    mode: "auto",
    status: "finished",
    winnerSide: remaining[0] ? 0 : 1,
    sides: hp.map((startingHp, side) => ({
      players: [
        {
          id: String(side),
          name: names[side],
          hp: remaining[side],
          startingHp,
        },
      ],
    })),
    events,
  };
}

function solidCutout(color, width = 44, height = 88) {
  return sharp({ create: { width, height, channels: 4, background: color } })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: "#00000000" })
    .png()
    .toBuffer();
}

async function frame(gif, page) {
  const { data, info } = await sharp(gif, { page, pages: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return (x, y) => [
    ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
  ];
}

function near(pixel, color, tolerance = 20) {
  return color.every(
    (channel, index) => Math.abs(channel - pixel[index]) <= tolerance,
  );
}

test("GIF animates sprite and ability art, updates HP on contact, and holds the winner", async () => {
  const match = fixture(
    [
      { side: 0, damage: 20 },
      {
        side: 1,
        kind: "ability",
        move: "Moon & <spark>",
        visual: "projectile",
        damage: 28,
      },
      {
        side: 0,
        kind: "ability",
        move: "Recover",
        visual: "burst",
        actorHp: 114,
      },
      { side: 1, move: "Stunned", visual: "burst" },
      { side: 0, damage: 60 },
    ],
    { hp: [120, 80], names: ["Miel & <Mint>\0", "✦ あかり"] },
  );
  const [miel, mint, art] = await Promise.all([
    solidCutout("#d94cba"),
    solidCutout("#75d52a"),
    solidCutout("#3069fb", 32, 32),
  ]);
  const gif = await renderFightGif({
    match,
    sprites: { 0: miel, 1: mint },
    effects: { 1: art },
  });
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(gif.toString("ascii", 0, 6), "GIF89a");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.pageHeight, 288);
  assert.equal(metadata.pages, 4 * match.events.length + 2);
  assert.equal(metadata.delay.length, metadata.pages);
  assert.ok(metadata.delay.at(-1) >= 1800);
  assert.ok(gif.length < 3_000_000);

  const [idle, travel, strike, projectile, injured, healed, stunned, won] =
    await Promise.all(
      [0, 2, 3, 6, 7, 11, 15, metadata.pages - 1].map((i) => frame(gif, i)),
    );
  const leftHp = [154, 222, 173];
  const rightHp = [249, 184, 150];
  assert.ok(near(idle(134, 150), [217, 76, 186]));
  assert.ok(near(travel(195, 150), [217, 76, 186]));
  assert.ok(!near(travel(134, 150), [217, 76, 186]));
  assert.ok(near(travel(465, 46), rightHp));
  assert.ok(!near(strike(465, 46), rightHp));
  const projectileColor = projectile(250, 139);
  assert.ok(
    near(projectileColor, [48, 105, 251]),
    JSON.stringify(projectileColor),
  );
  assert.ok(!near(injured(195, 46), leftHp));
  assert.ok(near(healed(195, 46), leftHp));
  assert.ok(near(stunned(195, 46), leftHp));
  assert.ok(!near(won(301, 46), rightHp));
  assert.ok(!near(won(378, 100), [117, 213, 42]));
});

test("the smaller GIF retains every move of a long fight with missing and damaged art", async () => {
  const match = fixture(
    Array.from({ length: 24 }, (_, index) => {
      const side = 1 - (index % 2);
      if (index === 4) return { side, move: "Asleep", visual: "burst" };
      if (index === 6)
        return { side, move: "Burning", damage: 4, visual: "burst" };
      return { side, damage: index === 23 ? 1 : side === 0 ? 9 : 7 };
    }),
    {
      names: [
        "<image href='https://invalid.example/image.png'/>",
        "W".repeat(28),
      ],
    },
  );
  const [background, transparent] = await Promise.all([
    readFile(new URL("../public/abilities/duel-street.webp", import.meta.url)),
    solidCutout("#00000000"),
  ]);
  const corruptPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const gif = await renderFightGif({
    match,
    background,
    sprites: { 0: transparent, 1: corruptPng },
    maxBytes: 525_000,
  });
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.ok(gif.length <= 525_000);
  assert.ok(metadata.width >= 288 && metadata.width < 512);
  assert.ok(metadata.pages >= 2 * match.events.length + 2);
  assert.ok(metadata.pages <= 4 * match.events.length + 2);
  assert.equal(metadata.delay.length, metadata.pages);
  assert.ok(metadata.delay.at(-1) >= 1800);

  const opening = await frame(gif, 0);
  const scale = metadata.width / 512;
  assert.ok(
    near(
      opening(Math.round(134 * scale), Math.round(153 * scale)),
      [184, 200, 174],
      30,
    ),
  );
  assert.ok(
    near(
      opening(Math.round(378 * scale), Math.round(153 * scale)),
      [207, 171, 154],
      30,
    ),
  );
});

test("rejects fights outside the supported event count and invalid byte budgets", async () => {
  const moves = Array.from({ length: 25 }, (_, index) => ({
    side: index % 2,
    damage: 9,
  }));
  await assert.rejects(
    renderFightGif({ match: fixture(moves) }),
    /up to 24 events/,
  );
  await assert.rejects(
    renderFightGif({ match: fixture(moves.slice(0, 1)), maxBytes: 0 }),
    /positive GIF size limit/,
  );
});
