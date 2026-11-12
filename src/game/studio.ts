import { normalizeCharacter, type Character } from "./model";

export interface StudioGame {
  version: 1;
  guildId: string;
  slug: string;
  name: string;
  updatedAt: string;
  characters: Character[];
  managedIds?: string[];
  managedVersions?: Record<string, string>;
}
export interface CharacterVersion {
  id: string;
  character: Character;
  description: string;
  image: string | null;
  source: string;
  createdAt: string;
}
export interface CharacterHistory {
  currentVersionId: string | null;
  versions: CharacterVersion[];
}
export interface GenerationJob {
  id: string;
  gameId: string;
  characterId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result: { character: Character; versionId: string; image: string | null } | null;
  error: string | null;
}

export const studioAvailable = () =>
  window.location.protocol !== "file:" &&
  !(globalThis as { __MINT_ART__?: unknown }).__MINT_ART__;

export class StudioRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function studioRequest<T>(
  path: string,
  input?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/studio${path}`, {
    method: input === undefined ? "GET" : "POST",
    headers:
      input === undefined ? undefined : { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new StudioRequestError(
      data?.error ||
        "The character studio could not be reached. Please try again.",
      response.status,
    );
  return data as T;
}

export function mergeStudioCrew(
  local: Character[],
  shared: StudioGame,
  applied: Record<string, string> = {},
): Character[] {
  const managed = new Set(shared.managedIds || []);
  const remote = new Map(
    shared.characters.map((c) => [c.id, normalizeCharacter(c)]),
  );
  const result = local.map((character) => {
    const isNewVersion =
      !shared.managedVersions?.[character.id] ||
      applied[character.id] !== shared.managedVersions[character.id];
    const next =
      managed.has(character.id) && isNewVersion
        ? remote.get(character.id)
        : undefined;
    return next && JSON.stringify(next) !== JSON.stringify(character)
      ? next
      : character;
  });
  const existing = new Set(local.map((c) => c.id));
  for (const character of shared.characters) {
    if (managed.has(character.id) && !existing.has(character.id))
      result.push(normalizeCharacter(character));
  }
  return result.length === local.length &&
    result.every((character, index) => character === local[index])
    ? local
    : result;
}

const APPLIED_VERSIONS_KEY = "mint.studio.applied.v1";
export function readAppliedVersions(scope?: string): Record<string, string> {
  try {
    const value = JSON.parse(
      localStorage.getItem(scope ? `${APPLIED_VERSIONS_KEY}.${scope}` : APPLIED_VERSIONS_KEY) || "{}",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function rememberAppliedVersions(game: StudioGame, scope?: string) {
  try {
    localStorage.setItem(
      scope ? `${APPLIED_VERSIONS_KEY}.${scope}` : APPLIED_VERSIONS_KEY,
      JSON.stringify({ ...readAppliedVersions(scope), ...game.managedVersions }),
    );
  } catch {
    /* Gameplay and shared history remain available when device storage is full. */
  }
}
