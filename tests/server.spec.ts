import { test, expect, type BrowserContext } from "@playwright/test";
import { DEFAULT_CREW } from "../src/game/model";
import sampleGame from "../examples/server-town/game.json" with { type: "json" };
import sampleTown from "../examples/server-town/town.json" with { type: "json" };
import type { MatchSnapshot } from "../src/game/matches";
import { Presence } from "../server/presence.mjs";
import { TownDuels } from "../server/town-duels.mjs";
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
  await expect(
    page.getByRole("dialog", { name: "Choose a character" }),
  ).toBeVisible();
  await expect(page.getByTestId("player-sprite")).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "Character selection" })
      .getByRole("button", { name: /^Play as / }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Character workshop" }),
  ).toHaveCount(0);
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button", { name: "Play as Server Bob", exact: true })
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
  await page
    .getByRole("button", { name: "Play as Server Bob", exact: true })
    .click();
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
      .getByRole("button", { name: /^Play as / }),
  ).toHaveCount(2);
  await page
    .getByRole("group", { name: "Character selection" })
    .getByRole("button", { name: "Play as Server Bob", exact: true })
    .click();
  expect(
    Number(await page.getByTestId("player-sprite").getAttribute("data-x")),
  ).toBeCloseTo(x, 0);
  await page.goto(`/test-lounge-${OTHER}`);
  await page
    .getByRole("button", { name: "Play as Other Bob", exact: true })
    .click();
  await expect(page.getByTestId("active-character-name")).toHaveText(
    "Other Bob",
  );
  await expect(page.locator(".play-screen")).toHaveAttribute(
    "data-tv-look",
    "true",
  );
  await page.goto("/mint");
  await page.getByRole("button", { name: "Play as Mint", exact: true }).click();
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

test("a guild manifest loads its own town and walks to its landmarks", async ({
  page,
}) => {
  await page.route(`**/api/studio/games/${GUILD}`, (route) =>
    route.fulfill({ json: { ...sampleGame, characters: [character()] } }),
  );
  await page.route(`**${sampleGame.town.path}`, (route) =>
    route.fulfill({ json: sampleTown }),
  );
  await page.route(`**/games/${GUILD}/${USER}.png`, (route) =>
    route.fulfill({
      path: "public/characters/david.png",
      contentType: "image/png",
    }),
  );
  await page.goto(`/${sampleGame.slug}`);
  await page
    .getByRole("button", { name: "Play as Server Bob", exact: true })
    .click();
  await expect(page.getByTestId("server-town-scenery")).toBeVisible();
  const sprite = page.getByTestId("player-sprite");
  await expect(sprite).toHaveAttribute("data-x", String(sampleTown.spawn.x));
  await page.getByRole("button", { name: "Town map", exact: true }).click();
  await page
    .getByRole("button", { name: "Walk to Station Hall", exact: true })
    .click();
  await expect(sprite).toHaveAttribute("data-x", "460", { timeout: 10000 });
  await expect(sprite).toHaveAttribute("data-y", "414");
});

test("Grapevine is playable with the existing cast and its own destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/studio/games/mint", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await page.goto("/grapevine");
  const picker = page.getByRole("dialog", { name: "Choose a clan member" });
  await expect(
    picker.getByRole("button", { name: "Play as babashark", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Edit Miel", exact: true }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Play as Mint", exact: true })
    .click();
  const scenery = page.getByTestId("server-town-scenery");
  await expect(scenery).toBeVisible();
  const buildingArt = scenery.locator("[data-building] > image");
  await expect(buildingArt).toHaveCount(7);
  const loadedArt = await buildingArt.evaluateAll((elements) =>
    Promise.all(
      elements.map(async (element) => {
        const image = new Image();
        image.src = element.getAttribute("href")!;
        await image.decode();
        return image.naturalWidth;
      }),
    ),
  );
  expect(loadedArt.every((width) => width >= 640)).toBe(true);
  await expect(page.getByTestId("player-sprite")).toHaveAttribute(
    "data-x",
    "850",
  );
  await page.getByRole("button", { name: "Town map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Walk to Looksmaxxing Gym", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Walk to Netanyahu Press Room",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Walk to Iranian Bazaar", exact: true }),
  ).toBeVisible();
});

