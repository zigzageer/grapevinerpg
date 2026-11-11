import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import {
  parseServerGame,
  serverIdFromPath,
  type ServerGame,
} from "../game/server";
import { Town } from "./Town";
import { followCamera, DEFAULT_ZOOM } from "../game/camera";
import { START } from "../game/model";

export function ServerLoader({
  children,
}: {
  children: (server?: ServerGame) => React.ReactNode;
}) {
  const path = window.location.pathname;
  const isDemo =
    !!(globalThis as { __MINT_ART__?: unknown }).__MINT_ART__ ||
    window.location.protocol === "file:" ||
    path === "/" ||
    path === "/index.html";
  const guildId = serverIdFromPath(path);
  const [server, setServer] = useState<ServerGame>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (isDemo || !guildId) return;
    const controller = new AbortController();
    const fetchGame = async () => {
      try {
        const response = await fetch(`/games/${guildId}/game.json`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This game isn’t available yet. If you just created it, give it a moment to publish."
              : "The game couldn’t load. Check your connection and try again.",
          );
        const next = parseServerGame(await response.json(), guildId);
        setServer((old) => (old?.updatedAt === next.updatedAt ? old : next));
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "The game couldn’t load.");
      }
    };
    void fetchGame();
    // A newly published character becomes playable without resetting this session.
    const interval = setInterval(() => {
      if (!document.hidden) void fetchGame();
    }, 15_000);
    window.addEventListener("focus", fetchGame);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", fetchGame);
    };
  }, [guildId, isDemo, attempt]);
  useEffect(() => {
    if (server) document.title = `${server.name} — Adventures of Mint`;
  }, [server?.name]);
  if (isDemo) return children();
  if (server?.characters.length) return children(server);
  const camera = followCamera(
    START,
    window.innerWidth / window.innerHeight,
    DEFAULT_ZOOM,
    window.innerHeight,
  );
  return (
    <main className="play-screen server-lobby" aria-label="Server game">
      <div className="world-viewport" aria-hidden="true">
        <Town
          camera={camera}
          player={START}
          moving={false}
          facing={1}
          crew={[]}
          activeKey=""
          target={null}
          onMove={() => {}}
          onSelect={() => {}}
          townName={server?.name}
        />
      </div>
      <section className="server-welcome" aria-live="polite">
        <span className="server-welcome-icon">
          <Users size={30} />
        </span>
        <p className="server-eyebrow">YOUR SERVER. YOUR TOWN.</p>
        <h1>
          {server?.name ||
            (guildId ? "Your town is on its way." : "Game not found.")}
        </h1>
        {server ? (
          <>
            <p>
              A fresh town with <strong>0 characters</strong>. Bring your first
              friend into the game from Discord.
            </p>
            <code>/game add user:@friend</code>
            <p className="server-hint">
              New characters appear here when they’re ready.
            </p>
          </>
        ) : (
          <p>
            {error ||
              (guildId
                ? "Loading your server’s game…"
                : "Open the game link returned by /game create in Discord.")}
          </p>
        )}
        {guildId && (
          <button
            className="button primary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <RefreshCw size={16} /> Check for updates
          </button>
        )}
        <a href="/">Visit Adventures of Mint</a>
      </section>
    </main>
  );
}
