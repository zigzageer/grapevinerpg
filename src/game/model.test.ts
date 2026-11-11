import { describe, expect, it, vi } from "vitest";
import {
  canStand,
  initialSave,
  loadSave,
  DEFAULT_CREW,
  movePlayer,
  movePlayerInSteps,
  normalizeCharacter,
  parseCrew,
  START,
} from "./model";
import { findPath } from "./navigation";
import { LOCATIONS } from "./locations";
describe("town movement", () => {
  it("keeps feet within town and outside the school", () => {
    expect(canStand(START)).toBe(true);
    expect(movePlayer({ x: 550, y: 730 }, 0, 35)).toEqual({ x: 550, y: 730 });
    expect(movePlayer({ x: 41, y: 550 }, -20, 0)).toEqual({ x: 41, y: 550 });
    expect(movePlayer(START, 15, 0)).toEqual({ x: 695, y: 560 });
  });
  it("connects every South Park location by safe walking routes across all three blocks", () => {
    const destinations = LOCATIONS.map((s) => s.entrance);
    const trips = destinations.flatMap((to, i) => [
      [START, to],
      [to, destinations[(i + 1) % destinations.length]],
    ]);
    for (const [from, to] of trips) {
      const path = findPath(from, to);
      expect(path.length).toBeGreaterThan(0);
      let p = from;
      for (const step of path) {
        const count = Math.max(
          1,
          Math.ceil(Math.hypot(step.x - p.x, step.y - p.y) / 3),
        );
        for (let n = 1; n <= count; n++)
          expect(
            canStand({
              x: p.x + ((step.x - p.x) * n) / count,
              y: p.y + ((step.y - p.y) * n) / count,
            }),
          ).toBe(true);
        p = step;
      }
      expect(p).toEqual(to);
    }
  });
  it("finds a safe point for clicks on obstacles and outside town", () => {
    for (const target of [
      { x: 550, y: 900 },
      { x: -100, y: 100 },
      { x: 2600, y: 2400 },
    ]) {
      const p = findPath(START, target);
      expect(p.length).toBeGreaterThan(0);
      expect(canStand(p[p.length - 1])).toBe(true);
    }
  });
});
describe("character imports", () => {
  it("maps Paper Town crew exports to the game without losing Mint", () => {
    const crew = parseCrew({
      app: "paper-town-creator",
      crew: [
        {
          name: "Sam",
          skin: "#d9aa80",
          topColor: "#448899",
          bottomColor: "#445566",
          glasses: "round",
        },
      ],
    });
    expect(crew[0]).toMatchObject({
      name: "Sam",
      kind: "human",
      shirt: "#448899",
      pants: "#445566",
      glasses: true,
    });
    expect(DEFAULT_CREW[0].kind).toBe("mint");
  });
  it("rejects invalid crew files and normalizes unsafe appearance data", () => {
    expect(() => parseCrew({ crew: [null] })).toThrow();
    expect(() => parseCrew({ crew: [] })).toThrow();
    expect(() => parseCrew({ crew: [{ name: 42 }] })).toThrow();
    expect(
      normalizeCharacter({
        name: "x".repeat(70),
        skin: "url(https://example.com)",
        sprite: "javascript:alert(1)",
        hair: "unknown",
      }),
    ).toMatchObject({
      name: "x".repeat(28),
      skin: DEFAULT_CREW[0].skin,
      sprite: undefined,
      hair: DEFAULT_CREW[0].hair,
    });
  });
});

describe("cast updates and saved characters", () => {
  it("adds the illustrated friends to old saves without resetting custom names or quest progress", () => {
    let data = JSON.stringify({
      ...initialSave(),
      castVersion: undefined,
      crew: DEFAULT_CREW.slice(0, 3).map((c, i) => ({
        ...c,
        name: i === 1 ? "Sam" : c.name,
      })),
      greeted: true,
      inspected: true,
      player: { x: 720, y: 560 },
    });
    vi.stubGlobal("localStorage", { getItem: () => data });
    try {
      const migrated = loadSave();
      expect(migrated.crew.map((c) => c.preset).filter(Boolean)).toEqual([
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
      ]);
      expect(migrated.crew[1].name).toBe("Sam");
      expect(migrated).toMatchObject({
        greeted: true,
        inspected: true,
        player: { x: 720, y: 560 },
        castVersion: 7,
      });
      data = JSON.stringify(migrated);
      expect(loadSave().crew).toHaveLength(16);
      // Replacing the imported cast intentionally must not re-add removed characters on every reload.
      data = JSON.stringify({ ...migrated, crew: migrated.crew.slice(0, 3) });
      expect(loadSave().crew).toHaveLength(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("keeps the baguette character customized when upgrading a save from the previous cast version", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          ...initialSave(),
          castVersion: 1,
          crew: DEFAULT_CREW.slice(0, 4).map((c) =>
            c.preset === "baguette-guy" ? { ...c, name: "Sammy" } : c,
          ),
        }),
    });
    try {
      const migrated = loadSave();
      expect(migrated.crew).toHaveLength(16);
      expect(migrated.crew[3]).toMatchObject({
        name: "Sammy",
        preset: "baguette-guy",
      });
      expect(migrated.crew[4].preset).toBe("flag-girl");
      expect(migrated.crew[5]).toMatchObject({
        name: "David",
        preset: "david",
      });
      expect(migrated.crew[6]).toMatchObject({
        name: "Ghost",
        preset: "ghost",
      });
      expect(
        parseCrew(JSON.parse(JSON.stringify({ crew: migrated.crew }))).map(
          (c) => c.preset,
        ),
      ).toEqual(migrated.crew.map((c) => c.preset));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

it("large movement updates cannot skip through school walls", () => {
  const stopped = movePlayerInSteps({ x: 1000, y: 900 }, -1000, 0);
  expect(stopped.x).toBeGreaterThanOrEqual(980);
  expect(stopped.x).toBeLessThan(990);
  expect(stopped.y).toBe(900);
  expect(canStand(stopped)).toBe(true);
});

it("moves an old save out of a new building while retaining the cast and TV setting", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        ...initialSave(),
        player: { x: 800, y: 900 },
        tvLook: false,
      }),
  });
  try {
    const saved = loadSave();
    expect(saved.player).toEqual(START);
    expect(saved.crew).toHaveLength(DEFAULT_CREW.length);
    expect(saved.tvLook).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