test("Grapevine's home and direct link share live players across browsers", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const rooms = new Presence();
  let online = true;
  const requests: string[] = [];
  let secondMintAttempts = 0;
  let refreshLobby: (() => void) | undefined;
  const lobbyWait = new Promise<void>((resolve) => {
    refreshLobby = resolve;
  });
  const mockPresence = async (context: BrowserContext) => {
    await context.route("**/api/studio/presence", async (route) => {
      const input = route.request().postDataJSON();
      requests.push(input.worldId);
      if (!online) return route.fulfill({ status: 503, json: {} });
      if (context === second && input.worldId === "grapevine") {
        if (input.action === "watch") await lobbyWait;
        if (input.characterId === "you") secondMintAttempts++;
      }
      return route.fulfill({ json: rooms.update(input) });
    });
  };
  try {
    await Promise.all([mockPresence(first), mockPresence(second)]);
    const home = await first.newPage();
    const direct = await second.newPage();
    await Promise.all([home.goto("/"), direct.goto("/grapevine")]);
    for (const page of [home, direct]) {
      await expect(page.getByTestId("server-town-scenery")).toBeVisible();
      await expect(
        page.getByRole("dialog", { name: "Choose a clan member" }),
      ).toBeVisible();
      await expect(page.getByTestId("player-sprite")).toHaveCount(0);
      await expect(page.locator(".world-citizen")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Play as Sarina", exact: true }),
      ).toBeVisible();
    }
    await home
      .getByRole("button", { name: "Play as Mint", exact: true })
      .click();
    const homeSprite = home.getByTestId("player-sprite");
    await expect(homeSprite).toHaveAttribute("data-character", "you");
    await expect(home.getByTestId("remote-player-sprite")).toHaveCount(0);
    await expect(home.locator(".world-citizen")).toHaveCount(0);
    const directMint = direct.getByRole("button", {
      name: "Play as Mint",
      exact: true,
    });
    await directMint.click();
    await expect(direct.getByText("Checking availability…")).toBeVisible();
    await expect(direct.getByTestId("player-sprite")).toHaveCount(0);
    await direct.keyboard.press("d");
    refreshLobby?.();
    await expect(directMint).toBeDisabled();
    await expect(directMint).toHaveAttribute(
      "aria-description",
      "Already playing in this town",
    );
    await expect(
      direct.getByText("Mint is already playing in this town."),
    ).toBeVisible();
    await expect(direct.getByTestId("player-sprite")).toHaveCount(0);
    expect(secondMintAttempts).toBe(1);
    const rejectedSave = await direct.evaluate(() =>
      JSON.parse(localStorage.getItem("grapevine.clan.v1") ?? "{}"),
    );
    expect(rejectedSave.activeCharacter).toBeUndefined();
    await direct
      .getByRole("button", { name: "Play as Zippy", exact: true })
      .click();
    const peer = home.getByTestId("remote-player-sprite");
    const local = direct.getByTestId("player-sprite");
    await expect(peer).toHaveCount(1);
    await expect(peer).toHaveAttribute("data-character", "friend-9");
    await expect(peer).toHaveAttribute("data-x", "850");
    await expect(peer.locator("image").first()).toHaveAttribute(
      "href",
      "/characters/zippy.png",
    );
    const screenX = () =>
      peer.evaluate((node) => (node as SVGGElement).getScreenCTM()!.e);
    const initialScreenX = await screenX();
    const peerSession = (await peer.getAttribute("data-session"))!;
    await expect(direct.getByTestId("remote-player-sprite")).toHaveAttribute(
      "data-character",
      "you",
    );
    await expect(home.locator(".world-citizen")).toHaveCount(0);

    await direct.keyboard.down("a");
    try {
      await expect
        .poll(async () => Number(await peer.getAttribute("data-x")))
        .toBeLessThan(805);
      await expect(peer.locator(".walking")).toHaveCount(1);
    } finally {
      await direct.keyboard.up("a");
    }
    await direct
      .getByRole("button", { name: "Pause menu", exact: true })
      .click();
    await expect(
      direct.getByRole("link", { name: "Visit Adventures of Mint" }),
    ).toHaveAttribute("href", "/mint");
    const stopped = (await local.getAttribute("data-x"))!;
    await expect(peer).toHaveAttribute("data-x", stopped);
    await expect(peer.locator(".walking")).toHaveCount(0);
    await expect.poll(screenX).toBeLessThan(initialScreenX - 30);
    await direct
      .getByRole("button", { name: "Choose character", exact: true })
      .click();
    await expect(directMint).toBeDisabled();
    await direct
      .getByRole("button", { name: "Play as David", exact: true })
      .click();
    await expect(peer).toHaveAttribute("data-session", peerSession);
    await expect(peer).toHaveAttribute("data-character", "friend-5");
    await expect(homeSprite).toHaveAttribute("data-character", "you");
    await expect(home.locator(".world-citizen")).toHaveCount(0);
    await expect(
      home.getByRole("button", { name: "Interact with Zippy" }),
    ).toHaveCount(0);

    online = false;
    await expect(peer).toHaveCount(0, { timeout: 8_000 });
    await expect(home.locator(".world-citizen")).toHaveCount(0);
    await expect(homeSprite).toHaveAttribute("data-x", "850");
    online = true;
    await home.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(peer).toHaveAttribute("data-session", peerSession, {
      timeout: 8_000,
    });

    const mintClaim = direct.waitForResponse((response) => {
      const request = response.request();
      return (
        request.url().endsWith("/api/studio/presence") &&
        request.postDataJSON().worldId === "mint" &&
        request.postDataJSON().characterId === "you" &&
        response.ok()
      );
    });
    await direct.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    await direct.goto("/mint");
    await direct
      .getByRole("button", { name: "Play as Mint", exact: true })
      .click();
    await expect(direct.getByTestId("server-town-scenery")).toHaveCount(0);
    expect((await (await mintClaim).json()).accepted).toBe(true);
    await expect(peer).toHaveCount(0, { timeout: 16_000 });
    await expect(home.locator(".world-citizen")).toHaveCount(0);
    await expect(direct.getByTestId("remote-player-sprite")).toHaveCount(0);
    await expect(direct.locator(".world-citizen, [data-resident]")).toHaveCount(
      0,
    );

    const homeRelease = home.waitForResponse(
      (response) =>
        response.url().endsWith("/api/studio/presence") &&
        response.request().postDataJSON()?.action === "release",
    );
    await home.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    expect((await (await homeRelease).json()).accepted).toBe(true);
    await home.goto("/grapevine");
    await expect(homeSprite).toHaveAttribute("data-character", "you");
    expect(new Set(requests)).toEqual(new Set(["grapevine", "mint"]));
  } finally {
    refreshLobby?.();
    await Promise.all([first.close(), second.close()]);
  }
});

