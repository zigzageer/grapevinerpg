import { Swords, Trophy } from "lucide-react";
import type { Character } from "../game/model";
import type { MyTownDuel, TownDuelAction } from "../game/town-duels";
import "../town-duel-notice.css";

export function TownDuelNotice({
  duel,
  roster,
  pending,
  onAction,
  onDismiss,
}: {
  duel: MyTownDuel;
  roster: ReadonlyMap<string, Character>;
  pending: boolean;
  onAction: (action: TownDuelAction) => void;
  onDismiss: () => void;
}) {
  const names = duel.characterIds.map((id) => roster.get(id)?.name ?? "Player");
  const offered = duel.status === "offered";
  const incoming = offered && duel.role === "opponent";
  const finished = duel.status === "finished";
  const title = offered
    ? incoming
      ? `${names[0]} challenges you`
      : `Waiting for ${names[1]}`
    : finished
      ? `${names[duel.characterIds.indexOf(duel.winnerCharacterId ?? "")]} wins!`
      : `${names[0]} vs ${names[1]}`;
  return (
    <section className="town-duel-notice" aria-label="Online fight">
      <div className="town-duel-heading" role="status">
        {finished ? <Trophy size={18} /> : <Swords size={18} />}
        <strong>{title}</strong>
      </div>
      {offered && (
        <div className="town-duel-actions">
          {incoming && (
            <button
              type="button"
              className="button primary"
              disabled={pending}
              onClick={() => onAction({ action: "accept", duelId: duel.id })}
            >
              Accept fight
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() =>
              onAction({
                action: incoming ? "decline" : "cancel",
                duelId: duel.id,
              })
            }
          >
            {incoming ? "Decline" : "Cancel challenge"}
          </button>
        </div>
      )}
      {finished && (
        <button type="button" className="button secondary" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </section>
  );
}
