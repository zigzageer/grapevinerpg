import { useEffect, useState } from "react";
import { Heart, Play, Swords } from "lucide-react";
import { sceneryArtUrl } from "../game/art";
import { characterScale, type Character } from "../game/model";
import { Battle } from "./Battle";
import { CharacterArt } from "./Character";
import { Modal } from "./Modal";
import "../battle-screen.css";

interface Props {
  actor: Character;
  other: Character;
  crew?: Character[];
  onChallenge?: () => void;
  challengePending?: boolean;
  onFightingChange?: (fighting: boolean) => void;
  onPlay: (character: Character) => void;
  onClose: () => void;
}

function InteractionStage({
  actor,
  other,
  kissing,
}: Pick<Props, "actor" | "other"> & { kissing: boolean }) {
  const scale = Math.max(1, characterScale(actor), characterScale(other));
  const halfWidth = Math.max(117, 75 * scale + 8);
  return (
    <div
      className={`interaction-stage ${kissing ? "duo-kiss" : ""}`}
      aria-hidden="true"
    >
      <img
        className="interaction-scenery"
        src={sceneryArtUrl("homes")}
        alt=""
      />
      <div className="interaction-snow" />
      {([actor, other] as const).map((character, index) => (
        <div
          key={index}
          className={`interaction-fighter ${index ? "opponent" : "player"}`}
        >
          <span className="interaction-shadow" />
          <div className="interaction-motion">
            <svg
              viewBox={`${75 - halfWidth} ${180 - 192 * scale} ${halfWidth * 2} ${204 * scale}`}
            >
              <CharacterArt c={character} facing={index ? -1 : 1} />
            </svg>
          </div>
        </div>
      ))}
      {kissing && (
        <div className="interaction-hearts">
          <Heart />
          <Heart />
          <Heart />
        </div>
      )}
    </div>
  );
}

export function CharacterInteraction({
  actor,
  other,
  crew,
  onChallenge,
  challengePending,
  onFightingChange,
  onPlay,
  onClose,
}: Props) {
  const [mode, setMode] = useState<"menu" | "fight" | "kiss">("menu");
  const [kissFinished, setKissFinished] = useState(false);
  useEffect(() => {
    if (mode !== "fight") return;
    onFightingChange?.(true);
    return () => onFightingChange?.(false);
  }, [mode, onFightingChange]);
  useEffect(() => {
    if (mode !== "kiss") return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 650
      : 2400;
    const timer = setTimeout(() => setKissFinished(true), duration);
    return () => clearTimeout(timer);
  }, [mode]);

  if (mode === "fight")
    return (
      <Battle
        actor={actor}
        other={other}
        crew={crew}
        onBack={() => setMode("menu")}
        onClose={onClose}
      />
    );

  return (
    <Modal
      title={other.name}
      eyebrow={`WITH ${actor.name.toUpperCase()}`}
      className="game-modal interaction-modal"
      onClose={onClose}
      wide
    >
      <InteractionStage actor={actor} other={other} kissing={mode === "kiss"} />
      {mode === "menu" ? (
        <div className="interaction-actions">
          <button
            className="button primary"
            disabled={challengePending}
            onClick={onChallenge ?? (() => setMode("fight"))}
          >
            <Swords size={20} /> {challengePending ? "Sending…" : "Fight"}
          </button>
          {!onChallenge && (
            <>
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
            </>
          )}
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
            <button className="button primary" onClick={() => setMode("menu")}>
              Back to {other.name}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
