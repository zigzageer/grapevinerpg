import { describe, expect, it } from "vitest";
import {
  battleReducer,
  createBattle,
  timingGrade,
  type BattleState,
  type MoveId,
} from "./combat";

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
