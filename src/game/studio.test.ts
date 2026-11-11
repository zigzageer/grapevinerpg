import { describe, expect, it } from "vitest";
import { DEFAULT_CREW, normalizeCharacter } from "./model";
import { mergeStudioCrew, type StudioGame } from "./studio";
import { parseServerGame } from "./server";

const image = "/api/studio/assets/12345678-1234-4234-8234-123456789012.png";
const game = (characters = DEFAULT_CREW): StudioGame => ({
  version: 1,
  guildId: "mint",
  name: "Mint",
  slug: "",
  updatedAt: "2026-11-11",
  characters,
  managedIds: [],
});

describe("shared generated characters", () => {
  it("preserves local names, uploaded sprites and extra friends until a shared edit is published", () => {
    const local = DEFAULT_CREW.map((c) =>
      c.id === "friend-8"
        ? { ...c, name: "My Miel", sprite: "data:image/png;base64,dGVzdA==" }
        : c,
    );
    expect(mergeStudioCrew(local, game())).toBe(local);
    const updated = {
      ...game(),
      managedIds: ["friend-8"],
      characters: DEFAULT_CREW.map((c) =>
        c.id === "friend-8"
          ? { ...c, name: "Miel updated", sprite: image, preset: undefined }
          : c,
      ),
    };
    const next = mergeStudioCrew(local, updated);
    expect(next.find((c) => c.id === "friend-8")?.sprite).toBe(image);
    expect(next.find((c) => c.id === "friend-7")).toBe(
      local.find((c) => c.id === "friend-7"),
    );
  });
  it("restores saved generated URLs and keeps new shared characters after refresh", () => {
    const character = {
      ...DEFAULT_CREW[1],
      id: "web-12345678-1234-4234-8234-123456789012",
      name: "Nova",
      sprite: image,
    };
    expect(normalizeCharacter(character).sprite).toBe(image);
    const shared = {
      ...game([...DEFAULT_CREW, character]),
      managedIds: [character.id],
    };
    const crew = mergeStudioCrew(DEFAULT_CREW, shared);
    expect(crew.at(-1)?.name).toBe("Nova");
    expect(mergeStudioCrew(crew, shared)).toBe(crew);
  });
  it("preserves later local workshop edits until the shared version changes", () => {
    const local = DEFAULT_CREW.map((c) =>
      c.id === "friend-8" ? { ...c, name: "My Miel" } : c,
    );
    const shared = {
      ...game(),
      managedIds: ["friend-8"],
      managedVersions: { "friend-8": "version-1" },
    };
    expect(mergeStudioCrew(local, shared, { "friend-8": "version-1" })).toBe(
      local,
    );
    expect(
      mergeStudioCrew(local, shared, { "friend-8": "older" }).find(
        (c) => c.id === "friend-8",
      )?.name,
    ).toBe("Miel");
  });
  it("supports website and Discord characters together in the same server", () => {
    const guildId = "123456789012345678";
    const character = {
      ...DEFAULT_CREW[1],
      id: "web-12345678-1234-4234-8234-123456789012",
      name: "Nova",
      sprite: image,
    };
    const parsed = parseServerGame(
      { ...game([character]), guildId, slug: `friends-${guildId}` },
      guildId,
    );
    expect(parsed.characters[0].sprite).toBe(image);
    expect(() =>
      parseServerGame(
        {
          ...parsed,
          characters: [
            { ...character, sprite: "https://untrusted.example/sprite.png" },
          ],
        },
        guildId,
      ),
    ).toThrow();
  });
});
