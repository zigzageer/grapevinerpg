import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DEFAULT_CREW, type Character } from "../src/game/model";
import type {
  CharacterHistory,
  CharacterVersion,
  GenerationJob,
  StudioGame,
} from "../src/game/studio";

const GUILD = "123456789012345678";
const reference = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);

async function studioApi(page: Page) {
  const crew = DEFAULT_CREW.filter(
    (c) => c.kind === "mint" || c.preset || c.sprite,
  );
  const games = new Map<string, StudioGame>([
    [
      "mint",
      {
        version: 1,
        guildId: "mint",
        name: "Adventures of Mint",
        slug: "",
        updatedAt: "2026-01-01",
        characters: structuredClone(crew),
        managedIds: [],
      },
    ],
    [
      GUILD,
      {
        version: 1,
        guildId: GUILD,
        name: "Friends",
        slug: `friends-${GUILD}`,
        updatedAt: "2026-01-01",
        characters: [],
        managedIds: [],
      },
    ],
  ]);
  const history = new Map<string, CharacterHistory>();
  for (const c of crew) {
    const original: CharacterVersion = {
      id: randomUUID(),
      character: c,
      description: c.id === "friend-8" ? "Long brown hair and bunny ears" : "",
      image: c.preset ? `/characters/${c.preset}.png` : "/characters/mint.png",
      source: "original",
      createdAt: "2026-01-01",
    };
    history.set(`mint/${c.id}`, {
      currentVersionId: original.id,
      versions: [original],
    });
  }
  const jobs = new Map<string, GenerationJob>();
  const requests: Record<string, unknown>[] = [];
  const artwork = readFileSync(
    new URL("../public/characters/miel.png", import.meta.url),
  );
  await page.route("**/api/studio/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice("/api/studio".length);
    const parts = path.split("/").filter(Boolean);
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (parts[0] === "games" && parts.length === 2)
      return json(games.get(parts[1]));
    if (parts[0] === "drafts") return json([]);
    if (parts[0] === "assets")
      return route.fulfill({ contentType: "image/png", body: artwork });
    if (parts[0] === "games" && parts[4] === "history")
      return json(
        history.get(`${parts[1]}/${parts[3]}`) || {
          currentVersionId: null,
          versions: [],
        },
      );
    if (parts[0] === "jobs")
      return jobs.has(parts[1])
        ? json(jobs.get(parts[1]))
        : json({ error: "Generation not found." }, 404);
    if (path === "/generations") {
      const input = route.request().postDataJSON();
      requests.push(input);
      const id = input.characterId || `web-${input.requestId}`;
      const key = `${input.gameId}/${id}`;
      const versions = history.get(key) || {
        currentVersionId: null,
        versions: [],
      };
      const base = versions.versions.find(
        (version) =>
          version.id ===
          (input.referenceVersionId || versions.currentVersionId),
      );
      const character: Character = input.abilityOnly
        ? { ...base!.character }
        : {
            ...(base?.character || crew[1]),
            id,
            name: input.name,
            preset: undefined,
            sprite: `/api/studio/assets/${input.requestId}.png`,
          };
      if (input.abilityPrompt)
        character.ability = {
          name: "Coffee Comet",
          description: "A flying cup of coffee crashes into your opponent.",
          style: "projectile",
          art: `/api/studio/assets/${randomUUID()}.png`,
        };
      const image = input.abilityOnly ? base!.image : character.sprite!;
      versions.versions.unshift({
        id: input.requestId,
        character,
        description: input.abilityOnly ? base!.description : input.description,
        image,
        source: "website",
        createdAt: new Date(
          Date.UTC(2026, 10, 11, 12, requests.length),
        ).toISOString(),
      });
      history.set(key, versions);
      const job: GenerationJob = {
        id: input.requestId,
        gameId: input.gameId,
        characterId: id,
        status: "succeeded",
        result: {
          character,
          versionId: input.requestId,
          image,
        },
        error: null,
      };
      jobs.set(job.id, job);
      return json({ ...job, status: "queued", result: null }, 202);
    }
    if (parts[0] === "games" && parts[4] === "apply") {
      const game = games.get(parts[1])!;
      const versions = history.get(`${parts[1]}/${parts[3]}`)!;
      const selected = versions.versions.find(
        (v) => v.id === route.request().postDataJSON().versionId,
      )!;
      versions.currentVersionId = selected.id;
      const current = game.characters.findIndex((c) => c.id === parts[3]);
      if (current >= 0) game.characters[current] = { ...selected.character };
      else game.characters.push({ ...selected.character });
      game.managedIds = [...new Set([...(game.managedIds || []), parts[3]])];
      game.updatedAt = new Date().toISOString();
      return json(game);
    }
    return json({ error: "Studio endpoint not found." }, 404);
  });
  return { requests, games, history };
}

