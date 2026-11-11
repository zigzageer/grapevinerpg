import { describe, expect, it } from "vitest";
import { STREET_ROWS, STREET_WIDTH } from "./locations";
import { canStand } from "./model";
import {
  advanceTownLife,
  createTownLife,
  residentConversation,
  streetTraffic,
  winterParade,
} from "./town-life";

describe("town life", () => {
  it("moves residents between safe sidewalk stops and lets them watch a passing parade", () => {
    const first = createTownLife();
    let life = first;
    const moved = new Set<string>();
    const watched = new Set<string>();
    for (let frame = 0; frame < 500; frame++) {
      life = advanceTownLife(life, 0.1);
      for (const [i, walker] of life.residents.entries()) {
        expect(canStand(walker)).toBe(true);
        expect(
          STREET_ROWS.every(
            (row) => walker.y < row || walker.y > row + STREET_WIDTH,
          ),
        ).toBe(true);
        if (walker.x !== first.residents[i].x) moved.add(walker.resident.id);
        if (walker.watching) {
          watched.add(walker.resident.id);
          expect(residentConversation(walker).activity).toBe(
            "Watching the winter parade",
          );
        }
      }
    }
    expect(moved.size).toBe(first.residents.length);
    expect(watched).toEqual(new Set(["cartman", "butters", "wendy"]));
  });

  it("keeps traffic moving both ways and clears the parade's lane across multiple events", () => {
    const [downtown] = STREET_ROWS;
    const drive = streetTraffic(0);
    expect(new Set(drive.map(({ y }) => y)).size).toBe(6);
    for (const car of drive) {
      const next = streetTraffic(0.1).find(({ id }) => id === car.id);
      if (next) expect((next.x - car.x) * car.facing).toBeGreaterThan(0);
    }

    let parades = 0;
    let paradeOnStreet = false;
    for (let time = 0; time < 225; time += 0.1) {
      const parade = winterParade(time);
      if (parade.length && !paradeOnStreet) parades++;
      paradeOnStreet = parade.length > 0;
      if (!paradeOnStreet) continue;
      const traffic = streetTraffic(time);
      expect(
        traffic.some(
          (car) => car.facing === -1 && car.y < downtown + STREET_WIDTH,
        ),
      ).toBe(true);
      for (const car of traffic.filter(
        (car) => car.facing === 1 && car.y < downtown + STREET_WIDTH,
      )) {
        expect(car.x - Math.max(...parade.map(({ x }) => x))).toBeGreaterThan(
          128,
        );
      }
    }
    expect(parades).toBe(3);
  });
});
