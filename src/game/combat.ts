import { getSignatureMove } from "./abilities";
import type { Character } from "./model";

export type Side = "player" | "opponent";
export type TimingGrade = "perfect" | "good" | "miss";
export type BasicMoveId = "quick" | "heavy" | "snowball" | "spark" | "stomp";
export type MoveId = BasicMoveId | "signature";
export type AbilityVisual =
  | "grace"
  | "tag-team"
  | "burst"
  | "projectile"
  | "rush";

export interface Move {
  name: string;
  description: string;
  cost: number;
  damage: number;
  hits: number | readonly [min: number, max: number];
  armor: number;
  effect?: "burn" | "stun";
  visual?: AbilityVisual;
  art?: string;
  tag?: string;
}

export const MOVES: Record<BasicMoveId, Move> = {
  quick: {
    name: "Quick hits",
    description: "Three light hits. Armor reduces each hit.",
    cost: 0,
    damage: 8,
    hits: 3,
    armor: 1,
  },
  heavy: {
    name: "Heavy hit",
    description: "One big swing that punches through most armor.",
    cost: 0,
    damage: 22,
    hits: 1,
    armor: 0.25,
  },
  snowball: {
    name: "Snowball",
    description: "A ranged attack with a well-packed snowball.",
    cost: 0,
    damage: 19,
    hits: 1,
    armor: 1,
  },
  spark: {
    name: "Paper spark",
    description: "Ignores armor. Good timing adds two turns of burning.",
    cost: 3,
    damage: 19,
    hits: 1,
    armor: 0,
    effect: "burn",
  },
  stomp: {
    name: "Ground stomp",
    description: "A perfect hit stuns your opponent for one turn.",
    cost: 4,
    damage: 20,
    hits: 1,
    armor: 0.5,
    effect: "stun",
  },
};

export interface Fighter {
  name: string;
  hp: number;
  maxHp: number;
  pp: number;
  maxPp: number;
  armor: number;
  burning: number;
  stunned: boolean;
  signature?: Move;
}

export function getMove(fighter: Fighter, id: MoveId): Move | undefined {
  return id === "signature" ? fighter.signature : MOVES[id];
}

export interface BattleEvent {
  actor: Side;
  move: MoveId | "brace" | "snack" | "burn" | "stun";
  grade: TimingGrade;
  damage: number;
  text: string;
  hits?: number;
  visual?: AbilityVisual;
  art?: string;
  tag?: string;
}

export interface BattleState {
  player: Fighter;
  opponent: Fighter;
  phase: "choose" | "attack" | "block" | "impact" | "victory" | "defeat";
  move: MoveId;
  guarding: boolean;
  snacks: number;
  itemUsed: boolean;
  round: number;
  event: BattleEvent | null;
  eventId: number;
}

export type BattleAction =
  | { type: "choose"; move: MoveId }
  | { type: "timing"; grade: TimingGrade; roll?: number }
  | { type: "brace" }
  | { type: "snack" }
  | { type: "advance" };

export const TIMING_DURATION = 1800;
export const TIMING_TARGET = 0.7;
export const GOOD_WINDOW = 0.15;
export const PERFECT_WINDOW = 0.06;

export function timingGrade(progress: number): TimingGrade {
  const distance = Math.abs(progress - TIMING_TARGET);
  if (distance <= PERFECT_WINDOW) return "perfect";
  if (distance <= GOOD_WINDOW) return "good";
  return "miss";
}

export function createBattle(
  player: Character | string,
  opponent: Character | string,
): BattleState {
  const fighter = (character: Character | string, hp: number): Fighter => ({
    name: typeof character === "string" ? character : character.name,
    hp,
    maxHp: hp,
    pp: 6,
    maxPp: 6,
    armor: 3,
    burning: 0,
    stunned: false,
    signature:
      typeof character === "string" ? undefined : getSignatureMove(character),
  });
  return {
    player: fighter(player, 100),
    opponent: fighter(opponent, 90),
    phase: "choose",
    move: "quick",
    guarding: false,
    snacks: 2,
    itemUsed: false,
    round: 1,
    event: null,
    eventId: 0,
  };
}

function beginTurn(state: BattleState, side: Side): BattleState {
  const fighter = state[side];
  const damage = fighter.burning ? Math.min(4, fighter.hp) : 0;
  const next: BattleState = {
    ...state,
    [side]: {
      ...fighter,
      hp: fighter.hp - damage,
      burning: Math.max(0, fighter.burning - 1),
    },
  };
  if (damage) {
    next.event = {
      actor: side,
      move: "burn",
      grade: "good",
      damage,
      text: `${fighter.name} takes ${damage} burning damage.`,
    };
    next.eventId++;
  }
  if (next[side].hp === 0)
    return { ...next, phase: side === "player" ? "defeat" : "victory" };
  if (fighter.stunned) {
    next[side].stunned = false;
    next.event = {
      actor: side,
      move: "stun",
      grade: "perfect",
      damage,
      text: `${fighter.name} is stunned and misses a turn.${damage ? ` Burning deals ${damage} damage.` : ""}`,
    };
    next.eventId++;
    if (side === "player") next.round++;
    return beginTurn(next, side === "player" ? "opponent" : "player");
  }
  next[side].pp = Math.min(fighter.maxPp, fighter.pp + 1);
  if (side === "player")
    return {
      ...next,
      phase: "choose",
      guarding: false,
      itemUsed: false,
      round: state.round + 1,
    };
  const pattern = ["quick", "heavy", "spark"] as const;
  const planned = pattern[(state.round - 1) % pattern.length];
  const { pp, signature } = next.opponent;
  if (planned === "spark" && signature && pp >= signature.cost) {
    next.move = "signature";
    next.opponent.pp -= signature.cost;
  } else {
    next.move = pp >= MOVES[planned].cost ? planned : "quick";
    next.opponent.pp -= MOVES[next.move].cost;
  }
  next.phase = "block";
  return next;
}

