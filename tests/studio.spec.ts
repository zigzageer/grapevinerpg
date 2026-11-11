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
  let used = 0;
  const quota = () => ({ limit: 3, used, remaining: 3 - used });
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
    if (path === "/quota") return json(quota());
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
      if (used >= 3)
        return json(
          { error: "This IP address has used all 3 generation attempts." },
          429,
        );
      const input = route.request().postDataJSON();
      requests.push(input);
      used++;
      const id = input.characterId || `web-${input.requestId}`;
      const character: Character = {
        ...crew[1],
        id,
        name: input.name,
        preset: undefined,
        sprite: `/api/studio/assets/${input.requestId}.png`,
      };
      const key = `${input.gameId}/${id}`;
      const versions = history.get(key) || {
        currentVersionId: null,
        versions: [],
      };
      versions.versions.unshift({
        id: input.requestId,
        character,
        description: input.description,
        image: character.sprite!,
        source: "website",
        createdAt: new Date(Date.UTC(2026, 10, 11, 12, used)).toISOString(),
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
          image: character.sprite!,
        },
        error: null,
        quota: quota(),
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
  return { requests, games, history, quota };
}

async function openStudio(page: Page) {
  await page.getByRole("button", { name: "Choose characters", exact: true }).click();
  await page
    .getByRole("button", { name: "Add / edit character", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Make your character" }),
  ).toBeVisible();
  await expect(
    page.getByText("3 of 3 attempts left", { exact: true }),
  ).toBeVisible();
}

test("a visitor can add themselves from an uploaded reference, preview, and join the game", async ({
  page,
}) => {
  const api = await studioApi(page);
  await page.goto("/");
  await openStudio(page);
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("Nova");
  await page
    .getByRole("textbox", { name: "Appearance details", exact: true })
    .fill("A green winter coat and a red scarf");
  await page
    .getByLabel("Reference image", { exact: true })
    .setInputFiles({
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
  await expect(
    page.getByText("2 of 3 attempts left", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to game", exact: true }).click();
  await expect(
    page.getByText("Nova is ready in town.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Choose characters", exact: true }).click();
  await page.getByRole("button", { name: "Play as Nova", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose characters", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Choose characters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play as Nova", exact: true }),
  ).toBeVisible();
});

test("Miel can refine her details, use all three attempts, and restore her original from history", async ({
  page,
}) => {
  const api = await studioApi(page);
  await page.goto("/");
  await openStudio(page);
  await page
    .getByRole("button", { name: "Edit character", exact: true })
    .click();
  await page
    .getByLabel("Character to edit", { exact: true })
    .selectOption("friend-8");
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
  for (let remaining = 1; remaining >= 0; remaining--) {
    await page
      .getByRole("textbox", { name: "Appearance details", exact: true })
      .fill(`Green coat, scarf variation ${remaining}`);
    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect(
      page.getByText(`${remaining} of 3 attempts left`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use this version", exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Regenerate", exact: true }),
  ).toBeDisabled();
  expect(api.requests.length).toBe(3);
  expect(api.requests[1].useCurrent).toBe(true);
  await page
    .getByRole("button", { name: "Show character history", exact: true })
    .click();
  const history = page.getByRole("region", {
    name: "Character history",
    exact: true,
  });
  await expect(history.locator(".studio-history-grid > button")).toHaveCount(4);
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
  expect(api.quota().used).toBe(3);
  expect(api.history.get("mint/friend-8")!.versions).toHaveLength(4);
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
      .getByRole("button", { name: "Add yourself", exact: true })
      .click();
    await expect(
      page.getByText("3 of 3 attempts left", { exact: true }),
    ).toBeVisible();
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
      page.getByRole("button", { name: "Choose characters", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Choose characters", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Play as Mobile friend", exact: true }),
    ).toBeVisible();
  });
}
