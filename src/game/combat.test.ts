import { describe, expect, it } from "vitest";
import {
  battleReducer,
  createBattle,
  getMove,
  timingGrade,
  type BattleState,
  type MoveId,
} from "./combat";
import { CAST_ADDITIONS, DAVID, DEFAULT_CREW, parseCrew } from "./model";

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
    ).map(
      (character) => createBattle(character, "Opponent").player.signature?.name,
    );
    expect(signatures).toHaveLength(25);
    expect(signatures).not.toContain(undefined);
    expect(new Set(signatures).size).toBe(25);
    const renamed = { ...DAVID, name: "Dave", preset: undefined };
    const migrated = { ...DAVID, id: "friend-20" };
    expect(createBattle(renamed, blindian).player.signature?.name).toBe(
      "Grace",
    );
    expect(createBattle(migrated, blindian).player.signature?.name).toBe(
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
    expect(battle.player.signature).toMatchObject({
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
    expect(createBattle(invalid, blindian).player.signature?.name).toBe(
      "Grace",
    );
  });
});
