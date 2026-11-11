import { describe, expect, it } from "vitest";
import { followCamera, DEFAULT_ZOOM } from "./camera";
import { START, WORLD } from "./model";

describe("character follow camera", () => {
  it("starts close to the character and tracks movement without changing the framing", () => {
    const first = followCamera(START, 14 / 9);
    expect(first.height).toBe(300);
    expect(first.width).toBeLessThan(WORLD.width / 2);
    expect((START.x - first.x) / first.width).toBeCloseTo(0.5);
    expect((START.y - first.y) / first.height).toBeCloseTo(0.66);
    const next = followCamera({ x: START.x + 125, y: START.y + 45 }, 14 / 9);
    expect(next.x - first.x).toBeCloseTo(125);
    expect(next.y - first.y).toBeCloseTo(45);
  });
  it("keeps the viewport inside the town at all edges and common screen shapes", () => {
    for (const aspect of [390 / 402, 14 / 9, 16 / 9, 4])
      for (const zoom of [1.5, DEFAULT_ZOOM, 5])
        for (const player of [
          { x: 35, y: 475 },
          { x: 1365, y: 475 },
          { x: 35, y: 865 },
          { x: 1365, y: 865 },
        ]) {
          const view = followCamera(player, aspect, zoom);
          expect(view.x).toBeGreaterThanOrEqual(0);
          expect(view.y).toBeGreaterThanOrEqual(0);
          expect(view.x + view.width).toBeLessThanOrEqual(WORLD.width + 0.0001);
          expect(view.y + view.height).toBeLessThanOrEqual(
            WORLD.height + 0.0001,
          );
          expect(view.width / view.height).toBeCloseTo(aspect);
          expect(player.x).toBeGreaterThanOrEqual(view.x);
          expect(player.x).toBeLessThanOrEqual(view.x + view.width);
          expect(player.y).toBeGreaterThanOrEqual(view.y);
          expect(player.y).toBeLessThanOrEqual(view.y + view.height);
        }
  });
  it("zooms closer without moving the character away from the middle", () => {
    const normal = followCamera(START, 14 / 9, 3),
      close = followCamera(START, 14 / 9, 4);
    expect(close.height).toBeLessThan(normal.height);
    expect((START.x - close.x) / close.width).toBeCloseTo(0.5);
    expect((START.y - 42 - close.y) / close.height).toBeCloseTo(0.52);
  });
});

it("keeps characters a usable size in fullscreen desktop, phone portrait, and phone landscape", () => {
  for (const { width, height } of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const view = followCamera(START, width / height, DEFAULT_ZOOM, height);
    const pixelsPerUnit = height / view.height;
    const characterHeight = 86 * pixelsPerUnit;
    expect(characterHeight).toBeGreaterThan(100);
    expect(characterHeight).toBeLessThan(200);
    expect((START.y - 42 - view.y) / view.height).toBeCloseTo(0.52);
    expect(view.width / view.height).toBeCloseTo(width / height);
  }
});
