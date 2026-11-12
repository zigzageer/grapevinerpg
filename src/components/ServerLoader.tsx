import { useEffect, useState } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import {
  parseServerGame,
  serverIdFromPath,
  type ServerGame,
} from "../game/server";
import { CharacterStudio } from "./CharacterStudio";
import { Town } from "./Town";
import { followCamera, DEFAULT_ZOOM } from "../game/camera";
import { START } from "../game/model";
import { parseServerTown, type ServerTown } from "../game/server-town";

export function ServerLoader({
  children,
}: {
  children: (server?: ServerGame, town?: ServerTown) => React.ReactNode;
}) {
  const path = window.location.pathname;
  const isDemo =
    !!(globalThis as { __MINT_ART__?: unknown }).__MINT_ART__ ||
    window.location.protocol === "file:" ||
    path === "/" ||
    path === "/index.html";
  const guildId = serverIdFromPath(path);
  const [loaded, setLoaded] = useState<{
    server: ServerGame;
    town?: ServerTown;
  }>();
  const server = loaded?.server;
  const town = loaded?.town;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [studioOpen, setStudioOpen] = useState(false);
  useEffect(() => {
    if (isDemo || !guildId) return;
    const controller = new AbortController();
    let loadedFromStudio = false;
    let cachedTown: { source: string; town: ServerTown } | undefined;
    const fetchGame = async () => {
      try {
        let response = await fetch(`/api/studio/games/${guildId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const fromStudio =
          response.ok &&
          response.headers.get("content-type")?.includes("application/json");
        if (!fromStudio && !loadedFromStudio)
          response = await fetch(`/games/${guildId}/game.json`, {
            cache: "no-store",
            signal: controller.signal,
          });
        if (!response.ok || (loadedFromStudio && !fromStudio))
          throw new Error(
            response.status === 404
              ? "This game isn’t available yet. If you just created it, give it a moment to publish."
              : "The game couldn’t load. Check your connection and try again.",
          );
        const next = parseServerGame(await response.json(), guildId);
        let nextTown: ServerTown | undefined;
        if (next.town) {
          const layout = await fetch(next.town.path, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!layout.ok)
            throw new Error(
              "This server’s town is still publishing. Check again shortly.",
            );
          const source = await layout.text();
          if (source.length > 64_000)
            throw new Error("This server’s town file is too large.");
          if (source !== cachedTown?.source) {
            cachedTown = {
              source,
              town: parseServerTown(JSON.parse(source), guildId),
            };
          }
          nextTown = cachedTown.town;
        }
        if (controller.signal.aborted) return;
        if (fromStudio) loadedFromStudio = true;
        setLoaded((old) =>
          old && Date.parse(old.server.updatedAt) > Date.parse(next.updatedAt)
            ? old
            : old?.town === nextTown && old?.server.updatedAt === next.updatedAt
              ? old
              : { server: next, town: nextTown },
        );
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
  if (server?.characters.length) return children(server, town);
  const spawn = town?.spawn ?? START;
  const camera = followCamera(
    spawn,
    window.innerWidth / window.innerHeight,
    DEFAULT_ZOOM,
    window.innerHeight,
    town,
  );
  return (
    <main className="play-screen server-lobby" aria-label="Server game">
      <div className="world-viewport" aria-hidden="true">
        <Town
          camera={camera}
          player={spawn}
          moving={false}
          facing={1}
          crew={[]}
          activeKey=""
          target={null}
          onMove={() => {}}
          onSelect={() => {}}
          townName={town?.name ?? server?.name}
          serverTown={town}
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
              friend into the game.
            </p>
            <button
              className="button primary"
              onClick={() => setStudioOpen(true)}
            >
              <Plus size={16} /> Add character
            </button>
            <code>Or use /game add user:@friend in Discord</code>
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
      {studioOpen && guildId && (
        <CharacterStudio
          gameId={guildId}
          onClose={() => setStudioOpen(false)}
          onPublished={(game) => {
            setLoaded({ server: parseServerGame(game, guildId), town });
            setStudioOpen(false);
          }}
        />
      )}
    </main>
  );
}