test("a saved character in use reopens the picker and can be reclaimed after release", async ({
  browser,
}) => {
  const owner = await browser.newContext();
  const guest = await browser.newContext();
  const presence = new Presence();
  const joinTown = (context: BrowserContext) =>
    context.route("**/api/studio/presence", (route) =>
      route.fulfill({ json: presence.update(route.request().postDataJSON()) }),
    );
  try {
    await Promise.all([joinTown(owner), joinTown(guest)]);
    const first = await owner.newPage();
    await first.goto("/");
    await first
      .getByRole("button", { name: "Play as Mint", exact: true })
      .click();
    await expect(first.getByTestId("player-sprite")).toHaveAttribute(
      "data-character",
      "you",
    );
    const second = await guest.newPage();
    await second.addInitScript(
      (crew) => {
        if (!localStorage.getItem("grapevine.clan.v1")) {
          localStorage.setItem(
            "grapevine.clan.v1",
            JSON.stringify({
              version: 1,
              castVersion: 11,
              activeCharacter: "you",
              player: { x: 850, y: 590 },
              crew,
            }),
          );
        }
      },
      DEFAULT_CREW.map((c) =>
        c.id === "you"
          ? { ...c, name: "My Mint", sprite: "data:image/png;base64,AA==" }
          : c,
      ),
    );
    await second.goto("/grapevine");
    const mint = second.getByRole("button", {
      name: "Play as My Mint",
      exact: true,
    });
    await expect(mint).toBeDisabled();
    await expect(
      second.getByText("My Mint is already playing in this town."),
    ).toBeVisible();
    await expect(second.getByTestId("player-sprite")).toHaveCount(0);
    const release = first.waitForResponse(
      (response) =>
        response.url().endsWith("/api/studio/presence") &&
        response.request().postDataJSON()?.action === "release",
    );
    await first.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    expect((await (await release).json()).accepted).toBe(true);
    await first.goto("/mint");
    await expect(mint).toBeEnabled();
    await mint.click();
    await expect(second.getByTestId("player-sprite")).toHaveAttribute(
      "data-character",
      "you",
    );
  } finally {
    await Promise.all([owner.close(), guest.close()]);
  }
});