function rollHits(hits: Move["hits"], roll: number): number {
  if (typeof hits === "number") return hits;
  const [min, max] = hits;
  const chance = Number.isFinite(roll) ? Math.max(0, Math.min(roll, 1)) : 0.5;
  return Math.min(max, min + Math.floor(chance * (max - min + 1)));
}

function resolveTiming(
  state: BattleState,
  grade: TimingGrade,
  roll = 0.5,
): BattleState {
  const side: Side = state.phase === "attack" ? "player" : "opponent";
  const other: Side = side === "player" ? "opponent" : "player";
  const move = getMove(state[side], state.move);
  if (!move) return state;
  const attackMultiplier =
    side === "opponent" ? 1 : { perfect: 1.5, good: 1, miss: 0.6 }[grade];
  const blockMultiplier =
    side === "player" ? 1 : { perfect: 0.2, good: 0.5, miss: 1 }[grade];
  const guardMultiplier = side === "opponent" && state.guarding ? 0.55 : 1;
  const perHit = Math.max(
    1,
    Math.round(
      (move.damage * attackMultiplier - state[other].armor * move.armor) *
        blockMultiplier *
        guardMultiplier,
    ),
  );
  const hits = rollHits(move.hits, roll);
  const damage = Math.min(state[other].hp, perHit * hits);
  const target = { ...state[other], hp: state[other].hp - damage };
  const appliesEffect =
    side === "player" ? grade !== "miss" : grade !== "perfect";
  const burns = move.effect === "burn" && appliesEffect;
  const stuns =
    move.effect === "stun" &&
    grade === (side === "player" ? "perfect" : "miss");
  const tag = appliesEffect ? move.tag : undefined;
  if (burns) target.burning = 2;
  if (stuns) target.stunned = true;
  const attacker = { ...state[side] };
  if (!move.cost) attacker.pp = Math.min(attacker.maxPp, attacker.pp + 1);
  if (side === "opponent" && grade === "perfect")
    target.pp = Math.min(target.maxPp, target.pp + 1);
  const feedback =
    side === "player"
      ? { perfect: "Perfect!", good: "Nice timing.", miss: "Off beat." }[grade]
      : { perfect: "Perfect block!", good: "Blocked!", miss: "Unblocked." }[
          grade
        ];
  const hitCount = hits > 1 ? ` across ${hits} hits` : "";
  const text = [
    `${feedback} ${attacker.name} uses ${move.name} for ${damage} damage${hitCount}.`,
    burns && `${target.name} is burning.`,
    stuns && `${target.name} is stunned.`,
    tag && `${target.name} is tagged ${tag}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ...state,
    [side]: attacker,
    [other]: target,
    phase: "impact",
    eventId: state.eventId + 1,
    event: {
      actor: side,
      move: state.move,
      grade,
      damage,
      hits,
      visual: move.visual,
      art: move.art,
      tag,
      text,
    },
  };
}

export function battleReducer(
  state: BattleState,
  action: BattleAction,
): BattleState {
  if (action.type === "advance" && state.phase === "impact") {
    if (!state.opponent.hp) return { ...state, phase: "victory" };
    if (!state.player.hp) return { ...state, phase: "defeat" };
    return beginTurn(
      state,
      state.event?.actor === "player" ? "opponent" : "player",
    );
  }
  if (action.type === "timing")
    return state.phase === "attack" || state.phase === "block"
      ? resolveTiming(state, action.grade, action.roll)
      : state;
  if (state.phase !== "choose") return state;
  if (action.type === "choose") {
    const move = getMove(state.player, action.move);
    if (!move || state.player.pp < move.cost) return state;
    return {
      ...state,
      phase: "attack",
      move: action.move,
      player: { ...state.player, pp: state.player.pp - move.cost },
    };
  }
  if (action.type === "brace")
    return {
      ...state,
      phase: "impact",
      guarding: true,
      player: {
        ...state.player,
        pp: Math.min(state.player.maxPp, state.player.pp + 2),
      },
      eventId: state.eventId + 1,
      event: {
        actor: "player",
        move: "brace",
        grade: "good",
        damage: 0,
        text: `${state.player.name} braces, restores 2 PP, and reduces the next attack.`,
      },
    };
  if (
    action.type === "snack" &&
    state.snacks > 0 &&
    !state.itemUsed &&
    state.player.hp < state.player.maxHp
  ) {
    const healed = Math.min(28, state.player.maxHp - state.player.hp);
    return {
      ...state,
      snacks: state.snacks - 1,
      itemUsed: true,
      player: { ...state.player, hp: state.player.hp + healed },
      eventId: state.eventId + 1,
      event: {
        actor: "player",
        move: "snack",
        grade: "good",
        damage: -healed,
        text: `${state.player.name} eats a snack and restores ${healed} HP. You can still attack.`,
      },
    };
  }
  return state;
}
