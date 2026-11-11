import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CREW, SAVE_KEY, START } from "./model";
import {
  loadServerSave,
  parseServerGame,
  serverIdFromPath,
  serverSaveKey,
  type ServerGame,
} from "./server";
const id = "123456789012345678",
  user = "223456789012345678";
const server: ServerGame = {
  version: 1,
  guildId: id,
  slug: `mint-lounge-${id}`,
  name: "Mint Lounge",
  updatedAt: "2026-01-01",
  characters: [],
};
const character = {
  ...DEFAULT_CREW[3],
  id: `discord-${user}`,
  name: "Bob",
  preset: undefined,
  sprite: `/games/${id}/${user}.png`,
};
afterEach(() => vi.unstubAllGlobals());

describe("server games", () => {
  it("recognizes unique root links and rejects unrelated paths", () => {
    expect(serverIdFromPath(`/mint-lounge-${id}/`)).toBe(id);
    for (const path of [
      "/",
      "/mint-lounge",
      `/games/${id}/game.json`,
      "/mint-123",
      "/../other",
    ])
      expect(serverIdFromPath(path)).toBeNull();
  });
  it("accepts a genuinely empty roster and validates sprite paths and membership", () => {
    expect(parseServerGame(server, id).characters).toEqual([]);
    expect(
      parseServerGame({ ...server, characters: [character] }, id).characters[0]
        .sprite,
    ).toBe(character.sprite);
    expect(() => parseServerGame(server, user)).toThrow();
    expect(() =>
      parseServerGame({ ...server, characters: [character, character] }, id),
    ).toThrow();
    expect(() =>
      parseServerGame(
        {
          ...server,
          characters: [
            { ...character, sprite: "https://example.com/track.png" },
          ],
        },
        id,
      ),
    ).toThrow();
  });
  it("never migrates the Mint cast into a server and isolates device saves", () => {
    const saves = new Map([
      [SAVE_KEY, JSON.stringify({ version: 1, crew: DEFAULT_CREW })],
      [
        serverSaveKey(id),
        JSON.stringify({
          version: 1,
          activeCharacter: character.id,
          tvLook: false,
          player: START,
          crew: DEFAULT_CREW,
        }),
      ],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saves.get(key) || null,
    });
    expect(loadServerSave(server).crew).toEqual([]);
    const loaded = loadServerSave({ ...server, characters: [character] });
    expect(loaded.crew).toEqual([character]);
    expect(loaded.activeCharacter).toBe(character.id);
    expect(loaded.tvLook).toBe(false);
    expect(
      loadServerSave({ ...server, guildId: user, characters: [character] })
        .tvLook,
    ).toBe(true);
  });
  it("retains fresh published artwork instead of stale local crew data", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          version: 1,
          activeCharacter: "removed",
          player: { x: -1, y: -1 },
          crew: [{ ...character, name: "Stale" }],
        }),
    });
    const loaded = loadServerSave({ ...server, characters: [character] });
    expect(loaded.crew[0].name).toBe("Bob");
    expect(loaded.activeCharacter).toBeUndefined();
    expect(loaded.player).toEqual(START);
  });
});
