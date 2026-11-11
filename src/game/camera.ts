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
): CameraView {
  const aspect =
    Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : WORLD.width / WORLD.height;
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const height = Math.min(WORLD.height / scale, WORLD.width / aspect);
  const width = height * aspect;
  return {
    x: Math.max(0, Math.min(WORLD.width - width, player.x - width / 2)),
    y: Math.max(0, Math.min(WORLD.height - height, player.y - height * 0.66)),
    width,
    height,
  };
}
