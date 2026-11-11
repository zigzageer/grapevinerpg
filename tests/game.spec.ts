import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const cast = [
  "Mint",
  "Baguette",
  "Sarina",
  "David",
  "Ghost",
  "Rocky",
  "Miel",
  "Zippy",
  "Jat",
  "Loralei",
  "Samira",
  "Genesis",
  "Kain",
  "Footjobofsteel",
];

test("every named character is selectable and the free-roam screen has no quest flow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const picker = page.getByRole("group", { name: "Character selection" });
  await expect(picker.getByRole("button")).toHaveCount(14);
  await expect(
    page.getByText("A perfectly normal day.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Journal", exact: true }),
  ).toHaveCount(0);
  for (const name of cast) {
    await picker
      .getByRole("button", { name: `Play as ${name}`, exact: true })
      .click();
    await expect(page.locator(".demo-selected h2")).toHaveText(name);
    await expect(
      picker.getByRole("button", { name: `Play as ${name}`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const before = Number(
      await page.getByTestId("player-sprite").getAttribute("data-x"),
    );
    await page.keyboard.down("d");
    await page.waitForTimeout(120);
    await page.keyboard.up("d");
    await expect
      .poll(async () =>
        Number(await page.getByTestId("player-sprite").getAttribute("data-x")),
      )
      .toBeGreaterThan(before + 5);
  }
  expect(errors).toEqual([]);
});

test("clicking a citizen switches control and the character and position survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("town")
    .getByRole("button", { name: "Play as Sarina", exact: true })
    .click();
  await expect(page.locator(".demo-selected h2")).toHaveText("Sarina");
  const sprite = page.getByTestId("player-sprite");
  const initial = Number(await sprite.getAttribute("data-x"));
  await page.keyboard.down("a");
  await page.waitForTimeout(300);
  await page.keyboard.up("a");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeLessThan(initial - 20);
  const last = Number(await sprite.getAttribute("data-x"));
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator(".demo-selected h2")).toHaveText("Sarina");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeCloseTo(last, 0);
  await page.getByRole("button", { name: "Reset position" }).click();
  await expect(sprite).toHaveAttribute("data-x", "680");
  // A real click-to-walk request, separate from keyboard movement.
  const destination = await page.getByTestId("town").evaluate((svg) => {
    const p = new DOMPoint(895, 610).matrixTransform(
      (svg as unknown as SVGSVGElement).getScreenCTM()!,
    );
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(destination.x, destination.y);
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")), {
      timeout: 10000,
    })
    .toBeGreaterThan(875);
});

test("mobile touch controls, character search, and camera work without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByLabel("Find a character").fill("kain");
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button", { name: "Play as Kain", exact: true })
    .click();
  await expect(page.locator(".demo-selected h2")).toHaveText("Kain");
  const sprite = page.getByTestId("player-sprite");
  const before = Number(await sprite.getAttribute("data-x"));
  const right = page.getByRole("button", { name: "Move right", exact: true });
  await right.scrollIntoViewIfNeeded();
  const box = (await right.boundingBox())!;
  await page.mouse.move(box.x + 15, box.y + 15);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeGreaterThan(before + 70);
  const position = await sprite.boundingBox();
  expect(position!.x).toBeGreaterThan(70);
  expect(position!.x).toBeLessThan(280);
});

test("workshop edits pause movement and custom character selection persists", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button", { name: "Play as Sarina", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Character workshop", exact: true })
    .click();
  await expect(page.getByLabel("Character name")).toHaveValue("Sarina");
  const before = await page.getByTestId("player-sprite").getAttribute("data-x");
  await page.getByLabel("Character name").fill("Sarina");
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.keyboard.up("d");
  expect(await page.getByTestId("player-sprite").getAttribute("data-x")).toBe(
    before,
  );
  await page.getByLabel("Character name").fill("Sarina");
  await page.getByRole("button", { name: "Add friend", exact: true }).click();
  await page.getByLabel("Character name").fill("Test Friend");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Play as Test Friend/ })
    .click();
  await expect(page.locator(".demo-selected h2")).toHaveText("Test Friend");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator(".demo-selected h2")).toHaveText("Test Friend");
  await page
    .getByRole("button", { name: "Character workshop", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import crew", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"crew":[null]}'),
  });
  await expect(page.getByRole("alert")).toBeVisible();
});

test("standalone HTML needs no network after its initial document loads", async ({
  page,
}) => {
  const demo = resolve("artifacts/adventures-of-mint.html");
  expect(existsSync(demo)).toBe(true);
  const outbound: string[] = [];
  const url = "http://127.0.0.1:5173/standalone-demo";
  await page.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: readFileSync(demo, "utf8"),
    }),
  );
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && request.url() !== url)
      outbound.push(request.url());
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.context().setOffline(true);
  const picker = page.getByRole("group", { name: "Character selection" });
  await expect(picker.getByRole("button")).toHaveCount(14);
  await picker
    .getByRole("button", { name: "Play as Footjobofsteel", exact: true })
    .click();
  const sprite = page.getByTestId("player-sprite");
  await expect(sprite.locator("image")).toHaveAttribute(
    "href",
    /^data:image\/png;base64,/,
  );
  const x = Number(await sprite.getAttribute("data-x"));
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeGreaterThan(x + 15);
  expect(outbound).toEqual([]);
});

test("camera follows the active character closely through walking, zoom, and fullscreen", async ({
  page,
}) => {
  await page.goto("/");
  const town = page.getByTestId("town"),
    sprite = page.getByTestId("player-sprite");
  const readView = async () =>
    (await town.getAttribute("viewBox"))!.split(" ").map(Number);
  await expect.poll(async () => (await readView())[3]).toBe(300);
  const clip = await page.locator(".scene-clip").boundingBox();
  const initial = await sprite.boundingBox();
  expect(initial!.height).toBeGreaterThan(clip!.height * 0.24);
  expect(
    Math.abs(initial!.x + initial!.width / 2 - (clip!.x + clip!.width / 2)),
  ).toBeLessThan(4);
  const before = await readView();
  await page.keyboard.down("d");
  await page.waitForTimeout(450);
  await page.keyboard.up("d");
  await page.waitForTimeout(100);
  const after = await readView();
  expect(after[0]).toBeGreaterThan(before[0] + 40);
  const moved = await sprite.boundingBox();
  expect(
    Math.abs(moved!.x + moved!.width / 2 - (clip!.x + clip!.width / 2)),
  ).toBeLessThan(4);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await readView())[3]).toBeLessThan(300);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(async () => (await readView())[3]).toBe(300);
  await page
    .getByRole("button", { name: "Fullscreen game", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  const fullClip = await page.locator(".scene-clip").boundingBox(),
    fullSprite = await sprite.boundingBox();
  expect(
    Math.abs(
      fullSprite!.x +
        fullSprite!.width / 2 -
        (fullClip!.x + fullClip!.width / 2),
    ),
  ).toBeLessThan(6);
  await page.evaluate(() => document.exitFullscreen());
});
