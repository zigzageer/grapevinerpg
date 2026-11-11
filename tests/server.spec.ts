import { test, expect } from "@playwright/test";
import { DEFAULT_CREW } from "../src/game/model";
const GUILD = "123456789012345678",
  OTHER = "223456789012345678",
  USER = "323456789012345678";
const makeGame = (id = GUILD) => ({
  version: 1,
  guildId: id,
  slug: `test-lounge-${id}`,
  name: "Test Lounge",
  updatedAt: "2026-01-01",
  characters: [] as object[],
});
const character = (guild = GUILD, name = "Server Bob") => ({
  ...DEFAULT_CREW[3],
  id: `discord-${USER}`,
  name,
  preset: undefined,
  sprite: `/games/${guild}/${USER}.png`,
});

test("empty server stays empty and becomes playable when a new character publishes", async ({
  page,
}) => {
  let game = makeGame();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(`**/games/${GUILD}/game.json`, (route) =>
    route.fulfill({ json: game }),
  );
  await page.route(`**/games/${GUILD}/${USER}.png`, (route) =>
    route.fulfill({
      path: "public/characters/david.png",
      contentType: "image/png",
    }),
  );
  await page.goto(`/${game.slug}`);
  await expect(
    page.getByRole("heading", { name: "Test Lounge" }),
  ).toBeVisible();
  await expect(page.getByText("0 characters", { exact: true })).toBeVisible();
  await expect(page.getByTestId("player-sprite")).toHaveCount(0);
  await page.keyboard.press("d");
  game = { ...game, updatedAt: "2026-01-02", characters: [character()] };
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Server Bob",
  );
  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Character selection" })
      .getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Character workshop" }),
  ).toHaveCount(0);
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button")
    .click();
  const sprite = page.getByTestId("player-sprite");
  const x = Number(await sprite.getAttribute("data-x"));
  await page.keyboard.down("d");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  expect(Number(await sprite.getAttribute("data-x"))).toBeGreaterThan(x + 10);
  expect(errors).toEqual([]);
});

test("server saves are isolated from Mint and other servers; later roster updates retain position", async ({
  page,
}) => {
  let game = { ...makeGame(), characters: [character()] };
  await page.route("**/games/*/game.json", (route) => {
    const other = route.request().url().includes(OTHER);
    return route.fulfill({
      json: other
        ? { ...makeGame(OTHER), characters: [character(OTHER, "Other Bob")] }
        : game,
    });
  });
  await page.route("**/games/*/*.png", (route) =>
    route.fulfill({
      path: "public/characters/david.png",
      contentType: "image/png",
    }),
  );
  await page.goto(`/${game.slug}`);
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Server Bob",
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  const x = Number(
    await page.getByTestId("player-sprite").getAttribute("data-x"),
  );
  await page.getByRole("button", { name: "Pause menu", exact: true }).click();
  await page.getByRole("switch", { name: "TV episode look" }).click();
  await page.getByRole("button", { name: "Resume game", exact: true }).click();
  await page.waitForTimeout(500);
  game = {
    ...game,
    updatedAt: "2026-01-02",
    characters: [
      character(),
      {
        ...character(),
        id: "discord-423456789012345678",
        name: "New Friend",
        sprite: `/games/${GUILD}/423456789012345678.png`,
      },
    ],
  };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Character selection" })
      .getByRole("button"),
  ).toHaveCount(2);
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button", { name: "Play as Server Bob", exact: true })
    .click();
  expect(
    Number(await page.getByTestId("player-sprite").getAttribute("data-x")),
  ).toBeCloseTo(x, 0);
  await page.goto(`/test-lounge-${OTHER}`);
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Other Bob",
  );
  await expect(page.locator(".play-screen")).toHaveAttribute(
    "data-tv-look",
    "true",
  );
  await page.goto("/");
  await expect(page.getByTestId("active-character-name")).toHaveText("Mint");
  await page.goto(`/${game.slug}`);
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Server Bob",
  );
  await expect(page.locator(".play-screen")).toHaveAttribute(
    "data-tv-look",
    "false",
  );
});

test("an unpublished server link shows a retry instead of the Mint roster", async ({
  page,
}) => {
  await page.route(`**/games/${GUILD}/game.json`, (route) =>
    route.fulfill({ status: 404, body: "Not found" }),
  );
  await page.goto(`/new-server-${GUILD}`);
  await expect(page.getByText(/This game isn’t available yet/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check for updates" }),
  ).toBeVisible();
  await expect(page.getByTestId("player-sprite")).toHaveCount(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`server game retains fullscreen and touch controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route(`**/games/${GUILD}/game.json`, (route) =>
      route.fulfill({ json: { ...makeGame(), characters: [character()] } }),
    );
    await page.goto(`/test-lounge-${GUILD}`);
    await expect(page.getByTestId("active-character-name")).toHaveText(
      "Server Bob",
    );
    const world = await page.getByTestId("game-viewport").boundingBox();
    expect(world).toEqual({ x: 0, y: 0, ...viewport });
    await expect(
      page.getByRole("button", { name: "Hold to run" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Move right", exact: true }),
    ).toBeVisible();
  });
}
