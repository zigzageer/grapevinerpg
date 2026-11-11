import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Keyboard,
  MapPin,
  Map,
  Maximize2,
  Menu,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Character, Point, SaveGame } from "./game/model";
import {
  characterKey,
  loadSave,
  movePlayerInSteps,
  SAVE_KEY,
  START,
} from "./game/model";
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, followCamera } from "./game/camera";
import { findPath } from "./game/navigation";
import { Town } from "./components/Town";
import { ResidentDialogue } from "./components/TownLife";
import type { ResidentConversation } from "./game/town-life";
import { Portrait } from "./components/Character";
import { Modal } from "./components/Modal";
import { CharacterStudio } from "./components/CharacterStudio";
import { CharacterInteraction } from "./components/CharacterInteraction";
import {
  mergeStudioCrew,
  readAppliedVersions,
  rememberAppliedVersions,
  studioAvailable,
  studioRequest,
  type StudioGame,
} from "./game/studio";
import { CrewEditor } from "./components/CrewEditor";
import { TouchJoystick } from "./components/TouchJoystick";
import { TownMap } from "./components/TownMap";
import { TOWN_NAME, districtAt } from "./game/locations";
import { ServerLoader } from "./components/ServerLoader";
import { loadServerSave, serverSaveKey, type ServerGame } from "./game/server";

type Panel =
  | "characters"
  | "crew"
  | "studio"
  | "interact"
  | "talk"
  | "help"
  | "pause"
  | "map"
  | null;
function loadDemo(): SaveGame {
  const saved = loadSave();
  return {
    ...saved,
    crew: saved.crew.filter(
      (c) =>
        c.preset || c.sprite || !["Friend 01", "Friend 02"].includes(c.name),
    ),
  };
}

export default function App() {
  return (
    <ServerLoader>
      {(server) => <Game key={server?.guildId || "mint"} server={server} />}
    </ServerLoader>
  );
}

