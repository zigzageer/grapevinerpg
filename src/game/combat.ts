export type Side = "player" | "opponent";
export type TimingGrade = "perfect" | "good" | "miss";
export type MoveId = "quick" | "heavy" | "snowball" | "spark" | "stomp";

interface Move {
  name: string;
  description: string;
  cost: number;
  damage: number;
  hits: number;
  armor: number;
  effect?: "burn" | "stun";
}

export const MOVES: Record<MoveId, Move> = {
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
}

export interface BattleEvent {
  actor: Side;
  move: MoveId | "brace" | "snack" | "burn" | "stun";
  grade: TimingGrade;
  damage: number;
  text: string;
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
  | { type: "timing"; grade: TimingGrade }
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

export function createBattle(player: string, opponent: string): BattleState {
  const fighter = (name: string, hp: number): Fighter => ({
    name,
    hp,
    maxHp: hp,
    pp: 6,
    maxPp: 6,
    armor: 3,
    burning: 0,
    stunned: false,
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
  const pattern: MoveId[] = ["quick", "heavy", "spark"];
  const planned = pattern[(state.round - 1) % pattern.length];
  next.move = next.opponent.pp >= MOVES[planned].cost ? planned : "quick";
  next.opponent.pp -= MOVES[next.move].cost;
  next.phase = "block";
  return next;
}

function resolveTiming(state: BattleState, grade: TimingGrade): BattleState {
  const side: Side = state.phase === "attack" ? "player" : "opponent";
  const other: Side = side === "player" ? "opponent" : "player";
  const move = MOVES[state.move];
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
  const damage = Math.min(state[other].hp, perHit * move.hits);
  const target = { ...state[other], hp: state[other].hp - damage };
  const appliesEffect =
    side === "player" ? grade !== "miss" : grade !== "perfect";
  if (move.effect === "burn" && appliesEffect) target.burning = 2;
  if (move.effect === "stun" && grade === "perfect" && side === "player")
    target.stunned = true;
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
      text: `${feedback} ${state[side].name} uses ${move.name} for ${damage} damage.${target.stunned ? ` ${target.name} is stunned.` : ""}${move.effect === "burn" && appliesEffect ? ` ${target.name} is burning.` : ""}`,
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
      ? resolveTiming(state, action.grade)
      : state;
  if (state.phase !== "choose") return state;
  if (action.type === "choose") {
    const move = MOVES[action.move];
    if (state.player.pp < move.cost) return state;
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
