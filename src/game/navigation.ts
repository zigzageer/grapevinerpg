import { canStand, type Point } from "./model";
const STEP = 20;
const key = (p: Point) => `${p.x},${p.y}`;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
function clearLine(a: Point, b: Point) {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 1; i <= steps; i++)
    if (
      !canStand({
        x: a.x + ((b.x - a.x) * i) / steps,
        y: a.y + ((b.y - a.y) * i) / steps,
      })
    )
      return false;
  return true;
}
export function findPath(start: Point, requested: Point): Point[] {
  const bounded = {
    x: Math.max(40, Math.min(1360, requested.x)),
    y: Math.max(480, Math.min(860, requested.y)),
  };
  if (canStand(bounded) && clearLine(start, bounded)) return [bounded];
  const nodes: Point[] = [];
  for (let y = 480; y <= 860; y += STEP)
    for (let x = 40; x <= 1360; x += STEP)
      if (canStand({ x, y })) nodes.push({ x, y });
  const nearest = (p: Point) =>
    nodes.reduce((a, b) =>
      Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y)
        ? a
        : b,
    );
  const from = nearest(start),
    to = nearest(bounded);
  const open = [from],
    costs = new Map([[key(from), 0]]),
    parents = new Map<string, Point>();
  const closed = new Set<string>();
  let found = false;
  while (open.length) {
    open.sort(
      (a, b) =>
        costs.get(key(a))! +
        Math.hypot(a.x - to.x, a.y - to.y) -
        (costs.get(key(b))! + Math.hypot(b.x - to.x, b.y - to.y)),
    );
    const current = open.shift()!;
    if (same(current, to)) {
      found = true;
      break;
    }
    if (closed.has(key(current))) continue;
    closed.add(key(current));
    for (const dx of [-STEP, 0, STEP])
      for (const dy of [-STEP, 0, STEP]) {
        if (!dx && !dy) continue;
        const next = { x: current.x + dx, y: current.y + dy },
          nk = key(next);
        if (!canStand(next) || closed.has(nk) || !clearLine(current, next))
          continue;
        const cost = costs.get(key(current))! + Math.hypot(dx, dy);
        if (cost < (costs.get(nk) ?? Infinity)) {
          costs.set(nk, cost);
          parents.set(nk, current);
          open.push(next);
        }
      }
  }
  if (!found) return [];
  const path = [to];
  let p = to;
  while (!same(p, from)) {
    p = parents.get(key(p))!;
    path.unshift(p);
  }
  if (!clearLine(start, from)) return [];
  if (canStand(bounded) && clearLine(to, bounded)) path.push(bounded);
  return path;
}
