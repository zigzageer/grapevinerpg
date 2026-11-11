import { canStand, OBSTACLES, type Point } from "./model";
import { WALK_BOUNDS } from "./locations";
const STEP = 20;
const key = (p: Point) => `${p.x},${p.y}`;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
function clearLine(a: Point, b: Point) {
  if (!canStand(a) || !canStand(b)) return false;
  // Intersect the full segment with each padded footprint. Sampling can miss a
  // narrow slice of a corner and leave an auto-walking character stuck there.
  return !OBSTACLES.some((r) => {
    let enter = 0,
      leave = 1;
    const axes = [
      [a.x, b.x - a.x, r.x - 15, r.x + r.w + 15],
      [a.y, b.y - a.y, r.y - 8, r.y + r.h + 8],
    ];
    for (const [origin, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-10) {
        if (origin <= min || origin >= max) return false;
      } else {
        const t1 = (min - origin) / delta,
          t2 = (max - origin) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
        if (leave - enter <= 1e-10) return false;
      }
    }
    return leave - enter > 1e-10;
  });
}
const nodes: Point[] = [];
for (
  let y = Math.ceil(WALK_BOUNDS.top / STEP) * STEP;
  y <= WALK_BOUNDS.bottom;
  y += STEP
)
  for (
    let x = Math.ceil(WALK_BOUNDS.left / STEP) * STEP;
    x <= WALK_BOUNDS.right;
    x += STEP
  )
    if (canStand({ x, y })) nodes.push({ x, y });

/** Keep long trips responsive on phones without sorting the entire frontier. */
class Frontier {
  items: { p: Point; cost: number; score: number }[] = [];
  push(item: (typeof this.items)[number]) {
    let i = this.items.push(item) - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent].score <= item.score) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0],
      last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.items.length &&
          this.items[child + 1].score < this.items[child].score
        )
          child++;
        if (last.score <= this.items[child].score) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}
export function findPath(start: Point, requested: Point): Point[] {
  if (
    !canStand(start) ||
    !Number.isFinite(requested.x) ||
    !Number.isFinite(requested.y)
  )
    return [];
  const bounded = {
    x: Math.max(WALK_BOUNDS.left, Math.min(WALK_BOUNDS.right, requested.x)),
    y: Math.max(WALK_BOUNDS.top, Math.min(WALK_BOUNDS.bottom, requested.y)),
  };
  if (canStand(bounded) && clearLine(start, bounded)) return [bounded];
  const nearest = (p: Point) =>
    nodes.reduce((a, b) =>
      Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y)
        ? a
        : b,
    );
  const from = nearest(start),
    to = nearest(bounded);
  if (!clearLine(start, from)) return [];
  const open = new Frontier(),
    costs = new Map([[key(from), 0]]),
    parents = new Map<string, Point>();
  open.push({
    p: from,
    cost: 0,
    score: Math.hypot(from.x - to.x, from.y - to.y),
  });
  let found = false;
  while (open.items.length) {
    const { p: current, cost } = open.pop();
    if (cost !== costs.get(key(current))) continue;
    if (same(current, to)) {
      found = true;
      break;
    }
    for (const dx of [-STEP, 0, STEP])
      for (const dy of [-STEP, 0, STEP]) {
        if (!dx && !dy) continue;
        const next = { x: current.x + dx, y: current.y + dy },
          nk = key(next);
        if (!canStand(next) || !clearLine(current, next)) continue;
        const nextCost = cost + Math.hypot(dx, dy);
        if (nextCost >= (costs.get(nk) ?? Infinity)) continue;
        costs.set(nk, nextCost);
        parents.set(nk, current);
        open.push({
          p: next,
          cost: nextCost,
          score: nextCost + Math.hypot(next.x - to.x, next.y - to.y),
        });
      }
  }
  if (!found) return [];
  const path = [to];
  let p = to;
  while (!same(p, from)) {
    p = parents.get(key(p))!;
    path.unshift(p);
  }
  if (canStand(bounded) && clearLine(to, bounded)) path.push(bounded);
  // Keep only turns with a clear segment between them. Following every grid
  // point adds stop/start frames and makes distant destinations needlessly slow.
  const full = [start, ...path],
    turns: Point[] = [];
  for (let i = 0; i < full.length - 1; ) {
    let next = full.length - 1;
    while (next > i + 1 && !clearLine(full[i], full[next])) next--;
    turns.push(full[next]);
    i = next;
  }
  return turns;
}