test("clicking a live player starts an accepted fight visible to the town", async ({
  browser,
}) => {
  let now = 0;
  const presence = new Presence({ now: () => now });
  const duels = new TownDuels({
    presence,
    now: () => now,
    getCharacter: (_worldId, id) => DEFAULT_CREW.find((c) => c.id === id),
  });
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    await Promise.all(
      contexts.map(async (context) => {
        await context.route("**/api/studio/presence", (route) => {
          const input = route.request().postDataJSON();
          return route.fulfill({
            json: {
              ...presence.update(input),
              duels: duels.snapshot(input.worldId, input.sessionToken),
            },
          });
        });
        await context.route("**/api/studio/town-duels", (route) =>
          route.fulfill({ json: duels.act(route.request().postDataJSON()) }),
        );
      }),
    );
    const [mint, zippy, spectator] = await Promise.all(
      contexts.map(async (context) => {
        const page = await context.newPage();
        if (context !== contexts[0]) {
          const x = context === contexts[1] ? 730 : 960;
          await page.addInitScript(
            ({ crew, x }) => {
              localStorage.setItem(
                "grapevine.clan.v1",
                JSON.stringify({
                  version: 1,
                  castVersion: 12,
                  player: { x, y: 590 },
                  crew,
                }),
              );
            },
            { crew: DEFAULT_CREW, x },
          );
        }
        await page.goto("/grapevine");
        return page;
      }),
    );
    for (const [page, name] of [
      [mint, "Mint"],
      [zippy, "Zippy"],
      [spectator, "David"],
    ] as const) {
      await page
        .getByRole("button", { name: `Play as ${name}`, exact: true })
        .click();
      await expect(page.getByTestId("player-sprite")).toBeVisible();
    }
    const opponent = mint.getByRole("button", {
      name: "Interact with Zippy",
      exact: true,
    });
    await expect(opponent).toHaveAttribute("aria-description", "Online player");
    await expect(opponent.getByTestId("remote-player-sprite")).toHaveAttribute(
      "data-x",
      "730",
    );
    await opponent.click();
    await mint
      .getByRole("dialog", { name: "Zippy" })
      .getByRole("button", { name: "Fight", exact: true })
      .click();
    await expect(mint.getByText("Waiting for Zippy")).toBeVisible();
    await expect(
      spectator.getByRole("region", { name: "Online fight" }),
    ).toHaveCount(0);
    await zippy.getByRole("button", { name: "Accept fight" }).click();
    for (const page of [mint, zippy, spectator]) {
      await expect(page.getByTestId("town-fight")).toHaveAttribute(
        "aria-label",
        "Fight in progress: Mint vs Zippy",
      );
    }
    await expect(
      spectator.getByRole("button", {
        name: "Interact with Zippy",
        exact: true,
      }),
    ).toHaveCount(0);
    now = 6_000;
    const result = /^(Mint|Zippy) wins!$/;
    await expect(mint.getByText(result)).toBeVisible();
    await expect(zippy.getByText(result)).toHaveText(
      await mint.getByText(result).innerText(),
    );
    await expect(spectator.getByTestId("town-fight")).toHaveCount(0);
    await expect(opponent).toHaveCount(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("the battle page reads the signup and steps through the finished replay", async ({
  page,
}) => {
  const id = "00000000-1000-4000-8000-000000000001";
  const now = Date.now();
  let match: MatchSnapshot = {
    id,
    kind: "war",
    status: "signup",
    createdAt: now,
    joinUntil: now + 120000,
    minPlayersPerSide: 1,
    winnerSide: null,
    reason: null,
    turnFighterId: null,
    replayUrl: `/wars/${id}`,
    events: [],
    sides: [
      {
        guildId: GUILD,
        name: "Grapevine",
        players: [
          {
            id: "fighter-a",
            name: "Mint",
            sprite: null,
            ability: "Power Strike",
            hp: 100,
            abilityUsed: false,
          },
        ],
      },
      {
        guildId: OTHER,
        name: "Signal Yard",
        players: [
          {
            id: "fighter-b",
            name: "Bob",
            sprite: null,
            ability: "Power Strike",
            hp: 100,
            abilityUsed: false,
          },
        ],
      },
    ],
  };
  await page.route(`**/api/studio/matches/${id}`, (route) =>
    route.fulfill({ json: match }),
  );
  await page.goto(`/wars/${id}`);
  await expect(page.getByText("Signup open", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Join in Discord. 1 needed per side."),
  ).toBeVisible();
  match = {
    ...match,
    status: "finished",
    winnerSide: 0,
    events: [
      {
        seq: 1,
        kind: "knockout",
        actorId: "fighter-a",
        targetId: "fighter-b",
        move: "Power Strike",
        damage: 100,
        targetHp: 0,
      },
    ],
  };
  match.sides[1].players[0].hp = 0;
  await expect(page.getByText("Grapevine wins", { exact: true })).toBeVisible({
    timeout: 8000,
  });
  const hp = page.getByRole("meter", { name: "Bob health" });
  await expect(hp).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(hp).toHaveAttribute("value", "100");
  await expect(hp).toHaveAttribute("value", "0");
});

test("the automatic fight replay shows recovery and missed turns", async ({
  page,
}) => {
  const id = "00000000-1000-4000-8000-000000000002";
  const match: MatchSnapshot = {
    id,
    kind: "duel",
    mode: "auto",
    status: "finished",
    createdAt: Date.now(),
    joinUntil: null,
    minPlayersPerSide: 1,
    winnerSide: 0,
    reason: null,
    turnFighterId: null,
    replayUrl: `/wars/${id}`,
    sides: [
      {
        guildId: GUILD,
        name: "Grapevine",
        players: [
          {
            id: "a",
            name: "Mint",
            sprite: null,
            ability: "Peppermint Pop",
            hp: 100,
            startingHp: 100,
            abilityUsed: true,
          },
        ],
      },
      {
        guildId: GUILD,
        name: "Grapevine",
        players: [
          {
            id: "b",
            name: "Bob",
            sprite: null,
            ability: "Recover",
            hp: 0,
            startingHp: 100,
            abilityUsed: true,
          },
        ],
      },
    ],
    events: [
      {
        seq: 1,
        kind: "attack",
        actorId: "a",
        targetId: "b",
        move: "Strike",
        damage: 22,
        targetHp: 78,
      },
      {
        seq: 2,
        kind: "ability",
        actorId: "b",
        targetId: "a",
        move: "Recover",
        damage: 0,
        targetHp: 100,
        actorHp: 96,
      },
      {
        seq: 3,
        kind: "attack",
        actorId: "a",
        targetId: "b",
        move: "Stunned",
        damage: 0,
        targetHp: 96,
      },
      {
        seq: 4,
        kind: "ability",
        actorId: "a",
        targetId: "b",
        move: "Peppermint Pop",
        damage: 96,
        targetHp: 0,
      },
    ],
  };
  await page.route(`**/api/studio/matches/${id}`, (route) =>
    route.fulfill({ json: match }),
  );
  await page.goto(`/wars/${id}`);
  await expect(page.getByRole("main", { name: "Discord Fight" })).toBeVisible();
  const next = page.getByRole("button", { name: "Next move" });
  const hp = page.getByRole("meter", { name: "Bob health" });
  await next.click();
  await expect(hp).toHaveAttribute("value", "78");
  await next.click();
  await expect(hp).toHaveAttribute("value", "96");
  await expect(page.getByText("Recovered to 96 HP")).toBeVisible();
  await next.click();
  await expect(page.getByText("Bob missed a turn")).toBeVisible();
  await next.click();
  await expect(hp).toHaveAttribute("value", "0");
  await expect(page.getByText("Mint wins", { exact: true })).toBeVisible();
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
    await page
      .getByRole("button", { name: "Play as Server Bob", exact: true })
      .click();
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
