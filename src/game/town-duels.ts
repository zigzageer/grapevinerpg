import { studioRequest } from "./studio";

type FighterIds = [string, string];

export interface OnlineFightMarker {
  id: string;
  characterIds: FighterIds;
  x: number;
  y: number;
}

export interface MyTownDuel {
  id: string;
  characterIds: FighterIds;
  role: "challenger" | "opponent";
  status: "offered" | "fighting" | "finished";
  winnerCharacterId?: string;
}

export interface TownDuelsSnapshot {
  fights: OnlineFightMarker[];
  own: MyTownDuel | null;
}

export type TownDuelAction =
  | { action: "challenge"; opponentSessionId: string }
  | { action: "accept" | "decline" | "cancel"; duelId: string };

const empty: TownDuelsSnapshot = { fights: [], own: null };
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const fighters = (value: unknown): value is FighterIds =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(
    (key) => typeof key === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(key),
  );
const coordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function readTownDuels(input: unknown): TownDuelsSnapshot {
  const data = input as Partial<TownDuelsSnapshot> | null;
  if (!data || !Array.isArray(data.fights)) return empty;
  const fights = data.fights
    .slice(0, 32)
    .filter(
      (marker) =>
        marker &&
        id(marker.id) &&
        fighters(marker.characterIds) &&
        coordinate(marker.x) &&
        coordinate(marker.y),
    );
  const own = data.own;
  const valid =
    own &&
    id(own.id) &&
    fighters(own.characterIds) &&
    ["challenger", "opponent"].includes(own.role) &&
    ["offered", "fighting", "finished"].includes(own.status) &&
    (own.status !== "finished" ||
      own.characterIds.includes(own.winnerCharacterId ?? ""));
  return { fights, own: valid ? own : null };
}

export async function requestTownDuel(
  credentials: { worldId: string; sessionToken: string },
  action: TownDuelAction,
): Promise<TownDuelsSnapshot> {
  const { worldId, sessionToken } = credentials;
  const data = await studioRequest<unknown>(
    "/town-duels",
    { worldId, sessionToken, ...action },
    AbortSignal.timeout(5000),
  );
  return readTownDuels(data);
}
