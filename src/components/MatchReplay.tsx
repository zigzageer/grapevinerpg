import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Pause,
  Play,
  SkipForward,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { uiArtUrl } from "../game/art";
import type { MatchEvent, MatchFighter, MatchSnapshot } from "../game/matches";
import { studioRequest } from "../game/studio";
import "./match-replay.css";

const terminal = (status: MatchSnapshot["status"]) =>
  status === "finished" || status === "cancelled";

function Fighter({
  fighter,
  hp,
  turn,
}: {
  fighter: MatchFighter;
  hp: number;
  turn: boolean;
}) {
  return (
    <li className="replay-fighter" data-turn={turn} data-out={hp === 0}>
      <span className="replay-fighter-art">
        {fighter.sprite ? (
          <img src={fighter.sprite} alt="" />
        ) : (
          <Users size={20} />
        )}
      </span>
      <div className="replay-fighter-info">
        <strong>{fighter.name}</strong>
        <span>{fighter.ability}</span>
        <meter
          aria-label={`${fighter.name} health`}
          min={0}
          max={100}
          value={hp}
        />
      </div>
      <span className="replay-hp">{hp} HP</span>
    </li>
  );
}

function ReplayMove({
  event,
  fighters,
}: {
  event: MatchEvent;
  fighters: Map<string, MatchFighter>;
}) {
  const actor = fighters.get(event.actorId)?.name;
  const target = fighters.get(event.targetId)?.name;
  const { actorHp, damage, kind, move, targetHp } = event;
  if (actorHp !== undefined) {
    return (
      <>
        <strong>{actor}</strong> used {move}
        <span>Recovered to {actorHp} HP</span>
      </>
    );
  }
  if (kind === "attack" && (move === "Stunned" || move === "Asleep")) {
    return (
      <>
        <strong>{target}</strong> missed a turn<span>{move}</span>
      </>
    );
  }
  if (kind === "attack" && move === "Burning") {
    return (
      <>
        <strong>{target}</strong> took burn damage
        <span>{targetHp ? `${damage} damage` : "Knocked out"}</span>
      </>
    );
  }
  const outcome =
    targetHp === 0
      ? "Knocked out"
      : damage
        ? `${damage} damage`
        : "Status effect";
  return (
    <>
      <strong>{actor}</strong> used {move} on <strong>{target}</strong>
      <span>{outcome}</span>
    </>
  );
}

