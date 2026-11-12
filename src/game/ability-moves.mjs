export const BASIC_MOVES = {
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

const PEPPERMINT_POP = {
  name: "Peppermint Pop",
  description: "A burst of peppermint that cuts through armor.",
  visual: "burst",
  cost: 3,
  damage: 28,
  hits: 1,
  armor: 0.25,
};

const CAST_ABILITIES = {
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

const BABASHARK_MOVES = [
  {
    id: "diddy-party",
    name: "Diddy Party",
    description: "A timed blackout puts your opponent to sleep for one turn.",
    visual: "diddy-party",
    effect: "sleep",
    cost: 4,
    damage: 0,
    hits: 1,
    armor: 0,
  },
  {
    id: "kick-the-baby",
    name: "Kick the Baby",
    description:
      "Her daughter bounces off the opponent and pops right back up.",
    visual: "kick-the-baby",
    cost: 3,
    damage: 27,
    hits: 1,
    armor: 0.5,
  },
  {
    id: "simps-assemble",
    name: "SIMPs Assemble",
    description: "Haku and bellyache pay up. Good timing heals 24 HP.",
    visual: "simps-assemble",
    restore: 24,
    cost: 2,
    damage: 0,
    hits: 1,
    armor: 0,
  },
  {
    id: "chaz",
    name: "Chaz",
    description: "Chaz picks her up in his Corvette and peels out.",
    visual: "chaz",
    cost: 4,
    damage: 34,
    hits: 1,
    armor: 0.25,
  },
];

const GENERATED_RULES = {
  burst: { cost: 4, damage: 31, hits: 1, armor: 0.25 },
  projectile: { cost: 3, damage: 26, hits: 1, armor: 0.5 },
  rush: { cost: 3, damage: 16, hits: 2, armor: 0.75 },
};

// The first cast used friend-3 through friend-15. Studio appearance edits
// preserve these IDs but remove the preset when they equip generated artwork.
const ORIGINAL_CAST = [
  "baguette-guy",
  "flag-girl",
  "david",
  "ghost",
  "rocky",
  "miel",
  "zippy",
  "jat",
  "loralei",
  "samira",
  "genesis",
  "kain",
  "footjobofsteel",
];
const presetsById = new Map(
  [...Object.keys(CAST_ABILITIES), "babashark"].map((preset) => {
    const originalIndex = ORIGINAL_CAST.indexOf(preset);
    const id =
      originalIndex < 0 ? "cast-" + preset : "friend-" + (originalIndex + 3);
    return [id, preset];
  }),
);

export const isStudioPng = (value) =>
  typeof value === "string" &&
  /^\/api\/studio\/assets\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.png$/.test(
    value,
  );

export function normalizeGeneratedAbility(input) {
  if (!input || typeof input !== "object") return;
  const { name, description, style, art } = input;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 28 ||
    typeof description !== "string" ||
    !description.trim() ||
    description.trim().length > 120 ||
    typeof style !== "string" ||
    !Object.hasOwn(GENERATED_RULES, style) ||
    !isStudioPng(art)
  )
    return;
  return { name: name.trim(), description: description.trim(), style, art };
}

export function castPreset(character) {
  const preset = character.preset ?? presetsById.get(character.id);
  if (
    typeof preset === "string" &&
    (preset === "babashark" || Object.hasOwn(CAST_ABILITIES, preset))
  )
    return preset;
}

export function getSignatureMoves(character) {
  const ability = normalizeGeneratedAbility(character.ability);
  if (ability) {
    const { name, description, art, style } = ability;
    return [
      {
        ...GENERATED_RULES[style],
        id: "signature",
        name,
        description,
        art,
        visual: style,
      },
    ];
  }
  const preset = castPreset(character);
  if (preset === "babashark") return BABASHARK_MOVES;
  const move = preset
    ? CAST_ABILITIES[preset]
    : character.kind === "mint"
      ? PEPPERMINT_POP
      : undefined;
  return move ? [{ ...move, id: "signature" }] : [];
}
