import {
  canStand,
  initialSave,
  normalizeCharacter,
  START,
  type Character,
  type SaveGame,
} from "./model";
import { townPath, type ServerTown } from "./server-town";

export interface ServerGame {
  version: 1;
  guildId: string;
  slug: string;
  name: string;
  updatedAt: string;
  town?: { path: string };
  characters: Character[];
}

export const serverSaveKey = (id: string) => `grapevine.server.${id}.v1`;

export function serverIdFromPath(path: string): string | null {
  return /^\/[a-z0-9-]+-(\d{17,20})\/?$/.exec(path)?.[1] ?? null;
}

export function parseServerGame(input: unknown, guildId: string): ServerGame {
  const data = input as ServerGame;
  if (
    !data ||
    data.version !== 1 ||
    data.guildId !== guildId ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    typeof data.slug !== "string" ||
    serverIdFromPath(`/${data.slug}`) !== guildId ||
    !Number.isFinite(Date.parse(data.updatedAt)) ||
    (data.town !== undefined && data.town?.path !== townPath(guildId)) ||
    !Array.isArray(data.characters) ||
    data.characters.length > 24
  )
    throw new Error("This server’s game data could not be read.");
  const ids = new Set<string>();
  const characters = data.characters.map((raw) => {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      !/^(discord-\d{17,20}|web-[a-f0-9-]{36})$/.test(raw.id) ||
      typeof raw.name !== "string" ||
      !raw.name.trim() ||
      ids.has(raw.id) ||
      typeof raw.sprite !== "string" ||
      (!/^\/api\/studio\/assets\/[a-f0-9-]{36}\.png$/.test(raw.sprite) &&
        !(
          raw.id.startsWith("discord-") &&
          raw.sprite === `/games/${guildId}/${raw.id.slice(8)}.png`
        ))
    )
      throw new Error("This server’s character data could not be read.");
    ids.add(raw.id);
    return {
      ...normalizeCharacter(raw),
      kind: "human" as const,
      preset: undefined,
      sprite: raw.sprite,
    };
  });
  return { ...data, name: data.name.slice(0, 100), characters };
}

// Server rosters are authoritative; local saves hold play preferences and position only.
// In particular, never run the Mint cast migrations for a server game.
export function loadServerSave(
  server: ServerGame,
  town?: ServerTown,
  saveKey = serverSaveKey(server.guildId),
): SaveGame {
  let saved: Partial<SaveGame> & { layoutGuildId?: string } = {};
  try {
    const raw = JSON.parse(localStorage.getItem(saveKey) || "null");
    if (raw?.version === 1) saved = raw;
  } catch {
    /* A missing or damaged device save starts at the town center. */
  }
  return {
    ...initialSave(),
    crew: server.characters,
    player:
      saved.layoutGuildId === town?.guildId &&
      saved.player &&
      Number.isFinite(saved.player.x) &&
      Number.isFinite(saved.player.y) &&
      canStand(saved.player, town?.walkArea)
        ? saved.player
        : { ...(town?.spawn ?? START) },
    activeCharacter: server.characters.some(
      (c) => c.id === saved.activeCharacter,
    )
      ? saved.activeCharacter
      : undefined,
    tvLook: saved.tvLook !== false,
  };
}
