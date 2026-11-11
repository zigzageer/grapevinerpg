import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowLeft,
  Flame,
  Footprints,
  Heart,
  Play,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Utensils,
  Zap,
} from "lucide-react";
import type { Character } from "../game/model";
import {
  battleReducer,
  createBattle,
  GOOD_WINDOW,
  MOVES,
  PERFECT_WINDOW,
  TIMING_DURATION,
  TIMING_TARGET,
  timingGrade,
  type BattleEvent,
  type Fighter,
  type MoveId,
  type TimingGrade,
} from "../game/combat";
import { sceneryArtUrl } from "../game/art";
import { CharacterArt } from "./Character";
import { Modal } from "./Modal";

interface Props {
  actor: Character;
  other: Character;
  onPlay: (character: Character) => void;
  onClose: () => void;
}

function DuoStage({
  actor,
  other,
  event,
  eventId = 0,
  kissing = false,
}: {
  actor: Character;
  other: Character;
  event?: BattleEvent | null;
  eventId?: number;
  kissing?: boolean;
}) {
  const selfEffect = event && ["snack", "burn"].includes(event.move);
  const receivingSide = selfEffect
    ? event.actor
    : event?.actor === "player"
      ? "opponent"
      : "player";
  const blocked =
    event?.actor === "opponent" &&
    !selfEffect &&
    event.move !== "stun" &&
    event.grade !== "miss";
  return (
    <div
      className={`duo-stage ${kissing ? "duo-kiss" : ""}`}
      data-move={event?.move}
      data-actor={event?.actor}
      data-grade={event?.grade}
      aria-label={`${actor.name} and ${other.name}`}
    >
      <img className="duo-scenery" src={sceneryArtUrl("homes")} alt="" />
      <div className="duo-snow" />
      <div className="duo-animation" key={eventId}>
        {([actor, other] as const).map((character, index) => (
          <div
            key={index}
            className={`duo-fighter ${index ? "opponent" : "player"}`}
          >
            <span className="duo-shadow" />
            <div className="duo-motion">
              <svg viewBox="-42 -12 234 204" aria-label={character.name}>
                <CharacterArt c={character} facing={index ? -1 : 1} />
              </svg>
            </div>
          </div>
        ))}
        {event && event.damage !== 0 && (
          <span
            className={`duo-damage ${receivingSide} ${event.damage < 0 ? "healing" : ""}`}
            aria-hidden="true"
          >
            {event.damage < 0 ? `+${-event.damage}` : `−${event.damage}`}
          </span>
        )}
        {event?.move === "snowball" && (
          <span className="duo-projectile duo-snowball" aria-hidden="true">
            <Snowflake />
          </span>
        )}
        {event?.move === "spark" && (
          <span className="duo-projectile duo-spark" aria-hidden="true">
            <Flame />
          </span>
        )}
        {(event?.move === "brace" || blocked) && (
          <span className="duo-shield" aria-hidden="true">
            <Shield />
          </span>
        )}
      </div>
      {kissing && (
        <div className="duo-hearts" aria-hidden="true">
          <Heart />
          <Heart />
          <Heart />
        </div>
      )}
    </div>
  );
}

function FighterStatus({
  fighter,
  player = false,
  guarding = false,
}: {
  fighter: Fighter;
  player?: boolean;
  guarding?: boolean;
}) {
  return (
    <section className={`fighter-status ${player ? "player" : "opponent"}`}>
      <div className="fighter-name">
        <strong>{fighter.name}</strong>
        <span>{player ? "YOU" : "OPPONENT"}</span>
      </div>
      <div
        className="fighter-health"
        role="meter"
        aria-label={`${fighter.name} health`}
        aria-valuemin={0}
        aria-valuemax={fighter.maxHp}
        aria-valuenow={fighter.hp}
      >
        <span style={{ width: `${(fighter.hp / fighter.maxHp) * 100}%` }} />
      </div>
      <div className="fighter-numbers">
        <span>
          {fighter.hp} / {fighter.maxHp} HP
        </span>
        <span>
          {fighter.pp} / {fighter.maxPp} PP
        </span>
        <span>
          <Shield size={12} /> {fighter.armor}
        </span>
      </div>
      <div className="fighter-effects">
        {fighter.burning > 0 && (
          <span>
            <Flame size={12} /> Burning · {fighter.burning}
          </span>
        )}
        {fighter.stunned && (
          <span>
            <Zap size={12} /> Stunned
          </span>
        )}
        {guarding && (
          <span>
            <Shield size={12} /> Braced
          </span>
        )}
      </div>
    </section>
  );
}

