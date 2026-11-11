import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CircleHelp,
  Compass,
  Keyboard,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Character, Point, SaveGame } from "./game/model";
import {
  characterKey,
  loadSave,
  movePlayer,
  SAVE_KEY,
  START,
} from "./game/model";
import { characterArtUrl } from "./game/art";
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, followCamera } from "./game/camera";
import { findPath } from "./game/navigation";
import { Town } from "./components/Town";
import { Portrait } from "./components/Character";
import { Modal } from "./components/Modal";
import { CrewEditor } from "./components/CrewEditor";

const TAGLINES: Partial<Record<NonNullable<Character["preset"]>, string>> = {
  "baguette-guy": "Baguette in hand",
  "flag-girl": "Muscles & a mission",
  david: "Still missing Grace",
  ghost: "Book & bread in hand",
  rocky: "Hat, coat & an IDF vest",
  miel: "Bunny ears & rosé",
  zippy: "Short & strong",
  jat: "Flag shirt. Asuka mug.",
  loralei: "Dressed to make an entrance",
  samira: "A very bold look",
  genesis: "Always with his puppy",
  kain: "A frog in a three-piece suit",
  footjobofsteel: "One very strong bear",
};
function loadDemo(): SaveGame {
  const saved = loadSave();
  // Retire untouched story placeholders; keep any friends the user customized.
  const crew = saved.crew.filter(
    (c) => c.preset || c.sprite || !["Friend 01", "Friend 02"].includes(c.name),
  );
  return { ...saved, crew };
}
export default function App() {
  const [game, setGame] = useState(loadDemo);
  const [player, setPlayer] = useState<Point>(game.player);
  const [moving, setMoving] = useState(false),
    [facing, setFacing] = useState(1),
    [target, setTarget] = useState<Point | null>(null);
  const [panel, setPanel] = useState<"crew" | "help" | null>(null),
    [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState<"saved" | "saving" | "failed">("saved");
  const position = useRef(player),
    keys = useRef(new Set<string>()),
    path = useRef<Point[]>([]),
    state = useRef(game),
    blocked = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [aspectRatio, setAspectRatio] = useState(14 / 9);
  const camera = followCamera(player, aspectRatio, zoom);
  const sceneRef = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectRef = useRef<(direction: number) => void>(() => {}),
    openRef = useRef<(p: "crew" | "help") => void>(() => {});
  const active =
    game.crew.find((c) => characterKey(c) === game.activeCharacter) ||
    game.crew[0];
  const activeKey = characterKey(active);
  state.current = game;
  blocked.current = !!panel;
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const stop = useCallback(() => {
    keys.current.clear();
    path.current = [];
    setTarget(null);
    setMoving(false);
  }, []);
  const select = useCallback(
    (c: Character) => {
      stop();
      setGame((prev) => ({ ...prev, activeCharacter: characterKey(c) }));
    },
    [stop],
  );
  selectRef.current = (direction) => {
    const i = game.crew.findIndex((c) => characterKey(c) === activeKey);
    select(game.crew[(i + direction + game.crew.length) % game.crew.length]);
  };
  const open = useCallback(
    (p: "crew" | "help") => {
      stop();
      setPanel(p);
    },
    [stop],
  );
  openRef.current = open;
  const walkTo = (point: Point) => {
    if (blocked.current) return;
    const route = findPath(position.current, point);
    if (!route.length) {
      notify("That way is blocked. Try the path around it.");
      return;
    }
    path.current = route;
    setTarget(route[route.length - 1]);
  };
  const resetPosition = () => {
    stop();
    position.current = { ...START };
    setPlayer({ ...START });
    setZoom(DEFAULT_ZOOM);
  };
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (width > 0 && height > 0) setAspectRatio(width / height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let frame = 0,
      last = 0,
      wasMoving = false;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      let dx = 0,
        dy = 0;
      if (!blocked.current) {
        const k = keys.current;
        dx =
          Number(k.has("d") || k.has("arrowright")) -
          Number(k.has("a") || k.has("arrowleft"));
        dy =
          Number(k.has("s") || k.has("arrowdown")) -
          Number(k.has("w") || k.has("arrowup"));
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
          if (distance < 5) {
            path.current.shift();
            if (!path.current.length) setTarget(null);
          } else {
            dx = (next.x - position.current.x) / distance;
            dy = (next.y - position.current.y) / distance;
          }
        }
      }
      let changed = false;
      const length = Math.hypot(dx, dy);
      if (length && dt > 0) {
        const speed = keys.current.has("shift") ? 280 : 175;
        const next = movePlayer(
          position.current,
          (dx / length) * speed * dt,
          (dy / length) * speed * dt,
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
        openRef.current("crew");
      }
      if (key === "h") {
        e.preventDefault();
        openRef.current("help");
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => {
      keys.current.clear();
      path.current = [];
      setTarget(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    setSaved("saving");
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({ ...game, player, activeCharacter: activeKey }),
        );
        setSaved("saved");
      } catch {
        setSaved("failed");
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [game, player, activeKey]);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({ ...state.current, player: position.current }),
        );
      } catch {
        setSaved("failed");
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      clearTimeout(timer.current);
    };
  }, []);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await sceneRef.current?.requestFullscreen();
    } catch {
      notify("Fullscreen isn’t available in this browser.");
    }
  };
  const filtered = game.crew.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell demo-app">
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
          aria-label="Adventures of Mint home"
        >
          <span className="brand-mark">
            <img src={characterArtUrl("mint")} alt="" />
          </span>
          <div>
            <strong>
              adventures of <b>mint.</b>
            </strong>
            <span>A LITTLE MINT. A BIG WORLD.</span>
          </div>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={`nav-link ${!panel ? "active" : ""}`}
            onClick={() => setPanel(null)}
          >
            <Compass size={17} /> Play demo
          </button>
          <button
            className={`nav-link ${panel === "crew" ? "active" : ""}`}
            onClick={() => open("crew")}
          >
            <Users size={17} /> Character workshop
          </button>
          <button
            className={`nav-link ${panel === "help" ? "active" : ""}`}
            onClick={() => open("help")}
          >
            <Keyboard size={17} /> Controls
          </button>
        </nav>
        <span
          className={`save-status ${saved === "failed" ? "save-error" : ""}`}
        >
          <span />
          {saved === "saved"
            ? "Saved locally"
            : saved === "saving"
              ? "Saving…"
              : "Save unavailable"}
        </span>
      </header>
      <main className="main-content">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">
              <span className="tiny-spark">✳</span> THE FREE-ROAM DEMO
            </p>
            <h1>
              Pick your character. <span>Make yourself at home.</span>
            </h1>
            <p>
              A town full of familiar faces. Just choose someone and take a
              walk.
            </p>
          </div>
          <div className="welcome-actions">
            <span className="prototype-label">
              <span /> {game.crew.length} CHARACTERS · ONE LITTLE TOWN
            </span>
            <button className="button secondary" onClick={() => open("crew")}>
              <Users size={16} /> Edit your cast <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <div className="game-layout demo-layout">
          <aside className="sidebar">
            <section className="demo-selected">
              <span className="eyebrow">YOU’RE PLAYING AS</span>
              <Portrait c={active} />
              <h2 aria-live="polite">{active.name}</h2>
              <p>
                {active.preset
                  ? TAGLINES[active.preset]
                  : "The little mint who started it all."}
              </p>
              <div className="demo-cycle">
                <button
                  aria-label="Previous character"
                  onClick={() => selectRef.current(-1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span>SWAP ANYTIME</span>
                <button
                  aria-label="Next character"
                  onClick={() => selectRef.current(1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <section className="crew-card demo-cast">
              <div className="section-caption">
                <span>CHOOSE YOUR CHARACTER</span>
                <span>{game.crew.length}</span>
              </div>
              <label className="cast-search">
                <Search size={13} />
                <input
                  aria-label="Find a character"
                  placeholder="Find a character…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div
                className="crew-roster demo-roster"
                role="group"
                aria-label="Character selection"
              >
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    className={`crew-member ${characterKey(c) === activeKey ? "chosen" : ""}`}
                    aria-label={`Play as ${c.name}`}
                    aria-pressed={characterKey(c) === activeKey}
                    onClick={() => select(c)}
                  >
                    <span className="crew-avatar">
                      <Portrait c={c} />
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.preset
                          ? TAGLINES[c.preset]
                          : "The original little guy"}
                      </small>
                    </span>
                    {characterKey(c) === activeKey ? <Check size={14} /> : null}
                  </button>
                ))}
                {!filtered.length && (
                  <p className="empty-search">No characters by that name.</p>
                )}
              </div>
              <button className="add-friend" onClick={() => open("crew")}>
                <Plus size={14} /> Open character workshop
              </button>
            </section>
          </aside>
          <section className="game-column" aria-label="Free-roam game">
            <div className="scene-frame" ref={sceneRef}>
              <div className="scene-top">
                <div className="location-badge">
                  <span className="location-icon">
                    <MapPin size={17} />
                  </span>
                  <div>
                    <span>FREE ROAM</span>
                    <strong>Downtown Grapevine</strong>
                  </div>
                </div>
                <span className="scene-button demo-live">
                  <span className="live-dot" /> FOLLOWING{" "}
                  {active.name.toUpperCase()}
                </span>
              </div>
              <div className="scene-clip" ref={viewportRef}>
                <div className="scene-world">
                  <Town
                    camera={camera}
                    player={player}
                    moving={moving}
                    facing={facing}
                    crew={game.crew}
                    activeKey={activeKey}
                    target={target}
                    onMove={walkTo}
                    onSelect={select}
                  />
                </div>
              </div>
              <div className="scene-bottom">
                <div className="town-time">
                  <span className="sun-icon">☀</span>
                  <div>
                    <strong>A very ordinary afternoon</strong>
                    <span>Grapevine · Free-roam demo</span>
                  </div>
                </div>
                <div className="scene-controls">
                  <button
                    className="scene-button square"
                    aria-label="Zoom out"
                    disabled={zoom <= MIN_ZOOM}
                    onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))}
                  >
                    <Minus size={17} />
                  </button>
                  <button
                    className="scene-button square"
                    aria-label="Zoom in"
                    disabled={zoom >= MAX_ZOOM}
                    onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
                  >
                    <Plus size={17} />
                  </button>
                  <button
                    className="scene-button square"
                    aria-label="Fullscreen game"
                    onClick={() => void fullscreen()}
                  >
                    <Maximize2 size={17} />
                  </button>
                </div>
              </div>
              <div
                className="touch-controls"
                aria-label="Touch movement controls"
              >
                {[
                  { key: "w", label: "Move up", Icon: ArrowUp },
                  { key: "a", label: "Move left", Icon: ArrowLeft },
                  { key: "s", label: "Move down", Icon: ArrowDown },
                  { key: "d", label: "Move right", Icon: ArrowRight },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    className={`touch-${key}`}
                    aria-label={label}
                    onPointerDown={(e) => {
                      if (blocked.current) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      keys.current.add(key);
                    }}
                    onPointerUp={() => keys.current.delete(key)}
                    onLostPointerCapture={() => keys.current.delete(key)}
                  >
                    <Icon size={19} />
                  </button>
                ))}
              </div>
            </div>
            <div className="game-toolbar">
              <div className="keyboard-hints">
                <span className="key-group">
                  <kbd>W</kbd>
                  <span>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd>
                  </span>
                </span>
                <span>
                  Move<span className="hint-or"> / </span>click to walk
                </span>
                <span className="toolbar-divider" />
                <kbd>[</kbd>
                <kbd>]</kbd>
                <span>Swap character</span>
              </div>
              <div className="toolbar-buttons">
                <button onClick={resetPosition} aria-label="Reset position">
                  <RotateCcw size={17} />
                  <span>Back to center</span>
                </button>
                <button onClick={() => open("help")} aria-label="How to play">
                  <CircleHelp size={18} />
                </button>
              </div>
            </div>
            <div className="under-game">
              <span>
                <span className="live-dot" /> Click anyone in town to play as
                them.
              </span>
              <button onClick={() => open("crew")}>
                Your whole cast is here <ArrowUpRight size={14} />
              </button>
            </div>
            <section className="demo-instructions">
              <span>
                <Keyboard size={16} /> WASD / arrows to walk
              </span>
              <span>
                <Compass size={16} /> Click or tap to move
              </span>
              <span>
                <Users size={16} /> Choose anyone. Swap anytime.
              </span>
            </section>
          </section>
        </div>
        <footer className="site-footer">
          <span>
            <span className="footer-candy">✳</span> ADVENTURES OF MINT{" "}
            <span className="footer-dot">·</span> THE FREE-ROAM DEMO
          </span>
          <span>The story can wait. Have a wander.</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
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
          title="Choose a face. Take a walk."
          eyebrow="THE FREE-ROAM DEMO"
          onClose={() => setPanel(null)}
        >
          <p className="modal-intro">
            Pick anyone from the cast on the left, or click a character standing
            in town. You can switch at any time and keep walking from the same
            spot.
          </p>
          <div className="help-list">
            <div>
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </span>
              <p>Walk around. Arrow keys work too. Hold Shift to run.</p>
            </div>
            <div>
              <span>
                <Compass size={22} />
              </span>
              <p>
                The camera follows your character. Click or tap the ground to
                walk there. Mint and friends find a path around obstacles.
              </p>
            </div>
            <div>
              <span>
                <kbd>[</kbd>
                <kbd>]</kbd>
              </span>
              <p>Switch to the previous or next character.</p>
            </div>
            <div>
              <span>
                <kbd>C</kbd>
                <kbd>H</kbd>
              </span>
              <p>Open the character workshop or this controls panel.</p>
            </div>
          </div>
          <div className="story-note">
            <Users size={20} />
            <p>
              All {game.crew.length} characters are playable. Names, custom
              sprites, the selected character, and your position save in this
              browser.
            </p>
          </div>
          <button
            className="button primary full-width"
            onClick={() => setPanel(null)}
          >
            Let’s wander <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
