import { WORLD, type Point } from "./model";

export const DEFAULT_ZOOM = 3;
export const MIN_ZOOM = 1.5;
export const MAX_ZOOM = 5;
export interface CameraView {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keep the character's body near the middle, with more room ahead than below their feet. */
export function followCamera(
  player: Point,
  aspectRatio: number,
  zoom = DEFAULT_ZOOM,
  viewportHeight?: number,
  world = WORLD,
): CameraView {
  const aspect =
    Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : world.width / world.height;
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  // Keep characters readable without filling an entire portrait phone screen.
  const pixels =
    viewportHeight && viewportHeight > 0 ? viewportHeight : undefined;
  const baseScale = pixels
    ? Math.min(pixels * aspect < 700 ? 1.35 : 2.1, pixels / 300)
    : undefined;
  const desiredHeight =
    pixels && baseScale
      ? pixels / ((baseScale * scale) / DEFAULT_ZOOM)
      : 900 / scale;
  const height = Math.min(world.height, desiredHeight, world.width / aspect);
  const width = height * aspect;
  return {
    x: Math.max(0, Math.min(world.width - width, player.x - width / 2)),
    y: Math.max(
      0,
      Math.min(world.height - height, player.y - height * 0.52 - 42),
    ),
    width,
    height,
  };
}
