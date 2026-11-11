export type Point = { x: number; y: number };
export type Hair = "short" | "messy" | "long" | "curly" | "bald";
export type Hat = "none" | "beanie" | "cap";
export interface Character {
  id: string;
  name: string;
  kind?: "mint" | "human";
  skin: string;
  hair: Hair;
  hairColor: string;
  shirt: string;
  pants: string;
  hat: Hat;
  hatColor: string;
  glasses: boolean;
  sprite?: string;
  preset?:
    | "baguette-guy"
    | "flag-girl"
    | "david"
    | "ghost"
    | "rocky"
    | "miel"
    | "zippy"
    | "jat"
    | "loralei"
    | "samira"
    | "genesis"
    | "kain"
    | "footjobofsteel";
}
export interface SaveGame {
  version: 1;
  castVersion: 7;
  activeCharacter?: string;
  player: Point;
  crew: Character[];
  greeted: boolean;
  inspected: boolean;
  complete: boolean;
  sound: boolean;
}
export const SAVE_KEY = "grapevine.save.v1";
export const WORLD = { width: 1400, height: 900 };
export const START: Point = { x: 680, y: 560 };
export const BAGUETTE_GUY: Character = {
  id: "friend-3",
  name: "Baguette",
  kind: "human",
  preset: "baguette-guy",
  skin: "#f4d4b5",
  hair: "messy",
  hairColor: "#202024",
  shirt: "#36353b",
  pants: "#344969",
  hat: "none",
  hatColor: "#36353b",
  glasses: false,
};
export const FLAG_GIRL: Character = {
  id: "friend-4",
  name: "Sarina",
  kind: "human",
  preset: "flag-girl",
  skin: "#edbc91",
  hair: "long",
  hairColor: "#64402f",
  shirt: "#293c70",
  pants: "#29292d",
  hat: "none",
  hatColor: "#293c70",
  glasses: false,
};
export const DAVID: Character = {
  id: "friend-5",
  name: "David",
  kind: "human",
  preset: "david",
  skin: "#f1c49d",
  hair: "short",
  hairColor: "#402c24",
  shirt: "#711e37",
  pants: "#35415a",
  hat: "cap",
  hatColor: "#274694",
  glasses: false,
};
export const GHOST: Character = {
  id: "friend-6",
  name: "Ghost",
  kind: "human",
  preset: "ghost",
  skin: "#895332",
  hair: "long",
  hairColor: "#241b1c",
  shirt: "#85936a",
  pants: "#34323a",
  hat: "none",
  hatColor: "#61234c",
  glasses: false,
};
export const ROCKY: Character = {
  id: "friend-7",
  name: "Rocky",
  kind: "human",
  preset: "rocky",
  skin: "#efccaa",
  hair: "short",
  hairColor: "#3c2b24",
  shirt: "#555b39",
  pants: "#28282c",
  hat: "none",
  hatColor: "#252529",
  glasses: false,
};
export const MIEL: Character = {
  id: "friend-8",
  name: "Miel",
  kind: "human",
  preset: "miel",
  skin: "#f1ccab",
  hair: "long",
  hairColor: "#704c33",
  shirt: "#b49acb",
  pants: "#34476b",
  hat: "none",
  hatColor: "#f6e9e3",
  glasses: false,
};
export const ZIPPY: Character = {
  id: "friend-9",
  name: "Zippy",
  kind: "human",
  preset: "zippy",
  skin: "#f2c497",
  hair: "short",
  hairColor: "#b2773c",
  shirt: "#38b5b2",
  pants: "#484452",
  hat: "none",
  hatColor: "#38b5b2",
  glasses: false,
};
export const JAT: Character = {
  id: "friend-10",
  name: "Jat",
  kind: "human",
  preset: "jat",
  skin: "#89502e",
  hair: "short",
  hairColor: "#232126",
  shirt: "#9c2942",
  pants: "#303b64",
  hat: "none",
  hatColor: "#9c2942",
  glasses: false,
};
export const LATEST_CAST = [ROCKY, MIEL, ZIPPY, JAT];
export const DEMO_ADDITIONS: Character[] = [
  {
    id: "friend-11",
    name: "Loralei",
    kind: "human",
    preset: "loralei",
    skin: "#efccad",
    hair: "long",
    hairColor: "#694532",
    shirt: "#27272a",
    pants: "#29282a",
    hat: "cap",
    hatColor: "#242426",
    glasses: false,
  },
  {
    id: "friend-12",
    name: "Samira",
    kind: "human",
    preset: "samira",
    skin: "#bb7d4f",
    hair: "long",
    hairColor: "#432b23",
    shirt: "#30777c",
    pants: "#51304e",
    hat: "none",
    hatColor: "#30777c",
    glasses: false,
  },
  {
    id: "friend-13",
    name: "Genesis",
    kind: "human",
    preset: "genesis",
    skin: "#a2653b",
    hair: "curly",
    hairColor: "#2b2527",
    shirt: "#cb9f3a",
    pants: "#314b3a",
    hat: "none",
    hatColor: "#cb9f3a",
    glasses: true,
  },
  {
    id: "friend-14",
    name: "Kain",
    kind: "human",
    preset: "kain",
    skin: "#77a943",
    hair: "bald",
    hairColor: "#26382b",
    shirt: "#313136",
    pants: "#313136",
    hat: "none",
    hatColor: "#313136",
    glasses: true,
  },
  {
    id: "friend-15",
    name: "Footjobofsteel",
    kind: "human",
    preset: "footjobofsteel",
    skin: "#efc02d",
    hair: "bald",
    hairColor: "#b87721",
    shirt: "#d54135",
    pants: "#714934",
    hat: "none",
    hatColor: "#d54135",
    glasses: false,
  },
];
export const characterKey = (c: Character) => c.id;
export const DEFAULT_CREW: Character[] = [
  {
    id: "you",
    name: "Mint",
    kind: "mint",
    skin: "#f2cfaa",
    hair: "messy",
    hairColor: "#653c2c",
    shirt: "#c66c45",
    pants: "#344958",
    hat: "none",
    hatColor: "#638e9f",
    glasses: false,
  },
  {
    id: "friend-1",
    name: "Friend 01",
    skin: "#d9aa80",
    hair: "short",
    hairColor: "#352a28",
    shirt: "#6a9183",
    pants: "#454957",
    hat: "beanie",
    hatColor: "#ddba65",
    glasses: false,
  },
  {
    id: "friend-2",
    name: "Friend 02",
    skin: "#f2cfaa",
    hair: "long",
    hairColor: "#a0593e",
    shirt: "#8e86a6",
    pants: "#474c67",
    hat: "none",
    hatColor: "#8e86a6",
    glasses: true,
  },
  BAGUETTE_GUY,
  FLAG_GIRL,
  DAVID,
  GHOST,
  ...LATEST_CAST,
  ...DEMO_ADDITIONS,
];
export const initialSave = (): SaveGame => ({
  version: 1,
  castVersion: 7,
  activeCharacter: "you",
  player: { ...START },
  crew: DEFAULT_CREW.map((c) => ({ ...c })),
  greeted: false,
  inspected: false,
  complete: false,
  sound: false,
});
export const hex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
export function normalizeCharacter(
  raw: unknown,
  fallback = DEFAULT_CREW[0],
): Character {
  const c =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id:
      typeof c.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(c.id)
        ? c.id
        : fallback.id,
    preset:
      c.preset === "baguette-guy" ||
      c.preset === "flag-girl" ||
      c.preset === "david" ||
      c.preset === "ghost" ||
      c.preset === "rocky" ||
      c.preset === "miel" ||
      c.preset === "zippy" ||
      c.preset === "jat" ||
      c.preset === "loralei" ||
      c.preset === "samira" ||
      c.preset === "genesis" ||
      c.preset === "kain" ||
      c.preset === "footjobofsteel"
        ? c.preset
        : undefined,
    kind: c.kind === "mint" || c.kind === "human" ? c.kind : fallback.kind,
    name:
      typeof c.name === "string" && c.name.trim()
        ? c.name.trim().slice(0, 28)
        : fallback.name,
    skin: hex(c.skin, fallback.skin),
    hairColor: hex(c.hairColor, fallback.hairColor),
    shirt: hex(c.shirt ?? c.topColor, fallback.shirt),
    pants: hex(c.pants ?? c.bottomColor, fallback.pants),
    hatColor: hex(c.hatColor, fallback.hatColor),
    hair: ["short", "messy", "long", "curly", "bald"].includes(String(c.hair))
      ? (c.hair as Hair)
      : fallback.hair,
    hat: ["none", "beanie", "cap"].includes(String(c.hat))
      ? (c.hat as Hat)
      : fallback.hat,
    glasses:
      typeof c.glasses === "boolean"
        ? c.glasses
        : typeof c.glasses === "string"
          ? c.glasses !== "none"
          : fallback.glasses,
    sprite:
      typeof c.sprite === "string" &&
      /^data:image\/(png|webp);base64,/.test(c.sprite) &&
      c.sprite.length < 1_500_000
        ? c.sprite
        : undefined,
  };
}
export function parseCrew(input: unknown): Character[] {
  const data = input as { crew?: unknown };
  const list = Array.isArray(input)
    ? input
    : data && Array.isArray(data.crew)
      ? data.crew
      : [];
  if (
    !list.length ||
    list.some(
      (c) =>
        !c ||
        typeof c !== "object" ||
        typeof (c as Character).name !== "string",
    )
  )
    throw new Error(
      "Choose a crew JSON exported from Grapevine or Paper Town.",
    );
  const ids = new Set<string>();
  return list.slice(0, 24).map((c, i) => {
    const character = normalizeCharacter(c, {
      ...DEFAULT_CREW[i % 3],
      kind: "human",
      id: i === 0 ? "you" : `friend-${i}`,
    });
    if (ids.has(character.id)) character.id = `import-${i}`;
    while (ids.has(character.id)) character.id += "-copy";
    ids.add(character.id);
    return character;
  });
}
// Tree trunks and building footprints; movement uses the feet, not the sprite bounds.
export const OBSTACLES = [
  { x: 94, y: 295, w: 253, h: 173 },
  { x: 404, y: 308, w: 250, h: 159 },
  { x: 750, y: 280, w: 232, h: 185 },
  { x: 1110, y: 330, w: 210, h: 126 },
  { x: 610, y: 685, w: 120, h: 56 },
  { x: 1130, y: 715, w: 130, h: 48 },
  { x: 86, y: 674, w: 30, h: 36 },
  { x: 298, y: 733, w: 25, h: 25 },
];
export function canStand(p: Point): boolean {
  return (
    p.x >= 35 &&
    p.x <= 1365 &&
    p.y >= 475 &&
    p.y <= 865 &&
    !OBSTACLES.some(
      (r) =>
        p.x > r.x - 15 &&
        p.x < r.x + r.w + 15 &&
        p.y > r.y - 8 &&
        p.y < r.y + r.h + 8,
    )
  );
}
export function movePlayer(p: Point, dx: number, dy: number): Point {
  const x = canStand({ x: p.x + dx, y: p.y }) ? p.x + dx : p.x;
  const y = canStand({ x, y: p.y + dy }) ? p.y + dy : p.y;
  return { x, y };
}
export function loadSave(): SaveGame {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (raw?.version !== 1) return initialSave();
    const crew = parseCrew(raw.crew);
    while (crew.length < 3) crew.push({ ...DEFAULT_CREW[crew.length] });
    // Add the newly designed cast member once without replacing customized friends or progress.
    if (
      (raw.castVersion ?? 0) < 1 &&
      !crew.some((c) => c.preset === "baguette-guy") &&
      crew.length < 24
    ) {
      crew.push({ ...BAGUETTE_GUY, id: `friend-${crew.length}` });
    }
    if (
      (raw.castVersion ?? 0) < 2 &&
      !crew.some((c) => c.preset === "flag-girl") &&
      crew.length < 24
    ) {
      crew.push({ ...FLAG_GIRL, id: `friend-${crew.length}` });
    }
    if ((raw.castVersion ?? 0) < 3) {
      for (const character of crew) {
        if (
          character.preset === "baguette-guy" &&
          character.name === "Baguette Guy"
        )
          character.name = "Baguette";
        if (character.preset === "flag-girl" && character.name === "Flag Girl")
          character.name = "Sarina";
      }
    }
    if (
      (raw.castVersion ?? 0) < 4 &&
      !crew.some((c) => c.preset === "david") &&
      crew.length < 24
    ) {
      crew.push({ ...DAVID, id: `friend-${crew.length}` });
    }
    if (
      (raw.castVersion ?? 0) < 5 &&
      !crew.some((c) => c.preset === "ghost") &&
      crew.length < 24
    ) {
      crew.push({ ...GHOST, id: `friend-${crew.length}` });
    }
    if ((raw.castVersion ?? 0) < 6) {
      for (const character of LATEST_CAST) {
        if (
          crew.length < 24 &&
          !crew.some((c) => c.preset === character.preset)
        ) {
          crew.push({ ...character, id: `friend-${crew.length}` });
        }
      }
    }
    if ((raw.castVersion ?? 0) < 7) {
      for (const character of DEMO_ADDITIONS) {
        if (
          crew.length < 24 &&
          !crew.some((c) => c.preset === character.preset)
        )
          crew.push({ ...character, id: `friend-${crew.length}` });
      }
    }
    const player =
      raw.player &&
      Number.isFinite(raw.player.x) &&
      Number.isFinite(raw.player.y) &&
      canStand(raw.player)
        ? raw.player
        : { ...START };
    return {
      version: 1,
      castVersion: 7,
      activeCharacter:
        typeof raw.activeCharacter === "string" &&
        crew.some(
          (c) =>
            characterKey(c) === raw.activeCharacter ||
            c.preset === raw.activeCharacter,
        )
          ? characterKey(
              crew.find(
                (c) =>
                  characterKey(c) === raw.activeCharacter ||
                  c.preset === raw.activeCharacter,
              )!,
            )
          : "you",
      player,
      crew,
      greeted: raw.greeted === true,
      inspected: raw.inspected === true,
      complete:
        raw.complete === true && raw.greeted === true && raw.inspected === true,
      sound: raw.sound === true,
    };
  } catch {
    return initialSave();
  }
}
export const spots = [
  {
    id: "friend",
    x: 470,
    y: 575,
    label: "Talk to your friend",
    destination: { x: 510, y: 582 },
  },
  {
    id: "board",
    x: 946,
    y: 779,
    label: "Read the noticeboard",
    destination: { x: 936, y: 812 },
  },
  {
    id: "bus",
    x: 1196,
    y: 538,
    label: "Meet at the bus stop",
    destination: { x: 1154, y: 551 },
  },
  {
    id: "cafe",
    x: 540,
    y: 470,
    label: "Read the café menu",
    destination: { x: 541, y: 499 },
  },
  {
    id: "store",
    x: 228,
    y: 470,
    label: "Visit the corner store",
    destination: { x: 234, y: 500 },
  },
] as const;
export type SpotId = (typeof spots)[number]["id"];
export function closestSpot(p: Point) {
  return spots
    .map((s) => ({ ...s, distance: Math.hypot(s.x - p.x, s.y - p.y) }))
    .filter((s) => s.distance < 90)
    .sort((a, b) => a.distance - b.distance)[0];
}
