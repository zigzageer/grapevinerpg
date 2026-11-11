import type { Move } from "./combat";
import {
  DEFAULT_CREW,
  normalizeGeneratedAbility,
  type Character,
  type GeneratedAbility,
} from "./model";

const PEPPERMINT_POP: Move = {
  name: "Peppermint Pop",
  description: "A burst of peppermint that cuts through armor.",
  visual: "burst",
  cost: 3,
  damage: 28,
  hits: 1,
  armor: 0.25,
};

const CAST_ABILITIES: Record<NonNullable<Character["preset"]>, Move> = {
  "baguette-guy": {
    name: "Stale Baguette",
    description: "A swing with yesterday’s baguette that ignores armor.",
    visual: "rush",
    cost: 3,
    damage: 27,
    hits: 1,
    armor: 0,
  },
  "flag-girl": {
    name: "Banner Sweep",
    description: "Sweep the flag low. A perfect hit stuns for one turn.",
    visual: "rush",
    cost: 4,
    damage: 28,
    hits: 1,
    armor: 0.5,
    effect: "stun",
  },
  david: {
    name: "Grace",
    description: "Grace rushes in for a kiss, followed by one to three hits.",
    visual: "grace",
    cost: 4,
    damage: 14,
    hits: [1, 3],
    armor: 0.5,
    tag: "CUCK",
  },
  ghost: {
    name: "Loaf Toss",
    description: "A full loaf flies across the street in one heavy hit.",
    visual: "projectile",
    cost: 3,
    damage: 30,
    hits: 1,
    armor: 0.65,
  },
  rocky: {
    name: "Hat Trick",
    description: "Three hits in quick succession. Armor applies to each.",
    visual: "projectile",
    cost: 3,
    damage: 12,
    hits: 3,
    armor: 1,
  },
  miel: {
    name: "Rosé Spritz",
    description: "A fizzy splash burns for two turns on a timed hit.",
    visual: "burst",
    cost: 3,
    damage: 23,
    hits: 1,
    armor: 0.65,
    effect: "burn",
  },
  zippy: {
    name: "Flower Power",
    description: "A double burst of petals, each landing a hit.",
    visual: "burst",
    cost: 3,
    damage: 15,
    hits: 2,
    armor: 0.65,
  },
  jat: {
    name: "Coffee Break",
    description: "Hot coffee burns for two turns when timed.",
    visual: "projectile",
    cost: 3,
    damage: 22,
    hits: 1,
    armor: 0.25,
    effect: "burn",
  },
  loralei: {
    name: "Heel Turn",
    description: "Two quick kicks. Perfect timing stuns for one turn.",
    visual: "rush",
    cost: 4,
    damage: 14,
    hits: 2,
    armor: 0.5,
    effect: "stun",
  },
  samira: {
    name: "Air Kiss",
    description: "Blow a kiss that hits from across the street.",
    visual: "projectile",
    cost: 3,
    damage: 29,
    hits: 1,
    armor: 0.4,
  },
  genesis: {
    name: "Puppy Pounce",
    description: "Genesis and his puppy rush in for two hits.",
    visual: "rush",
    cost: 3,
    damage: 15,
    hits: 2,
    armor: 0.75,
  },
  kain: {
    name: "Leapfrog",
    description: "Leap into a body slam. A perfect hit stuns for one turn.",
    visual: "rush",
    cost: 4,
    damage: 28,
    hits: 1,
    armor: 0.25,
    effect: "stun",
  },
  footjobofsteel: {
    name: "Bear Slam",
    description: "A single big slam that hits through most armor.",
    visual: "rush",
    cost: 4,
    damage: 34,
    hits: 1,
    armor: 0.25,
  },
  steakbutterfan: {
    name: "Burger Press",
    description: "Drop the oversized burger for one crushing hit.",
    visual: "burst",
    cost: 3,
    damage: 31,
    hits: 1,
    armor: 0.5,
  },
  blindian: {
    name: "Indian Attack",
    description: "Jat and Genesis jump in together for two hits.",
    visual: "tag-team",
    cost: 4,
    damage: 17,
    hits: 2,
    armor: 0.5,
  },
  grace: {
    name: "Cupid’s Arrow",
    description:
      "A heart-tipped arrow that pierces armor from across the street.",
    visual: "projectile",
    cost: 4,
    damage: 31,
    hits: 1,
    armor: 0,
  },
  tommy: {
    name: "Boot Stomp",
    description:
      "A hard kick with a cowboy boot. A perfect hit stuns for one turn.",
    visual: "rush",
    cost: 4,
    damage: 29,
    hits: 1,
    armor: 0.5,
    effect: "stun",
  },
  "red-light": {
    name: "Red Light!",
    description: "Freeze the opponent in place for one turn on a perfect hit.",
    visual: "burst",
    cost: 4,
    damage: 25,
    hits: 1,
    armor: 0.25,
    effect: "stun",
  },
  peaches: {
    name: "Lion’s Charge",
    description: "Peaches and the lion charge together for two hits.",
    visual: "rush",
    cost: 4,
    damage: 17,
    hits: 2,
    armor: 0.5,
  },
  lin: {
    name: "Doll Toss",
    description: "Send andre, the folk doll, flying for one hit.",
    visual: "projectile",
    cost: 3,
    damage: 28,
    hits: 1,
    armor: 0.25,
  },
  bashu: {
    name: "Ring Flash",
    description: "Catch the light on the ring for a flash that ignores armor.",
    visual: "burst",
    cost: 3,
    damage: 26,
    hits: 1,
    armor: 0,
  },
  orrow: {
    name: "Ramble On",
    description: "Three quick volleys of nonstop chatter.",
    visual: "burst",
    cost: 3,
    damage: 11,
    hits: 3,
    armor: 0.7,
  },
  potato: {
    name: "Spud Roll",
    description: "A rolling body slam for one heavy hit.",
    visual: "rush",
    cost: 3,
    damage: 30,
    hits: 1,
    armor: 0.6,
  },
  kawaiikitty: {
    name: "Chair Charge",
    description: "Roll into two hits. Perfect timing stuns for one turn.",
    visual: "rush",
    cost: 4,
    damage: 16,
    hits: 2,
    armor: 0.75,
    effect: "stun",
  },
};

const castPresetsById = new Map(
  DEFAULT_CREW.map(({ id, preset }) => [id, preset]),
);

const GENERATED_RULES: Record<
  GeneratedAbility["style"],
  Pick<Move, "cost" | "damage" | "hits" | "armor">
> = {
  burst: { cost: 4, damage: 31, hits: 1, armor: 0.25 },
  projectile: { cost: 3, damage: 26, hits: 1, armor: 0.5 },
  rush: { cost: 3, damage: 16, hits: 2, armor: 0.75 },
};

export function getSignatureMove(character: Character): Move | undefined {
  const ability = normalizeGeneratedAbility(character.ability);
  if (ability) {
    const { name, description, art, style } = ability;
    return { ...GENERATED_RULES[style], name, description, art, visual: style };
  }
  // Old roster migrations assigned some built-ins a different ID but kept their preset.
  const preset = character.preset ?? castPresetsById.get(character.id);
  if (preset) return CAST_ABILITIES[preset];
  if (character.kind === "mint") return PEPPERMINT_POP;
}
