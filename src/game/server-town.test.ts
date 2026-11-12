import { describe, expect, it } from "vitest";
import sample from "../../examples/server-town/town.json";
import grapevine from "./data/grapevine-town.json";
import { canStand, movePlayerInSteps } from "./model";
import { findPath } from "./navigation";
import { parseServerTown } from "./server-town";

describe("published town geometry", () => {
  it.each([sample, grapevine])(
    "validates $name and routes to each venue",
    (input) => {
      const town = parseServerTown(input, input.guildId);
      for (const building of town.buildings) {
        expect(
          canStand({ x: building.x + 20, y: building.y + 20 }, town.walkArea),
        ).toBe(false);
        expect(
          findPath(town.spawn, building.door, town.walkArea).at(-1),
        ).toEqual(building.door);
      }
      const b = town.buildings[0];
      const approach = { x: b.x + b.w / 2, y: b.y + b.h + 25 };
      expect(
        movePlayerInSteps(approach, 0, -60, town.walkArea).y,
      ).toBeGreaterThanOrEqual(b.y + b.h + 8);
    },
  );

  it("rejects blocked spawns and artwork from another guild", () => {
    const bad = structuredClone(sample);
    bad.spawn = { x: bad.buildings[0].x, y: bad.buildings[0].y };
    expect(() => parseServerTown(bad, bad.guildId)).toThrow("spawn");
    const withArt = structuredClone(sample) as typeof sample & {
      buildings: ((typeof sample.buildings)[number] & { art?: string })[];
    };
    withArt.buildings[0].art = "/games/223456789012345678/town/station.webp";
    expect(() => parseServerTown(withArt, withArt.guildId)).toThrow("artwork");
  });
});
