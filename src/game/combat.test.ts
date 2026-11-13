import { describe, expect, it } from "vitest";
import {
  battleReducer,
  createBattle,
  getMove,
  timingGrade,
  type BattleState,
  type MoveId,
} from "./combat";
import {
  BABASHARK,
  CAST_ADDITIONS,
  DAVID,
  DEFAULT_CREW,
  parseCrew,
  ZIPPY,
} from "./model";

function hit(state: BattleState, move: MoveId) {
  return battleReducer(battleReducer(state, { type: "choose", move }), {
    type: "timing",
    grade: "perfect",
  });
}
const advance = (state: BattleState) =>
  battleReducer(state, { type: "advance" });

describe("friendly duels", () => {
  it("grades the flash window and reduces late or early attack damage", () => {
    expect(timingGrade(0.7)).toBe("perfect");
    expect(timingGrade(0.6)).toBe("good");
    expect(timingGrade(0.1)).toBe("miss");
    expect(timingGrade(1)).toBe("miss");
    const battle = createBattle("Mint", "Miel");
    const perfect = hit(battle, "heavy");
    const missed = battleReducer(
      battleReducer(battle, { type: "choose", move: "heavy" }),
      { type: "timing", grade: "miss" },
    );
    expect(perfect.event!.damage).toBeGreaterThan(missed.event!.damage);
    expect(battle.opponent.hp).toBe(90);
  });

  it("charges PP once and ignores duplicate or out-of-turn inputs", () => {
    const selected = battleReducer(createBattle("Mint", "Miel"), {
      type: "choose",
      move: "stomp",
    });
    expect(selected.player.pp).toBe(2);
    expect(battleReducer(selected, { type: "choose", move: "spark" })).toBe(
      selected,
    );
    const resolved = battleReducer(selected, { type: "timing", grade: "good" });
    expect(battleReducer(resolved, { type: "timing", grade: "perfect" })).toBe(
      resolved,
    );
    const empty = {
      ...createBattle("Mint", "Miel"),
      player: { ...selected.player, pp: 0 },
    };
    expect(battleReducer(empty, { type: "choose", move: "spark" })).toBe(empty);
  });

  it("uses armor per hit and makes heavy attacks useful against it", () => {
    const battle = createBattle("Mint", "Miel");
    const armored = { ...battle, opponent: { ...battle.opponent, armor: 9 } };
    expect(hit(armored, "heavy").event!.damage).toBeGreaterThan(
      hit(armored, "quick").event!.damage,
    );
    expect(hit(armored, "spark").event!.damage).toBe(
      hit(battle, "spark").event!.damage,
    );
  });

  it("allows one snack before attacking and limits supplies to two", () => {
    const battle = createBattle("Mint", "Miel");
    expect(battleReducer(battle, { type: "snack" })).toBe(battle);
    const hurt = { ...battle, player: { ...battle.player, hp: 50 } };
    const healed = battleReducer(hurt, { type: "snack" });
    expect(healed.player.hp).toBe(78);
    expect(healed.phase).toBe("choose");
    expect(healed.snacks).toBe(1);
    expect(battleReducer(healed, { type: "snack" })).toBe(healed);
    expect(battleReducer(healed, { type: "choose", move: "quick" }).phase).toBe(
      "attack",
    );
  });

  it("reduces damage on blocks, rewards perfect blocks, and supports bracing", () => {
    const battle = createBattle("Mint", "Miel");
    const enemyTurn = advance(hit(battle, "spark"));
    const missed = battleReducer(enemyTurn, { type: "timing", grade: "miss" });
    const perfect = battleReducer(enemyTurn, {
      type: "timing",
      grade: "perfect",
    });
    expect(perfect.player.hp).toBeGreaterThan(missed.player.hp);
    expect(perfect.player.pp).toBe(enemyTurn.player.pp + 1);
    const braced = advance(battleReducer(battle, { type: "brace" }));
    const guarded = battleReducer(braced, { type: "timing", grade: "miss" });
    expect(guarded.player.hp).toBeGreaterThan(missed.player.hp);
    expect(advance(guarded).guarding).toBe(false);
  });

  it("ticks burning on turns, skips a stunned turn, and finishes without retaliation", () => {
    const battle = createBattle("Mint", "Miel");
    const burned = hit(battle, "spark");
    expect(burned.opponent.burning).toBe(2);
    const ticking = advance(burned);
    expect(ticking.opponent.hp).toBe(burned.opponent.hp - 4);
    expect(ticking.opponent.burning).toBe(1);
    const stunned = advance(hit(battle, "stomp"));
    expect(stunned.phase).toBe("choose");
    expect(stunned.round).toBe(2);
    expect(stunned.player.hp).toBe(100);
    expect(stunned.opponent.stunned).toBe(false);
    const nearlyDone = { ...battle, opponent: { ...battle.opponent, hp: 1 } };
    const won = advance(hit(nearlyDone, "heavy"));
    expect(won.phase).toBe("victory");
    expect(battleReducer(won, { type: "choose", move: "quick" })).toBe(won);
    const lost = advance({
      ...battle,
      phase: "impact",
      player: { ...battle.player, hp: 0 },
    });
    expect(lost.phase).toBe("defeat");
  });
});

