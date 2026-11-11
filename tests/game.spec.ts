import { test, expect, type Page } from "@playwright/test";
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
async function picker(page: Page) {
  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  return page.getByRole("group", { name: "Character selection" });
}
async function pause(page: Page) {
  await page.getByRole("button", { name: "Pause menu", exact: true }).click();
}
async function assertFullscreen(page: Page) {
  const size = await page.evaluate(() => ({
    width: innerWidth,
    height: visualViewport?.height || innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  const world = await page.getByTestId("game-viewport").boundingBox();
  expect(world!.x).toBe(0);
  expect(world!.y).toBe(0);
  expect(world!.width).toBe(size.width);
  expect(world!.height).toBeCloseTo(size.height, 0);
  expect(size.scrollWidth).toBe(size.width);
  expect(size.scrollHeight).toBeCloseTo(size.height, 0);
}

async function perfectTiming(page: Page) {
  await expect(page.locator(".battle-timing")).toBeVisible();
  await page.clock.runFor(1260);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "impact",
  );
}

test("character interactions animate a kiss and preserve the player until Play as is chosen", async ({
  page,
}) => {
  await page.goto("/");
  const sprite = page.getByTestId("player-sprite");
  const x = await sprite.getAttribute("data-x");
  await page
    .getByRole("button", { name: "Interact with Sarina", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Sarina", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fight", exact: true }),
  ).toBeVisible();
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Kiss", exact: true }).click();
  await expect(page.locator(".duo-kiss")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Mint gives Sarina a quick kiss.",
  );
  await page
    .getByRole("button", { name: "Back to Sarina", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play as Sarina", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("active-character-name")).toHaveText("Sarina");
  await expect(sprite).toHaveAttribute("data-x", x!);
});

test("a complete duel supports timed attacks, blocks, snacks, status effects and returning to town", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const startTime = new Date("2026-11-11T12:00:00Z");
  await page.clock.install({ time: startTime });
  await page.goto("/");
  await page.clock.pauseAt(new Date(startTime.getTime() + 60_000));
  const position = await page
    .getByTestId("player-sprite")
    .getAttribute("data-x");
  await page
    .getByRole("button", { name: "Interact with Sarina", exact: true })
    .click();
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  const battle = page.getByTestId("battle");
  await expect(
    page.getByRole("meter", { name: "Mint health", exact: true }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page
    .getByRole("button", { name: "Use Paper spark", exact: true })
    .click();
  await perfectTiming(page);
  await expect(battle).toHaveAttribute("data-phase", "impact");
  await expect(page.locator(".duo-stage")).toHaveAttribute(
    "data-move",
    "spark",
  );
  await expect(page.locator(".fighter-status.opponent")).toContainText(
    "Burning",
  );
  await page.clock.runFor(850);
  await perfectTiming(page);
  await page.clock.runFor(850);
  await expect(battle).toHaveAttribute("data-phase", "choose");
  await page.getByRole("button", { name: "Eat a snack", exact: true }).click();
  await expect(
    page.getByRole("meter", { name: "Mint health", exact: true }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(
    page.getByRole("button", { name: "Eat a snack", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Use Heavy hit", exact: true })
    .click();
  await perfectTiming(page);
  await page.clock.runFor(850);
  await perfectTiming(page);
  await page.clock.runFor(850);
  await expect(battle).toHaveAttribute("data-phase", "choose");
  await page
    .getByRole("button", { name: "Use Heavy hit", exact: true })
    .click();
  await perfectTiming(page);
  await page.clock.runFor(850);
  await expect(battle).toHaveAttribute("data-phase", "victory");
  await expect(page.getByText("Mint wins!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to town", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("player-sprite")).toHaveAttribute(
    "data-x",
    position!,
  );
  await page.keyboard.down("d");
  await page.clock.runFor(100);
  await page.keyboard.up("d");
  expect(
    Number(await page.getByTestId("player-sprite").getAttribute("data-x")),
  ).toBeGreaterThan(Number(position));
  expect(errors).toEqual([]);
});

test("leaving a duel cancels pending timing and restores normal controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Interact with Sarina", exact: true })
    .click();
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Ground stomp", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Strike!", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(2100);
  await page.keyboard.press("c");
  await expect(
    page.getByRole("group", { name: "Character selection" }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`touch duels and kiss controls fit ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.goto("http://127.0.0.1:5173/");
      await pause(page);
      await page
        .getByRole("slider", { name: "Camera zoom", exact: true })
        .fill("1.5");
      await page
        .getByRole("button", { name: "Resume game", exact: true })
        .tap();
      await page
        .getByRole("button", { name: "Interact with Sarina", exact: true })
        .tap();
      await page.getByRole("button", { name: "Fight", exact: true }).tap();
      await page
        .getByRole("button", { name: "Use Snowball", exact: true })
        .tap();
      const strike = page.getByRole("button", { name: "Strike!", exact: true });
      await expect(strike).toBeVisible();
      const bounds = (await strike.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      await strike.tap();
      await page
        .getByRole("button", { name: "Leave fight", exact: true })
        .tap();
      await page
        .getByRole("button", { name: "Interact with Sarina", exact: true })
        .tap();
      await page.getByRole("button", { name: "Kiss", exact: true }).tap();
      await expect(page.locator(".duo-kiss")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .tap();
      await expect(
        page.getByRole("group", { name: "Movement joystick" }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test("the game fills the screen immediately and every character can be played", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await assertFullscreen(page);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.locator(".site-header,.welcome-row,.sidebar,.site-footer"),
  ).toHaveCount(0);
  for (const name of cast) {
    const choices = await picker(page);
    await expect(choices.getByRole("button")).toHaveCount(14);
    await choices
      .getByRole("button", { name: `Play as ${name}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("active-character-name")).toHaveText(name);
    const x = Number(
      await page.getByTestId("player-sprite").getAttribute("data-x"),
    );
    await page.keyboard.down("d");
    await page.waitForTimeout(100);
    await page.keyboard.up("d");
    await expect
      .poll(async () =>
        Number(await page.getByTestId("player-sprite").getAttribute("data-x")),
      )
      .toBeGreaterThan(x + 4);
  }
  expect(errors).toEqual([]);
});

test("clicking a citizen, following movement, and restoring the save all work", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("town")
    .getByRole("button", { name: "Interact with Sarina", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Play as Sarina", exact: true })
    .click();
  await expect(page.getByTestId("active-character-name")).toHaveText("Sarina");
  const sprite = page.getByTestId("player-sprite"),
    town = page.getByTestId("town");
  const x = Number(await sprite.getAttribute("data-x")),
    camera = Number((await town.getAttribute("viewBox"))!.split(" ")[0]);
  await page.keyboard.down("a");
  await page.waitForTimeout(300);
  await page.keyboard.up("a");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeLessThan(x - 20);
  expect(
    Number((await town.getAttribute("viewBox"))!.split(" ")[0]),
  ).toBeLessThan(camera - 20);
  const last = Number(await sprite.getAttribute("data-x"));
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId("active-character-name")).toHaveText("Sarina");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeCloseTo(last, 0);
  await pause(page);
  await page
    .getByRole("button", { name: "Reset position", exact: true })
    .click();
  await expect(sprite).toHaveAttribute("data-x", "680");
  const destination = await town.evaluate((el) => {
    const p = new DOMPoint(895, 610).matrixTransform(
      (el as unknown as SVGSVGElement).getScreenCTM()!,
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

test("pause settings control the TV treatment and camera without leaking input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".play-screen")).toHaveAttribute(
    "data-tv-look",
    "true",
  );
  await expect(page.locator(".episode-treatment")).toBeVisible();
  const sprite = page.getByTestId("player-sprite"),
    x = await sprite.getAttribute("data-x");
  await pause(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.keyboard.up("d");
  expect(await sprite.getAttribute("data-x")).toBe(x);
  await page.getByRole("switch", { name: "TV episode look" }).click();
  await expect(page.locator(".episode-treatment")).toHaveCount(0);
  const before = Number(
    (await page.getByTestId("town").getAttribute("viewBox"))!.split(" ")[3],
  );
  await page.getByLabel("Camera zoom").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () =>
      Number(
        (await page.getByTestId("town").getAttribute("viewBox"))!.split(" ")[3],
      ),
    )
    .toBeLessThan(before);
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page
      .locator(".world-layer")
      .evaluate((el) => getComputedStyle(el).filter),
  ).toBe("none");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator(".play-screen")).toHaveAttribute(
    "data-tv-look",
    "false",
  );
  await assertFullscreen(page);
});

test("workshop editing and a new playable character persist", async ({
  page,
}) => {
  await page.goto("/");
  const choices = await picker(page);
  await choices
    .getByRole("button", { name: "Play as Sarina", exact: true })
    .click();
  await pause(page);
  await page
    .getByRole("button", { name: "Character workshop", exact: true })
    .click();
  await expect(page.getByLabel("Character name")).toHaveValue("Sarina");
  await page.getByRole("button", { name: "Add friend", exact: true }).click();
  await page.getByLabel("Character name").fill("Test Friend");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Play as Test Friend/ })
    .click();
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Test Friend",
  );
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Test Friend",
  );
  await pause(page);
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

test("native fullscreen keeps the game and pause menu usable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Fullscreen game", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await assertFullscreen(page);
  await pause(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => document.exitFullscreen());
  await assertFullscreen(page);
});

test("the standalone game needs no network after loading", async ({ page }) => {
  const file = resolve("artifacts/adventures-of-mint.html");
  expect(existsSync(file)).toBe(true);
  const url = "http://127.0.0.1:5173/standalone-demo",
    outbound: string[] = [];
  await page.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: readFileSync(file, "utf8"),
    }),
  );
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && r.url() !== url) outbound.push(r.url());
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.context().setOffline(true);
  await assertFullscreen(page);
  const choices = await picker(page);
  await choices
    .getByRole("button", { name: "Play as Footjobofsteel", exact: true })
    .click();
  const sprite = page.getByTestId("player-sprite");
  await expect(sprite.locator("image")).toHaveAttribute(
    "href",
    /^data:image\/png;base64,/,
  );
  await expect(page.locator(".scenery image")).toHaveCount(4);
  for (const image of await page.locator(".scenery image").all())
    await expect(image).toHaveAttribute("href", /^data:image\/png;base64,/);
  const x = Number(await sprite.getAttribute("data-x"));
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-x")))
    .toBeGreaterThan(x + 15);
  expect(outbound).toEqual([]);
});

test("the town map routes the character to the school and neighborhood", async ({
  page,
}) => {
  await page.goto("/");
  const art = await page.locator(".scenery image").evaluateAll(async (images) =>
    Promise.all(
      images.map(
        (el) =>
          new Promise<boolean>((resolve) => {
            const image = new Image();
            image.onload = () => resolve(image.naturalWidth > 100);
            image.onerror = () => resolve(false);
            image.src = el.getAttribute("href")!;
          }),
      ),
    ),
  );
  expect(art).toEqual([true, true, true, true]);
  await page.getByRole("button", { name: "Town map", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Town destinations" }).getByRole("button"),
  ).toHaveCount(10);
  await page
    .getByRole("button", { name: "Walk to South Park Elementary", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const sprite = page.getByTestId("player-sprite");
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-y")), {
      timeout: 15000,
    })
    .toBeCloseTo(1160, 0);
  expect(Number(await sprite.getAttribute("data-x"))).toBeCloseTo(560, 0);
  await expect(page.locator(".hud-location strong")).toHaveText(
    "School & civic center",
  );
  await page.keyboard.press("m");
  await page
    .getByRole("button", { name: "Walk to McCormick Residence", exact: true })
    .click();
  await expect
    .poll(async () => Number(await sprite.getAttribute("data-y")), {
      timeout: 18000,
    })
    .toBeCloseTo(1870, 0);
  expect(Number(await sprite.getAttribute("data-x"))).toBeCloseTo(1700, 0);
  await expect(page.locator(".hud-location strong")).toHaveText(
    "The neighborhood",
  );
  await page.keyboard.press("m");
  await page
    .getByRole("button", { name: "Walk to Tweek Bros. Coffee", exact: true })
    .click();
  await expect(page.locator(".walk-target")).toHaveCount(1);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.keyboard.up("d");
  await expect(page.locator(".walk-target")).toHaveCount(0);
});

test.describe("touch game", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("portrait, landscape, and character selection stay within the screen", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await assertFullscreen(page);
    await page
      .getByRole("button", { name: "Choose characters", exact: true })
      .tap();
    await page.getByLabel("Find a character").fill("kain");
    await page
      .getByRole("group", { name: "Character selection" })
      .getByRole("button", { name: "Play as Kain", exact: true })
      .tap();
    await expect(page.getByTestId("active-character-name")).toHaveText("Kain");
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect
        .poll(
          async () =>
            (await page.getByTestId("game-viewport").boundingBox())!.height,
        )
        .toBe(size.height);
      await assertFullscreen(page);
      for (const label of ["Pause menu", "Choose characters", "Hold to run"]) {
        const box = await page
          .getByRole("button", { name: label, exact: true })
          .boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      }
    }
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(
      200,
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes");
  });
  test("two-finger joystick and run input release cleanly", async ({
    page,
  }) => {
    await page.goto("/");
    const cdp = await page.context().newCDPSession(page),
      sprite = page.getByTestId("player-sprite");
    const j = (await page
        .getByRole("group", { name: "Movement joystick" })
        .boundingBox())!,
      r = (await page
        .getByRole("button", { name: "Hold to run", exact: true })
        .boundingBox())!;
    const thumb = { x: j.x + j.width * 0.83, y: j.y + j.height / 2, id: 1 },
      run = { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 2 };
    const initial = Number(await sprite.getAttribute("data-x"));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [thumb],
    });
    await page.waitForTimeout(450);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(80);
    const walked = Number(await sprite.getAttribute("data-x")) - initial;
    expect(walked).toBeGreaterThan(35);
    await pause(page);
    await page
      .getByRole("button", { name: "Reset position", exact: true })
      .tap();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [thumb, run],
    });
    await expect(
      page.getByRole("button", { name: "Hold to run", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(450);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(80);
    const ran = Number(await sprite.getAttribute("data-x")) - 680;
    expect(ran).toBeGreaterThan(walked * 1.25);
    await expect(
      page.getByRole("button", { name: "Hold to run", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    const stopped = Number(await sprite.getAttribute("data-x"));
    await page.waitForTimeout(250);
    expect(Number(await sprite.getAttribute("data-x"))).toBeCloseTo(stopped, 0);
    await cdp.detach();
  });
});