function TimingInput({
  defending,
  onResolve,
}: {
  defending: boolean;
  onResolve: (grade: TimingGrade) => void;
}) {
  const meter = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const resolve = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(document.hidden);
  useEffect(() => {
    let start = performance.now();
    let pausedAt = document.hidden ? start : 0;
    let finished = false;
    let frame = 0;
    const finish = (progress: number) => {
      if (finished || pausedAt) return;
      finished = true;
      cancelAnimationFrame(frame);
      onResolve(timingGrade(progress));
    };
    resolve.current = () =>
      finish((performance.now() - start) / TIMING_DURATION);
    const tick = (now: number) => {
      if (pausedAt || finished) return;
      const progress = Math.min((now - start) / TIMING_DURATION, 1);
      meter.current?.style.setProperty(
        "--timing-progress",
        `${progress * 100}%`,
      );
      if (progress >= 1) finish(progress);
      else frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) {
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
      } else if (pausedAt) {
        start += performance.now() - pausedAt;
        pausedAt = 0;
        frame = requestAnimationFrame(tick);
      }
      setPaused(document.hidden);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) resolve.current();
      }
    };
    button.current?.focus({ preventScroll: true });
    button.current?.scrollIntoView({ block: "nearest" });
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keydown);
    };
  }, [onResolve]);
  return (
    <div className={`battle-timing ${defending ? "defending" : ""}`}>
      <p>
        {paused
          ? "Paused while this tab is hidden"
          : "Tap or press Space when the marker reaches the green zone."}
      </p>
      <div className="timing-track" ref={meter} aria-hidden="true">
        <span
          className="timing-good"
          style={{
            left: `${(TIMING_TARGET - GOOD_WINDOW) * 100}%`,
            width: `${GOOD_WINDOW * 200}%`,
          }}
        />
        <span
          className="timing-perfect"
          style={{
            left: `${(TIMING_TARGET - PERFECT_WINDOW) * 100}%`,
            width: `${PERFECT_WINDOW * 200}%`,
          }}
        />
        <span className="timing-marker" />
      </div>
      <button
        className="button primary timing-button"
        ref={button}
        disabled={paused}
        onClick={() => resolve.current()}
      >
        {defending ? <Shield size={20} /> : <Swords size={20} />}
        {defending ? "Block!" : "Strike!"}
      </button>
      <small>The gold center gives perfect timing.</small>
    </div>
  );
}

const MOVE_ICONS = {
  quick: Swords,
  heavy: Zap,
  snowball: Snowflake,
  spark: Flame,
  stomp: Footprints,
};

