function roll(match, size) {
  match.rng = (Math.imul(match.rng, 1664525) + 1013904223) >>> 0;
  return Math.floor((match.rng / 0x100000000) * size);
}

function hit(match, actor, target, kind, damage, move) {
  target.hp = Math.max(0, target.hp - damage);
  match.events.push({
    seq: match.events.length + 1,
    kind,
    actorId: actor.id,
    targetId: target.id,
    move,
    damage,
    targetHp: target.hp,
  });
}

function finish(match, side) {
  match.status = "finished";
  match.winnerSide = side;
  match.turnFighterId = null;
}

export function startDuel(match) {
  match.status = "running";
  match.turnFighterId = match.sides[roll(match, 2)].players[0].id;
}

export function duelHit(match, side, ability) {
  const actor = match.sides[side].players[0];
  const target = match.sides[1 - side].players[0];
  if (ability) actor.abilityUsed = true;
  hit(
    match,
    actor,
    target,
    ability ? "ability" : "attack",
    (ability ? 28 : 14) + roll(match, 11),
    ability ? actor.ability : "Strike",
  );
  if (target.hp === 0) finish(match, side);
  else match.turnFighterId = target.id;
}

export function simulateWar(match) {
  const standing = match.sides.map((side) => [...side.players]);
  while (standing[0].length && standing[1].length) {
    const side =
      roll(match, standing[0].length + standing[1].length) < standing[0].length
        ? 0
        : 1;
    const actor = standing[side][roll(match, standing[side].length)];
    const opponents = standing[1 - side];
    const [target] = opponents.splice(roll(match, opponents.length), 1);
    const signature = !actor.abilityUsed && roll(match, 3) === 0;
    if (signature) actor.abilityUsed = true;
    hit(
      match,
      actor,
      target,
      "knockout",
      target.hp,
      signature ? actor.ability : "Strike",
    );
  }
  finish(match, standing[0].length ? 0 : 1);
}
