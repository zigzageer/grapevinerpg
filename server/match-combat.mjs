import {
  BASIC_MOVES,
  castPreset,
  getSignatureMoves,
} from "../src/game/ability-moves.mjs";

const AUTO_BASIC_MOVES = [
  { ...BASIC_MOVES.quick, visual: "strike" },
  { ...BASIC_MOVES.heavy, visual: "strike" },
  { ...BASIC_MOVES.snowball, visual: "projectile" },
];
const CAST_VISUALS = {
  grace: { visual: "rush", art: "/characters/grace.png" },
  "tag-team": { visual: "rush", art: "/abilities/tag-team.webp" },
  "diddy-party": { visual: "burst" },
  "kick-the-baby": {
    visual: "projectile",
    art: "/abilities/babashark-daughter.webp",
  },
  "simps-assemble": { visual: "burst", art: "/abilities/simps-assemble.webp" },
  chaz: { visual: "rush", art: "/abilities/chaz-corvette.webp" },
};

export function builtInFightSprite(character) {
  if (character.kind === "mint") return "/characters/mint.png";
  const preset = castPreset(character);
  return preset ? `/characters/${preset}.png` : null;
}

function roll(match, size) {
  match.rng = (Math.imul(match.rng, 1664525) + 1013904223) >>> 0;
  return Math.floor((match.rng / 0x100000000) * size);
}

function hit(match, actor, target, kind, damage, move, details) {
  target.hp = Math.max(0, target.hp - damage);
  match.events.push({
    seq: match.events.length + 1,
    kind,
    actorId: actor.id,
    targetId: target.id,
    move,
    damage,
    targetHp: target.hp,
    ...details,
  });
}

function finish(match, side) {
  match.status = "finished";
  match.winnerSide = side;
  match.turnFighterId = null;
}

export function startDuel(match) {
  match.status = "running";
  match.turnFighterId = match.sides[roll(match, 2)].players[0].id;
}

export function duelHit(match, side, ability) {
  const actor = match.sides[side].players[0];
  const target = match.sides[1 - side].players[0];
  if (ability) actor.abilityUsed = true;
  hit(
    match,
    actor,
    target,
    ability ? "ability" : "attack",
    (ability ? 28 : 14) + roll(match, 11),
    ability ? actor.ability : "Strike",
  );
  if (target.hp === 0) finish(match, side);
  else match.turnFighterId = target.id;
}

function autoSignature(match, character, fallbackName) {
  const moves = getSignatureMoves(character);
  const move = moves.length > 1 ? moves[roll(match, moves.length)] : moves[0];
  return move
    ? { ...move, ...CAST_VISUALS[move.visual] }
    : { name: fallbackName, damage: 28, hits: 1, armor: 0.25, visual: "burst" };
}

export function simulateAutoFight(match, characters) {
  startDuel(match);
  const fighters = match.sides.map((side) => side.players[0]);
  const states = fighters.map((fighter, index) => {
    const signature = autoSignature(match, characters[index], fighter.ability);
    fighter.ability = signature.name;
    if (signature.art) fighter.abilityArt = signature.art;
    return { signature, turns: 0, burning: 0, skip: null };
  });
  const first = match.turnFighterId === fighters[0].id ? 0 : 1;

  // Basic attacks deal at least 15 HP. One signature per side allows up to 29 HP
  // of healing or two additional status events, so every fight fits in 23 events.
  for (let side = first; fighters[0].hp && fighters[1].hp; side = 1 - side) {
    const actor = fighters[side];
    const target = fighters[1 - side];
    const state = states[side];
    const targetState = states[1 - side];
    if (state.burning) {
      state.burning--;
      hit(match, target, actor, "attack", Math.min(4, actor.hp), "Burning", {
        visual: "burst",
      });
      if (!actor.hp) break;
    }
    if (state.skip) {
      hit(match, target, actor, "attack", 0, state.skip, { visual: "burst" });
      state.skip = null;
      continue;
    }

    const useSignature =
      !actor.abilityUsed &&
      state.turns > 0 &&
      (!state.signature.restore || actor.hp < actor.startingHp);
    const move = useSignature
      ? state.signature
      : AUTO_BASIC_MOVES[roll(match, AUTO_BASIC_MOVES.length)];
    if (useSignature) actor.abilityUsed = true;
    state.turns++;

    const timing = roll(match, 100);
    const perfect = timing < 20;
    const timed = timing < 85;
    const power = perfect ? 1.2 : timed ? 1 : 0.95;
    const hits = Array.isArray(move.hits)
      ? move.hits[0] + roll(match, move.hits[1] - move.hits[0] + 1)
      : move.hits;
    const perHit = Math.max(
      0,
      Math.round(move.damage * power - 3 * move.armor),
    );
    const damage = Math.min(target.hp, perHit * hits);
    const restored = Math.min(
      actor.startingHp - actor.hp,
      Math.round((move.restore ?? 0) * power),
    );
    actor.hp += restored;
    hit(
      match,
      actor,
      target,
      useSignature ? "ability" : "attack",
      damage,
      move.name,
      {
        visual: move.visual,
        ...(restored ? { actorHp: actor.hp } : {}),
      },
    );
    if (timed && move.effect === "burn") targetState.burning = 2;
    if (timed && move.effect === "sleep") targetState.skip = "Asleep";
    if (perfect && move.effect === "stun") targetState.skip = "Stunned";
  }
  finish(match, fighters[0].hp ? 0 : 1);
}

export function simulateWar(match) {
  const standing = match.sides.map((side) => [...side.players]);
  while (standing[0].length && standing[1].length) {
    const side =
      roll(match, standing[0].length + standing[1].length) < standing[0].length
        ? 0
        : 1;
    const actor = standing[side][roll(match, standing[side].length)];
    const opponents = standing[1 - side];
    const [target] = opponents.splice(roll(match, opponents.length), 1);
    const signature = !actor.abilityUsed && roll(match, 3) === 0;
    if (signature) actor.abilityUsed = true;
    hit(
      match,
      actor,
      target,
      "knockout",
      target.hp,
      signature ? actor.ability : "Strike",
    );
  }
  finish(match, standing[0].length ? 0 : 1);
}