export function MatchReplay({ id }: { id: string }) {
  const [match, setMatch] = useState<MatchSnapshot>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const next = await studioRequest<MatchSnapshot>(
          `/matches/${id}`,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setMatch(next);
        setError("");
        if (!terminal(next.status)) timer = setTimeout(read, 2500);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          timer = setTimeout(read, 5000);
        }
      }
    };
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, retry]);
  useEffect(() => {
    if (match?.status !== "signup") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [match?.status]);

  const length = match?.events.length ?? 0;
  useEffect(() => {
    if (!playing || step === null) return;
    if (step >= length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(step + 1), 680);
    return () => clearTimeout(timer);
  }, [playing, step, length]);

  if (!match)
    return (
      <main className="match-replay">
        <a className="replay-back" href="/grapevine">
          <ArrowLeft size={17} /> Grapevine
        </a>
        <section className="replay-empty" aria-live="polite">
          <h1>{error ? "Match unavailable" : "Loading match…"}</h1>
          {error && <p>{error}</p>}
          {error && (
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Try again
            </button>
          )}
        </section>
      </main>
    );

  const seconds = Math.max(
    0,
    Math.ceil(((match.joinUntil ?? now) - now) / 1000),
  );
  const timerLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const events = step === null ? match.events : match.events.slice(0, step);
  const latest = events.at(-1);
  const fighters = new Map(
    match.sides.flatMap((side) => side.players.map((p) => [p.id, p] as const)),
  );
  const replayHealth = new Map<string, number>();
  for (const event of events) {
    replayHealth.set(event.targetId, event.targetHp);
    if (event.actorHp !== undefined)
      replayHealth.set(event.actorId, event.actorHp);
  }
  const sideTitle = (index: 0 | 1) => {
    const side = match.sides[index];
    return match.kind === "duel" && side.players.length
      ? side.players[0].name
      : side.name;
  };
  const winner = match.winnerSide === null ? null : sideTitle(match.winnerSide);
  const matchLabel =
    match.kind === "war"
      ? "Server War"
      : match.mode === "auto"
        ? "Discord Fight"
        : "Discord Duel";
  const cancellationReasons: Record<string, string> = {
    "not-enough-players": "A team fell short of the signup minimum.",
    "challenge-expired": "The challenge expired.",
    declined: "The other side declined the challenge.",
  };
  const cancellation = cancellationReasons[match.reason ?? ""];
  const status =
    match.status === "signup"
      ? "Signup open"
      : match.status === "offered"
        ? "Awaiting acceptance"
        : match.status === "running"
          ? "In progress"
          : match.status === "finished"
            ? "Match finished"
            : "Match cancelled";

  return (
    <main className="match-replay" aria-label={matchLabel}>
      <a className="replay-back" href="/grapevine">
        <ArrowLeft size={17} /> Grapevine
      </a>
      <header className="replay-heading" data-match-status={match.status}>
        <div className="replay-heading-copy">
          <p>{matchLabel}</p>
          <h1>
            {sideTitle(0)} <span className="replay-versus">vs</span>{" "}
            {sideTitle(1)}
          </h1>
        </div>
        <span className="replay-status">
          <Swords size={15} /> {status}
        </span>
        <img
          className="replay-impact"
          src={uiArtUrl("impact")}
          alt=""
          draggable={false}
        />
      </header>
      <section
        className="replay-summary"
        data-result={winner ? "winner" : match.status}
        aria-live="polite"
      >
        {winner ? (
          <>
            <Trophy size={23} />
            <strong>{winner} wins</strong>
          </>
        ) : match.status === "signup" ? (
          <>
            <Clock size={22} />
            <strong>{timerLabel}</strong>
            <span className="replay-signup-note">
              Join in Discord. {match.minPlayersPerSide} needed per side.
            </span>
          </>
        ) : match.status === "cancelled" ? (
          <span>{cancellation ?? "This match was cancelled."}</span>
        ) : match.status === "offered" ? (
          <span>The challenge is waiting for a response in Discord.</span>
        ) : (
          <span>
            Current turn ·{" "}
            {fighters.get(match.turnFighterId ?? "")?.name ?? "Resolving match"}
          </span>
        )}
      </section>
      {error && (
        <p className="replay-error" role="status">
          {error}
        </p>
      )}
      <div className="replay-sides">
        {match.sides.map((side, index) => (
          <section
            key={index}
            className="replay-side"
            aria-label={`Side ${index + 1}`}
          >
            <header>
              <h2>{side.name}</h2>
              <span>{side.players.length} joined</span>
            </header>
            {side.players.length ? (
              <ul>
                {side.players.map((fighter) => (
                  <Fighter
                    key={fighter.id}
                    fighter={fighter}
                    hp={
                      step === null
                        ? fighter.hp
                        : (replayHealth.get(fighter.id) ??
                          fighter.startingHp ??
                          100)
                    }
                    turn={
                      fighter.id ===
                      (step === null ? match.turnFighterId : latest?.actorId)
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="replay-no-players">No fighters have joined yet.</p>
            )}
          </section>
        ))}
      </div>
      {length > 0 && (
        <section className="replay-log" aria-label="Match timeline">
          <header>
            <h2>
              {match.status === "finished" ? "Battle replay" : "Battle log"}
            </h2>
            {match.status === "finished" && (
              <div className="replay-controls">
                <button
                  className="button primary"
                  onClick={() => {
                    if (playing) setPlaying(false);
                    else {
                      if (step === null || step >= length) setStep(0);
                      setPlaying(true);
                    }
                  }}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                  {playing ? "Pause replay" : "Play replay"}
                </button>
                <button
                  className="button secondary"
                  disabled={playing || step === length}
                  onClick={() => setStep(Math.min(length, (step ?? 0) + 1))}
                >
                  <SkipForward size={16} /> Next move
                </button>
              </div>
            )}
          </header>
          {events.length ? (
            <ol reversed start={events.length}>
              {[...events].reverse().map((event) => (
                <li key={event.seq} data-current={event.seq === latest?.seq}>
                  <ReplayMove event={event} fighters={fighters} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="replay-no-players">Both teams are ready.</p>
          )}
        </section>
      )}
    </main>
  );
}
