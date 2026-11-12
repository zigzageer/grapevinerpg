export interface MatchFighter {
  id: string;
  name: string;
  sprite: string | null;
  ability: string;
  hp: number;
  abilityUsed: boolean;
}

export interface MatchSide {
  guildId: string;
  name: string;
  players: MatchFighter[];
}

export interface MatchEvent {
  seq: number;
  kind: "attack" | "ability" | "knockout";
  actorId: string;
  targetId: string;
  move: string;
  damage: number;
  targetHp: number;
}

export interface MatchSnapshot {
  id: string;
  kind: "war" | "duel";
  status: "offered" | "signup" | "running" | "finished" | "cancelled";
  createdAt: number;
  joinUntil: number | null;
  minPlayersPerSide: number;
  sides: [MatchSide, MatchSide];
  turnFighterId: string | null;
  winnerSide: 0 | 1 | null;
  reason: string | null;
  events: MatchEvent[];
  replayUrl: string;
}

export function matchIdFromPath(path: string) {
  return /^\/wars\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/.exec(
    path,
  )?.[1];
}