async function openStudio(page: Page) {
  await page
    .getByRole("button", { name: "Add character", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Add character" }),
  ).toBeVisible();
}

test("a visitor can add themselves from an uploaded reference, preview, and join the game", async ({
  page,
}) => {
  const api = await studioApi(page);
  await page.goto("/mint");
  await openStudio(page);
  await expect(
    page.getByRole("textbox", { name: "Character name", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("Nova");
  await page
    .getByRole("textbox", { name: "Appearance details", exact: true })
    .fill("A green winter coat and a red scarf");
  await page.getByLabel("Reference image", { exact: true }).setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: reference,
  });
  await page
    .getByRole("button", { name: "Generate character", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to game", exact: true }),
  ).toBeVisible();
  expect(api.requests[0].image).toMatchObject({
    type: "image/png",
    base64: reference.toString("base64"),
  });
  expect(api.games.get("mint")!.characters.some((c) => c.name === "Nova")).toBe(
    false,
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Edit Miel", exact: true }).click();
  const mielEditor = page.getByRole("dialog", {
    name: "Edit Miel",
    exact: true,
  });
  await expect(mielEditor.getByLabel("Character name")).toBeEnabled();
  await expect(mielEditor.getByLabel("Character name")).toHaveValue("Miel");
  await mielEditor.getByRole("button", { name: "Close dialog" }).click();
  await openStudio(page);
  await page.getByRole("button", { name: "Add to game", exact: true }).click();
  await expect(
    page.getByText("Nova is ready in town.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Play as Nova", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose characters", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play as Nova", exact: true }),
  ).toBeVisible();
});

test("Miel can generate more than three edits and restore her original from history", async ({
  page,
}) => {
  const api = await studioApi(page);
  const sharedMiel = api.games
    .get("mint")!
    .characters.find((c) => c.id === "friend-8")!;
  sharedMiel.preset = undefined;
  const roster = page.waitForResponse("**/api/studio/games/mint");
  await page.goto("/mint");
  await roster;
  await page.getByRole("button", { name: "Play as Mint", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit babashark", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit babashark", exact: true })
      .getByRole("textbox", { name: "Appearance details", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Edit Miel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Miel" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Appearance details", exact: true }),
  ).toHaveValue("Long brown hair and bunny ears");
  await page
    .getByRole("textbox", { name: "Appearance details", exact: true })
    .fill("Bunny ears, a green coat, and a pink scarf");
  await page
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use this version", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use this version", exact: true })
    .click();
  for (let version = 2; version <= 4; version++) {
    await page
      .getByRole("textbox", { name: "Appearance details", exact: true })
      .fill(`Green coat, scarf variation ${version}`);
    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Use this version", exact: true }),
    ).toBeEnabled();
  }
  await expect(
    page.getByRole("button", { name: "Regenerate", exact: true }),
  ).toBeEnabled();
  expect(api.requests.length).toBe(4);
  expect(api.requests[0].characterId).toBe("friend-8");
  expect(api.requests[1].useCurrent).toBe(true);
  await page
    .getByRole("button", { name: "Show character history", exact: true })
    .click();
  const history = page.getByRole("region", {
    name: "Character history",
    exact: true,
  });
  await expect(history.locator(".studio-history-grid > button")).toHaveCount(5);
  await history
    .getByRole("button")
    .filter({ hasText: "Original character" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Appearance details", exact: true }),
  ).toHaveValue("Long brown hair and bunny ears");
  await page
    .getByRole("button", { name: "Use this version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Current version", exact: true }),
  ).toBeDisabled();
  expect(api.history.get("mint/friend-8")!.versions).toHaveLength(5);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play as Mint", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("an ability-only preview keeps the sprite and equips the move until history is restored", async ({
  page,
}) => {
  const api = await studioApi(page);
  await page.goto("/mint");
  await page.getByRole("button", { name: "Edit Mint", exact: true }).click();
  const studio = page.getByRole("dialog", { name: "Edit Mint", exact: true });
  const original = api.history.get("mint/you")!.versions[0];
  await studio
    .getByRole("checkbox", { name: "Keep this version’s appearance" })
    .check();
  await expect(
    studio.getByRole("textbox", { name: "Appearance details" }),
  ).toBeHidden();
  await expect(
    studio.getByRole("button", { name: "Generate ability" }),
  ).toBeDisabled();
  await studio
    .getByRole("textbox", { name: "Signature ability", exact: true })
    .fill("Throw a paper coffee cup at the opponent.");
  await studio
    .getByRole("button", { name: "Generate ability", exact: true })
    .click();
  const preview = studio.getByRole("figure", {
    name: "Signature ability preview",
  });
  await expect(preview).toContainText("Coffee Comet");
  const art = await preview.locator("img").getAttribute("src");
  expect(art).toMatch(/^\/api\/studio\/assets\/.+\.png$/);
  await expect(studio.locator(".studio-character-stage image")).toHaveAttribute(
    "href",
    "/characters/mint.png",
  );
  expect(api.requests[0]).toMatchObject({
    characterId: "you",
    abilityOnly: true,
    referenceVersionId: original.id,
    abilityPrompt: "Throw a paper coffee cup at the opponent.",
  });
  expect(api.requests[0]).not.toHaveProperty("description");
  expect(api.games.get("mint")!.characters[0].ability).toBeUndefined();
  await studio.getByRole("button", { name: "Use this version" }).click();
  await expect(studio.getByText("Mint is ready in town.")).toBeVisible();
  await studio.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Play as Mint", exact: true }).click();

  await page
    .getByRole("button", { name: "Interact with Sarina", exact: true })
    .click();
  await page.getByRole("button", { name: "Fight", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use Peppermint Pop" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Use Coffee Comet", exact: true })
    .click();
  await page.getByRole("button", { name: "Strike!", exact: true }).click();
  await expect(
    page.locator('.duo-stage[data-visual="projectile"] .battle-projectile img'),
  ).toHaveAttribute("src", art!);
  await page.getByRole("button", { name: "Leave fight", exact: true }).click();

  await page
    .getByRole("button", { name: "Choose characters", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Mint", exact: true }).click();
  await studio.getByRole("button", { name: "Show character history" }).click();
  await studio.getByRole("button", { name: "Original character" }).click();
  await expect(preview).toContainText("Peppermint Pop");
  await studio.getByRole("button", { name: "Use this version" }).click();
  await expect(
    studio.getByRole("button", { name: "Current version", exact: true }),
  ).toBeDisabled();
  expect(api.games.get("mint")!.characters[0].ability).toBeUndefined();
  expect(api.requests).toHaveLength(1);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`an empty Discord town accepts a website character at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await studioApi(page);
    await page.goto(`/friends-${GUILD}`);
    await page
      .getByRole("button", { name: "Add character", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Character name", exact: true })
      .fill("Mobile friend");
    await page
      .getByRole("textbox", { name: "Appearance details", exact: true })
      .fill("A purple winter coat");
    await page
      .getByRole("button", { name: "Generate character", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add to game", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Choose a character", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Play as Mobile friend", exact: true }),
    ).toBeVisible();
  });
}