describe("signature abilities", () => {
  const blindian = CAST_ADDITIONS[1];

  it("gives the named cast distinct moves even after renaming or migrating a character", () => {
    const signatures = DEFAULT_CREW.filter(
      (character) => character.preset || character.kind === "mint",
    ).map((character) => createBattle(character, "Opponent").player.signatures);
    expect(signatures).toHaveLength(28);
    expect(signatures.every((moves) => moves.length > 0)).toBe(true);
    expect(new Set(signatures.flat().map((move) => move.name)).size).toBe(34);
    const renamed = { ...DAVID, name: "Dave", preset: undefined };
    const migrated = { ...DAVID, id: "friend-20" };
    expect(createBattle(renamed, blindian).player.signatures[0].name).toBe(
      "Grace",
    );
    expect(createBattle(migrated, blindian).player.signatures[0].name).toBe(
      "Grace",
    );
  });

  it("rolls Grace's hits, spends PP once, and tags the opponent on a timed hit", () => {
    const battle = createBattle(DAVID, blindian);
    const chosen = battleReducer(battle, { type: "choose", move: "signature" });
    expect(chosen.player.pp).toBe(2);
    const low = battleReducer(chosen, {
      type: "timing",
      grade: "good",
      roll: 0,
    });
    const high = battleReducer(chosen, {
      type: "timing",
      grade: "good",
      roll: 0.99,
    });
    expect(low.event).toMatchObject({ visual: "grace", hits: 1, tag: "CUCK" });
    expect(high.event).toMatchObject({ visual: "grace", hits: 3, tag: "CUCK" });
    expect(high.event?.damage).toBe((low.event?.damage ?? 0) * 3);
    expect(high.player.pp).toBe(2);
    expect(
      battleReducer(chosen, { type: "timing", grade: "miss" }).event?.tag,
    ).toBeUndefined();
    const next = { ...chosen, phase: "choose" as const };
    expect(battleReducer(next, { type: "choose", move: "signature" })).toBe(
      next,
    );
  });

  it("resolves Indian Attack for blindian on either side and keeps signatures separate", () => {
    const battle = createBattle(DAVID, blindian);
    const enemyTurn = advance(hit({ ...battle, round: 3 }, "quick"));
    expect(enemyTurn.move).toBe("signature");
    expect(enemyTurn.opponent.pp).toBe(2);
    expect(getMove(enemyTurn.opponent, enemyTurn.move)?.name).toBe(
      "Indian Attack",
    );
    expect(
      battleReducer(enemyTurn, { type: "timing", grade: "miss" }).event,
    ).toMatchObject({
      actor: "opponent",
      visual: "tag-team",
      hits: 2,
    });
    const playerStrike = hit(createBattle(blindian, DAVID), "signature");
    expect(playerStrike.event).toMatchObject({
      actor: "player",
      visual: "tag-team",
      hits: 2,
    });
    const guest = createBattle("Guest", blindian);
    expect(battleReducer(guest, { type: "choose", move: "signature" })).toBe(
      guest,
    );
  });

  it("restores a generated move from crew data and uses the selected style's fixed rules", () => {
    const ability = {
      name: "Jelly Bean Storm",
      description: "A handful of jelly beans flies across the road.",
      style: "projectile",
      art: "/api/studio/assets/a1a1a1a1-0000-0000-0000-000000000000.png",
      damage: 10_000,
    };
    const [custom] = parseCrew([{ ...DAVID, ability }]);
    const battle = createBattle(custom, blindian);
    expect(battle.player.signatures[0]).toMatchObject({
      name: ability.name,
      visual: ability.style,
      art: ability.art,
      cost: 3,
      damage: 26,
    });
    expect(hit(battle, "signature").event?.art).toBe(ability.art);
    const [invalid] = parseCrew([
      {
        ...DAVID,
        ability: { ...ability, art: "https://example.com/sprite.png" },
      },
    ]);
    expect(invalid.ability).toBeUndefined();
    expect(createBattle(invalid, blindian).player.signatures[0].name).toBe(
      "Grace",
    );
  });

  it("makes Diddy Party skip one turn on a timed hit and leaves the target awake on a miss", () => {
    const duel = createBattle(BABASHARK, DAVID);
    expect(duel.player.signatures.map((move) => move.name)).toEqual([
      "Diddy Party",
      "Kick the Baby",
      "SIMPs Assemble",
      "Chaz",
    ]);
    expect(getMove(duel.opponent, "diddy-party")).toBeUndefined();
    const asleep = hit(duel, "diddy-party");
    expect(asleep.opponent).toMatchObject({ hp: 90, asleep: true });
    expect(asleep.event).toMatchObject({ damage: 0, slept: true });
    const next = advance(asleep);
    expect(next).toMatchObject({
      phase: "choose",
      round: 2,
      event: { move: "sleep" },
    });
    expect(next.opponent.asleep).toBe(false);
    const miss = battleReducer(
      battleReducer(duel, { type: "choose", move: "diddy-party" }),
      {
        type: "timing",
        grade: "miss",
      },
    );
    expect(miss.opponent.asleep).toBe(false);
    expect(advance(miss).phase).toBe("block");
  });

  it("uses the baby and Corvette for damage and cash to heal the caster", () => {
    const duel = createBattle(BABASHARK, DAVID);
    for (const move of ["kick-the-baby", "chaz"] as const) {
      const resolved = hit(duel, move);
      expect(resolved.event?.visual).toBe(move);
      expect(resolved.opponent.hp).toBeLessThan(duel.opponent.hp);
    }
    const hurt = { ...duel, player: { ...duel.player, hp: 70 } };
    const healed = hit(hurt, "simps-assemble");
    expect(healed.player).toMatchObject({ hp: 100, pp: 4 });
    expect(healed.event).toMatchObject({
      visual: "simps-assemble",
      damage: -30,
    });
    expect(healed.opponent).toEqual(duel.opponent);
  });

  it("keeps Zippy's three attacks on a published character with a generated move", () => {
    const art = "/api/studio/assets/a1a1a1a1-0000-0000-0000-000000000000.png";
    const zippy = {
      ...ZIPPY,
      preset: undefined,
      sprite: art,
      ability: {
        name: "Jelly Bean Storm",
        description: "Throw a handful of jelly beans.",
        style: "projectile" as const,
        art,
      },
    };
    const duel = createBattle(zippy, DAVID);
    expect(duel.player.signatures.map((move) => move.id)).toEqual([
      "diarrhea-spray",
      "needle-toss",
      "fleshlight-volley",
      "signature",
    ]);
    const attacks = [
      ["diarrhea-spray", 1],
      ["needle-toss", 3],
      ["fleshlight-volley", 2],
    ] as const;
    for (const [id, hits] of attacks) {
      const resolved = hit(duel, id);
      expect(resolved.event).toMatchObject({ move: id, visual: id, hits });
      expect(resolved.event?.art).toBe(`/abilities/zippy-${id}.webp`);
      expect(resolved.opponent.hp).toBeLessThan(duel.opponent.hp);
      expect(resolved.player.pp).toBe(3);
    }
    expect(hit(duel, "signature").event?.art).toBe(art);
  });

  it("lets Footjobofsteel hit twice with the drill or heal with First Aid", () => {
    const nurse = DEFAULT_CREW.find((c) => c.preset === "footjobofsteel")!;
    const duel = createBattle(nurse, DAVID);
    expect(duel.player.signatures.map(({ id }) => id)).toEqual([
      "drill-rush",
      "first-aid",
    ]);
    expect(hit(duel, "drill-rush").event).toMatchObject({
      visual: "drill-rush",
      hits: 2,
    });
    const injured = { ...duel, player: { ...duel.player, hp: 60 } };
    const treated = battleReducer(
      battleReducer(injured, { type: "choose", move: "first-aid" }),
      { type: "timing", grade: "good" },
    );
    expect(treated.player).toMatchObject({ hp: 84, pp: 3 });
    expect(treated.opponent).toEqual(duel.opponent);
    expect(treated.event).toMatchObject({ visual: "first-aid", damage: -24 });
  });
});