function Game({ server }: { server?: ServerGame }) {
  const saveKey = server ? serverSaveKey(server.guildId) : SAVE_KEY;
  const title = server?.name || "Adventures of Mint";
  const townName = server?.name || TOWN_NAME;
  const [game, setGame] = useState(() =>
      server ? loadServerSave(server) : loadDemo(),
    ),
    [player, setPlayer] = useState<Point>(game.player);
  const [moving, setMoving] = useState(false),
    [facing, setFacing] = useState(1),
    [target, setTarget] = useState<Point | null>(null);
  const [panel, setPanel] = useState<Panel>(null),
    [search, setSearch] = useState("");
  const sharedUpdatedAt = useRef(0);
  const [studioCharacter, setStudioCharacter] = useState<string | undefined>();
  const [interaction, setInteraction] = useState<{
    actor: Character;
    other: Character;
  } | null>(null);
  const [conversation, setConversation] =
    useState<ResidentConversation | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState<"saved" | "saving" | "failed">("saved"),
    [running, setRunning] = useState(false),
    [inputReset, setInputReset] = useState(0);
  const position = useRef(player),
    keys = useRef(new Set<string>()),
    stick = useRef<Point>({ x: 0, y: 0 }),
    path = useRef<Point[]>([]),
    state = useRef(game),
    blocked = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null),
    sceneRef = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const camera = followCamera(
    player,
    viewport.width / viewport.height,
    zoom,
    viewport.height,
  );
  const selectRef = useRef<(direction: number) => void>(() => {}),
    openRef = useRef<(p: Exclude<Panel, null>) => void>(() => {});
  const active =
      game.crew.find((c) => characterKey(c) === game.activeCharacter) ||
      game.crew[0],
    activeKey = characterKey(active),
    tvLook = game.tvLook !== false;
  state.current = game;
  blocked.current = !!panel;
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const stop = useCallback(() => {
    keys.current.clear();
    stick.current = { x: 0, y: 0 };
    path.current = [];
    setTarget(null);
    setMoving(false);
    setRunning(false);
    setInputReset((v) => v + 1);
  }, []);
  const select = useCallback(
    (c: Character) => {
      stop();
      setGame((g) => ({ ...g, activeCharacter: characterKey(c) }));
    },
    [stop],
  );
  const choose = (c: Character) => {
    select(c);
    setPanel(null);
    setSearch("");
  };
  selectRef.current = (direction) => {
    const i = game.crew.findIndex((c) => characterKey(c) === activeKey);
    select(game.crew[(i + direction + game.crew.length) % game.crew.length]);
  };
  const open = useCallback(
    (p: Exclude<Panel, null>) => {
      stop();
      setPanel(p);
      setSearch("");
    },
    [stop],
  );
  openRef.current = open;
  const openStudio = (characterId?: string) => {
    setStudioCharacter(characterId);
    open("studio");
  };
  const walkTo = (point: Point) => {
    const route = findPath(position.current, point);
    if (!route.length) {
      notify("Try the path around it.");
      return;
    }
    path.current = route;
    setTarget(route[route.length - 1]);
  };
  const setStick = useCallback((vector: Point) => {
    stick.current = blocked.current ? { x: 0, y: 0 } : vector;
    if (vector.x || vector.y) {
      path.current = [];
      setTarget(null);
    }
  }, []);
  const resetPosition = () => {
    stop();
    position.current = { ...START };
    setPlayer({ ...START });
    setZoom(DEFAULT_ZOOM);
    setPanel(null);
  };
  useEffect(() => {
    if (!server) return;
    setGame((g) => ({
      ...g,
      crew: server.characters,
      activeCharacter: server.characters.some((c) => c.id === g.activeCharacter)
        ? g.activeCharacter
        : server.characters[0]?.id,
    }));
  }, [server]);
  useEffect(() => {
    if (server || !studioAvailable()) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const shared = await studioRequest<StudioGame>(
          "/games/mint",
          undefined,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          Date.parse(shared.updatedAt) <= sharedUpdatedAt.current
        )
          return;
        sharedUpdatedAt.current = Date.parse(shared.updatedAt);
        const applied = readAppliedVersions();
        setGame((current) => {
          const crew = mergeStudioCrew(current.crew, shared, applied);
          return crew === current.crew ? current : { ...current, crew };
        });
        rememberAppliedVersions(shared);
      } catch {
        /* The existing cast and browser saves remain playable during a connection failure. */
      }
    };
    void refresh();
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [server?.guildId]);
  useEffect(() => {
    const measure = () => {
      const box = viewportRef.current?.getBoundingClientRect();
      if (box && box.width > 0 && box.height > 0)
        setViewport({ width: box.width, height: box.height });
    };
    const visibleHeight = () => {
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${window.visualViewport?.height || window.innerHeight}px`,
      );
      measure();
    };
    visibleHeight();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener("resize", visibleHeight);
    window.visualViewport?.addEventListener("resize", visibleHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", visibleHeight);
      window.visualViewport?.removeEventListener("resize", visibleHeight);
    };
  }, []);
  useEffect(() => {
    let frame = 0,
      last = 0,
      wasMoving = false;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      let pathDistance: number | undefined;
      let dx = 0,
        dy = 0,
        analog = false;
      if (!blocked.current) {
        const k = keys.current;
        dx =
          Number(k.has("d") || k.has("arrowright")) -
          Number(k.has("a") || k.has("arrowleft"));
        dy =
          Number(k.has("s") || k.has("arrowdown")) -
          Number(k.has("w") || k.has("arrowup"));
        if (!dx && !dy && (stick.current.x || stick.current.y)) {
          dx = stick.current.x;
          dy = stick.current.y;
          analog = true;
        }
        if (dx || dy) {
          if (path.current.length) {
            path.current = [];
            setTarget(null);
          }
        } else if (path.current.length) {
          const next = path.current[0],
            distance = Math.hypot(
              next.x - position.current.x,
              next.y - position.current.y,
            );
          if (distance < 0.05) {
            position.current = next;
            setPlayer(next);
            path.current.shift();
            if (!path.current.length) setTarget(null);
          } else {
            pathDistance = distance;
            dx = (next.x - position.current.x) / distance;
            dy = (next.y - position.current.y) / distance;
          }
        }
      }
      let changed = false;
      const length = Math.hypot(dx, dy);
      if (length && dt > 0) {
        const speed = keys.current.has("shift") ? 280 : 175,
          divisor = analog ? Math.max(1, length) : length;
        const travel = Math.min(speed * dt, pathDistance ?? Infinity);
        const next = movePlayerInSteps(
          position.current,
          (dx / divisor) * travel,
          (dy / divisor) * travel,
        );
        changed =
          next.x !== position.current.x || next.y !== position.current.y;
        if (changed) {
          position.current = next;
          setPlayer(next);
          if (dx) setFacing(dx < 0 ? -1 : 1);
        }
      }
      if (changed !== wasMoving) {
        wasMoving = changed;
        setMoving(changed);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        el.matches("input,select,textarea") ||
        el.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        blocked.current
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "shift",
        ].includes(key)
      ) {
        e.preventDefault();
        keys.current.add(key);
      }
      if (e.repeat) return;
      if (key === "[" || key === "]") {
        e.preventDefault();
        selectRef.current(key === "]" ? 1 : -1);
      }
      if (key === "c") {
        e.preventDefault();
        openRef.current("characters");
      }
      if (key === "h") {
        e.preventDefault();
        openRef.current("help");
      }
      if (key === "m") {
        e.preventDefault();
        openRef.current("map");
      }
      if (key === "escape" || key === "p") {
        e.preventDefault();
        openRef.current("pause");
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      path.current = [];
      setTarget(null);
      setRunning(false);
      setInputReset((v) => v + 1);
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    setSaved("saving");
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          saveKey,
          JSON.stringify({ ...game, player, activeCharacter: activeKey }),
        );
        setSaved("saved");
      } catch {
        setSaved("failed");
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [game, player, activeKey, saveKey]);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          saveKey,
          JSON.stringify({ ...state.current, player: position.current }),
        );
      } catch {
        setSaved("failed");
      }
    };
    const hidden = () => {
      if (document.hidden) save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hidden);
      clearTimeout(timer.current);
    };
  }, [saveKey]);
  const canFullscreen =
    typeof document.documentElement.requestFullscreen === "function" &&
    document.fullscreenEnabled;
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await sceneRef.current?.requestFullscreen();
    } catch {
      open("help");
    }
  };
  const filtered = game.crew.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const releaseRun = () => {
    keys.current.delete("shift");
    setRunning(false);
  };
  return (
    <main
      ref={sceneRef}
      className="play-screen"
      data-tv-look={tvLook}
      aria-label={`${title} game`}
    >
      <div className="game-content" inert={!!panel} aria-hidden={!!panel}>
        <div
          ref={viewportRef}
          className="world-viewport"
          data-testid="game-viewport"
        >
          <div className="world-layer">
            <Town
              camera={camera}
              player={player}
              moving={moving}
              facing={facing}
              crew={game.crew}
              activeKey={activeKey}
              target={target}
              townName={townName}
              paused={!!panel}
              onTalk={
                server
                  ? undefined
                  : (dialogue) => {
                      setConversation(dialogue);
                      open("talk");
                    }
              }
              onMove={(point) => {
                if (!blocked.current) walkTo(point);
              }}
              onSelect={(other) => {
                setInteraction({ actor: active, other });
                open("interact");
              }}
            />
          </div>
          {tvLook && (
            <div className="episode-treatment" aria-hidden="true">
              <div className="paper-grain" />
              <div className="broadcast-lines" />
              <div className="screen-shading" />
            </div>
          )}
        </div>
        <div className="game-hud">
          <header className="game-topbar">
            <button
              className="hud-player"
              onClick={() => open("characters")}
              aria-label="Choose character"
            >
              <span className="hud-avatar">
                <Portrait c={active} />
              </span>
              <span className="hud-player-info">
                <span className="hud-caption">{title.toUpperCase()}</span>
                <strong data-testid="active-character-name" aria-live="polite">
                  {active.name}
                </strong>
                <span className="hud-player-place">
                  <MapPin size={10} /> {townName}
                </span>
              </span>
              <span
                className={`hud-save ${saved === "failed" ? "failed" : ""}`}
                title={
                  saved === "failed"
                    ? "Save unavailable"
                    : "Saved on this device"
                }
                aria-label={
                  saved === "failed"
                    ? "Save unavailable"
                    : "Saved on this device"
                }
              />
            </button>
            <div className="hud-actions">
              <button
                className="hud-icon"
                aria-label="Town map"
                onClick={() => open("map")}
              >
                <Map size={21} />
              </button>
              {canFullscreen && (
                <button
                  className="hud-icon desktop-fullscreen"
                  aria-label="Fullscreen game"
                  onClick={() => void fullscreen()}
                >
                  <Maximize2 size={20} />
                </button>
              )}
              <button
                className="hud-icon"
                aria-label="Pause menu"
                onClick={() => open("pause")}
              >
                <Menu size={23} />
              </button>
            </div>
          </header>
          <div className="hud-location">
            <span>{townName.toUpperCase()} · FREE ROAM</span>
            <strong>{districtAt(player)}</strong>
            <span className="location-rule" />
          </div>
          <div className="hud-keytips" aria-hidden="true">
            <Keyboard size={15} />
            <span>
              <b>WASD</b> move <i>·</i> <b>Shift</b> run <i>·</i> click to walk
            </span>
          </div>
          <div className="hud-movement">
            <TouchJoystick
              disabled={!!panel}
              resetKey={`${activeKey}:${inputReset}`}
              onMove={setStick}
            />
          </div>
          <button
            className={`hold-run ${running ? "running" : ""}`}
            aria-label="Hold to run"
            aria-pressed={running}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              keys.current.add("shift");
              setRunning(true);
            }}
            onPointerUp={releaseRun}
            onPointerCancel={releaseRun}
            onLostPointerCapture={releaseRun}
          >
            <Zap size={24} />
            <span>RUN</span>
          </button>
          <button
            className="cast-button"
            aria-label="Choose characters"
            onClick={() => open("characters")}
          >
            <Users size={21} />
            <span>Characters</span>
            <kbd>C</kbd>
          </button>
        </div>
      </div>
      {toast && (
        <div className="game-toast" role="status">
          <Sparkles size={16} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {panel === "characters" && (
        <Modal
          title="Who’s taking a walk?"
          eyebrow="CHOOSE YOUR CHARACTER"
          className="game-modal character-picker-modal"
          onClose={() => setPanel(null)}
          wide
        >
          <label className="picker-search">
            <Search size={17} />
            <input
              autoComplete="off"
              aria-label="Find a character"
              placeholder="Find your character…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>{game.crew.length}</span>
          </label>
          <div
            className="picker-grid"
            role="group"
            aria-label="Character selection"
          >
            {filtered.map((c) => (
              <button
                key={c.id}
                className={`picker-character ${characterKey(c) === activeKey ? "selected" : ""}`}
                aria-label={`Play as ${c.name}`}
                aria-pressed={characterKey(c) === activeKey}
                onClick={() => choose(c)}
              >
                <span className="picker-portrait">
                  <Portrait c={c} />
                </span>
                <strong>{c.name}</strong>
                {characterKey(c) === activeKey && (
                  <span className="picker-check">
                    <Check size={14} />
                  </span>
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="picker-empty">No one by that name.</p>
            )}
          </div>
          <footer className="picker-footer">
            {studioAvailable() && (
              <button className="button primary" onClick={() => openStudio()}>
                <Sparkles size={16} /> Add / edit character
              </button>
            )}
            {!server && (
              <button className="button secondary" onClick={() => open("crew")}>
                <Pencil size={15} /> Character workshop
              </button>
            )}

            <span>Tap a cast member in town to fight or kiss.</span>
          </footer>
        </Modal>
      )}
      {panel === "map" && (
        <TownMap
          player={player}
          townName={townName}
          onClose={() => setPanel(null)}
          onWalk={(point) => {
            setPanel(null);
            walkTo(point);
          }}
        />
      )}
      {panel === "pause" && (
        <Modal
          title="Take a breather."
          eyebrow={title.toUpperCase()}
          className="game-modal pause-modal"
          onClose={() => setPanel(null)}
        >
          <div className="pause-actions">
            <button className="pause-resume" onClick={() => setPanel(null)}>
              <Play size={20} />
              <span>Resume game</span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => open("characters")}>
              <Users size={20} />
              <span>Choose character</span>
              <ChevronRight size={17} />
            </button>
            {studioAvailable() && (
              <button onClick={() => openStudio(activeKey)}>
                <Sparkles size={19} />
                <span>Add / edit character</span>
                <ChevronRight size={17} />
              </button>
            )}
            {!server && (
              <button onClick={() => open("crew")}>
                <Pencil size={19} />
                <span>Character workshop</span>
                <ChevronRight size={17} />
              </button>
            )}
            <button onClick={() => open("map")}>
              <Map size={20} />
              <span>Town map</span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => open("help")}>
              <CircleHelp size={20} />
              <span>Controls & iPhone fullscreen</span>
              <ChevronRight size={17} />
            </button>
            <button aria-label="Reset position" onClick={resetPosition}>
              <RotateCcw size={19} />
              <span>Back to town center</span>
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="game-setting">
            <div>
              <strong>TV episode look</strong>
              <p>Paper texture, warmer colors, and a soft TV finish.</p>
            </div>
            <button
              className={`game-switch ${tvLook ? "on" : ""}`}
              role="switch"
              aria-checked={tvLook}
              aria-label="TV episode look"
              onClick={() => setGame((g) => ({ ...g, tvLook: !tvLook }))}
            >
              <span />
            </button>
          </div>
          <label className="camera-setting">
            <span>
              Camera zoom <b>{zoom.toFixed(1)}×</b>
            </span>
            <input
              aria-label="Camera zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step="0.5"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        </Modal>
      )}
      {panel === "studio" && (
        <CharacterStudio
          gameId={server?.guildId || "mint"}
          initialCharacterId={studioCharacter}
          onClose={() => setPanel(null)}
          onPublished={(shared, characterId) => {
            sharedUpdatedAt.current = Date.parse(shared.updatedAt);
            const applied = readAppliedVersions();
            delete applied[characterId];
            setGame((current) => ({
              ...current,
              crew: server
                ? shared.characters
                : mergeStudioCrew(current.crew, shared, applied),
            }));
            if (!server) rememberAppliedVersions(shared);
            notify("Character saved. Choose them from Characters.");
          }}
        />
      )}
      {panel === "interact" && interaction && (
        <CharacterInteraction
          actor={interaction.actor}
          other={interaction.other}
          onClose={() => {
            setPanel(null);
            setInteraction(null);
          }}
          onPlay={(character) => {
            choose(character);
            setInteraction(null);
          }}
        />
      )}
      {panel === "talk" && conversation && (
        <ResidentDialogue
          conversation={conversation}
          onClose={() => {
            setPanel(null);
            setConversation(null);
          }}
        />
      )}
      {panel === "crew" && (
        <CrewEditor
          crew={game.crew}
          initialCharacterId={activeKey}
          onPlay={select}
          onChange={(crew) =>
            setGame((g) => ({
              ...g,
              crew,
              activeCharacter: crew.some(
                (c) => characterKey(c) === g.activeCharacter,
              )
                ? g.activeCharacter
                : characterKey(crew[0]),
            }))
          }
          onClose={() => setPanel(null)}
          notify={notify}
        />
      )}
      {panel === "help" && (
        <Modal
          title="You’ve got this."
          eyebrow="HOW TO PLAY"
          className="game-modal controls-modal"
          onClose={() => setPanel(null)}
        >
          <div className="game-help">
            <p>
              <Keyboard size={21} />
              <span>
                <strong>Keyboard</strong>WASD or arrows to walk. Hold Shift to
                run. [ and ] swap characters.
              </span>
            </p>
            <p>
              <Compass size={21} />
              <span>
                <strong>Mouse & touch</strong>Click or tap the ground to walk
                there. Tap a cast member for actions
                {server ? "." : ", or a resident to talk."}
              </span>
            </p>
            <p>
              <Zap size={21} />
              <span>
                <strong>On your phone</strong>Drag the thumbstick to move. Hold
                RUN with your other thumb to move faster. Portrait and landscape
                both work.
              </span>
            </p>
            <p>
              <Users size={21} />
              <span>
                <strong>Your cast</strong>Tap Characters to switch. C opens the
                picker, H opens controls, and Escape pauses.
              </span>
            </p>
            <div className="iphone-note">
              <Smartphone size={22} />
              <span>
                <strong>Full screen on iPhone</strong>In Safari, tap Share → Add
                to Home Screen. Open the game from that icon to hide Safari’s
                browser bars.
              </span>
            </div>
          </div>
          <button
            className="button primary full-width"
            onClick={() => setPanel(null)}
          >
            Back to the game <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </main>
  );
}