function Battle({
  actor,
  other,
  onBack,
  onClose,
}: Omit<Props, "onPlay"> & { onBack: () => void }) {
  const [battle, dispatch] = useReducer(battleReducer, undefined, () =>
    createBattle(actor.name, other.name),
  );
  const resolve = useCallback((grade: TimingGrade) => {
    dispatch({ type: "timing", grade });
  }, []);
  useEffect(() => {
    if (battle.phase !== "impact") return;
    const timer = setTimeout(() => dispatch({ type: "advance" }), 850);
    return () => clearTimeout(timer);
  }, [battle.phase, battle.eventId]);
  const finished = battle.phase === "victory" || battle.phase === "defeat";
  const timing = battle.phase === "attack" || battle.phase === "block";
  const turnLabel = finished
    ? battle.phase === "victory"
      ? `${actor.name} wins!`
      : `${other.name} wins!`
    : battle.phase === "choose"
      ? "Your turn"
      : battle.phase === "block"
        ? `${other.name} is using ${MOVES[battle.move].name}`
        : battle.phase === "attack"
          ? MOVES[battle.move].name
          : "Hit resolved";
  return (
    <div className="battle" data-testid="battle" data-phase={battle.phase}>
      <div className="battle-statuses">
        <FighterStatus
          fighter={battle.player}
          player
          guarding={battle.guarding}
        />
        <FighterStatus fighter={battle.opponent} />
      </div>
      <DuoStage
        actor={actor}
        other={other}
        event={battle.event}
        eventId={battle.eventId}
      />
      <div className="battle-turn-heading">
        <strong aria-live="polite">{turnLabel}</strong>
        <span>Round {battle.round}</span>
      </div>
      <p className="battle-feedback" role="status">
        {battle.event?.text ||
          "Choose a move, then time your hit. Block when your opponent attacks."}
      </p>
      {battle.phase === "choose" && (
        <div className="battle-moves" role="group" aria-label="Battle actions">
          {(Object.keys(MOVES) as MoveId[]).map((id) => {
            const move = MOVES[id];
            const Icon = MOVE_ICONS[id];
            return (
              <button
                key={id}
                className="battle-move"
                disabled={battle.player.pp < move.cost}
                onClick={() => dispatch({ type: "choose", move: id })}
                aria-label={`Use ${move.name}`}
              >
                <Icon size={20} />
                <strong>{move.name}</strong>
                <span>{move.cost ? `${move.cost} PP` : "+1 PP"}</span>
                <small>{move.description}</small>
              </button>
            );
          })}
          <button
            className="battle-move"
            onClick={() => dispatch({ type: "brace" })}
          >
            <Shield size={20} />
            <strong>Brace</strong>
            <span>+2 PP</span>
            <small>Reduce the next attack and recover power.</small>
          </button>
          <button
            className="battle-move"
            onClick={() => dispatch({ type: "snack" })}
            disabled={
              battle.itemUsed ||
              !battle.snacks ||
              battle.player.hp === battle.player.maxHp
            }
            aria-label="Eat a snack"
          >
            <Utensils size={20} />
            <strong>Snack</strong>
            <span>{battle.snacks} left</span>
            <small>Heal 28 HP. One per turn, before attacking.</small>
          </button>
        </div>
      )}
      {timing && (
        <TimingInput
          key={`${battle.phase}-${battle.round}`}
          defending={battle.phase === "block"}
          onResolve={resolve}
        />
      )}
      {battle.phase === "impact" && (
        <p className="battle-wait">
          {battle.event?.grade === "perfect" ? "Perfect timing!" : "Next turn…"}
        </p>
      )}
      {finished && (
        <div className="battle-result">
          <p>Health and power refill for each duel.</p>
          <button className="button primary" onClick={onBack}>
            Back to {other.name}
          </button>
          <button className="button secondary" onClick={onClose}>
            Back to town
          </button>
        </div>
      )}
      {!finished && (
        <button className="text-button battle-leave" onClick={onClose}>
          <ArrowLeft size={14} /> Leave fight
        </button>
      )}
    </div>
  );
}

export function CharacterInteraction({ actor, other, onPlay, onClose }: Props) {
  const [mode, setMode] = useState<"menu" | "fight" | "kiss">("menu");
  const [kissFinished, setKissFinished] = useState(false);
  useEffect(() => {
    if (mode !== "kiss") return;
    const timer = setTimeout(() => setKissFinished(true), 2400);
    return () => clearTimeout(timer);
  }, [mode]);
  return (
    <Modal
      title={mode === "fight" ? `${actor.name} vs ${other.name}` : other.name}
      eyebrow={
        mode === "fight" ? "FRIENDLY DUEL" : `WITH ${actor.name.toUpperCase()}`
      }
      className={`game-modal interaction-modal ${mode === "fight" ? "battle-modal" : ""}`}
      onClose={onClose}
      wide
    >
      {mode === "fight" ? (
        <Battle
          actor={actor}
          other={other}
          onBack={() => setMode("menu")}
          onClose={onClose}
        />
      ) : (
        <>
          <DuoStage actor={actor} other={other} kissing={mode === "kiss"} />
          {mode === "menu" ? (
            <div className="interaction-actions">
              <button
                className="button primary"
                onClick={() => setMode("fight")}
              >
                <Swords size={20} /> Fight
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setKissFinished(false);
                  setMode("kiss");
                }}
              >
                <Heart size={20} /> Kiss
              </button>
              <button
                className="button secondary"
                onClick={() => onPlay(other)}
              >
                <Play size={18} /> Play as {other.name}
              </button>
            </div>
          ) : (
            <div className="kiss-result">
              <p role="status">
                <Heart size={18} />{" "}
                {kissFinished
                  ? `${other.name} smiles.`
                  : `${actor.name} gives ${other.name} a quick kiss.`}
              </p>
              {kissFinished && (
                <button
                  className="button primary"
                  onClick={() => setMode("menu")}
                >
                  <Sparkles size={16} /> Back to {other.name}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
