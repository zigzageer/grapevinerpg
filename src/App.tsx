import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Keyboard,
  MapPin,
  Map as MapIcon,
  Maximize2,
  Menu,
  Pencil,
  Play,
  Plus,
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
  canStand,
  characterKey,
  createCrewMember,
  DEFAULT_CREW,
  loadSave,
  MINT_CREW_LIMIT,
  movePlayerInSteps,
  SAVE_KEY,
  START,
} from "./game/model";
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, followCamera } from "./game/camera";
import { findPath } from "./game/navigation";
import { Town, type TownFight } from "./components/Town";
import { ResidentDialogue } from "./components/TownLife";
import type { ResidentConversation } from "./game/town-life";
import { Portrait } from "./components/Character";
import { Modal } from "./components/Modal";
import { CharacterStudio } from "./components/CharacterStudio";
import { CharacterInteraction } from "./components/CharacterInteraction";
import { TownDuelNotice } from "./components/TownDuelNotice";
import {
  mergeStudioCrew,
  readAppliedVersions,
  rememberAppliedVersions,
  studioAvailable,
  studioRequest,
  type StudioGame,
} from "./game/studio";
import { mintStudioSeed } from "./game/studio-seed";
import { publicMintRoster, useTownPresence } from "./game/presence";
import {
  readTownDuels,
  requestTownDuel,
  type TownDuelAction,
} from "./game/town-duels";
import { CrewEditor } from "./components/CrewEditor";
import { TouchJoystick } from "./components/TouchJoystick";
import { TownMap } from "./components/TownMap";
import { TOWN_NAME, districtAt } from "./game/locations";
import { ServerLoader } from "./components/ServerLoader";
import {
  loadServerSave,
  parseServerGame,
  serverSaveKey,
  type ServerGame,
} from "./game/server";
import {
  parseServerTown,
  serverDistrictAt,
  type ServerTown,
} from "./game/server-town";
import sampleGame from "../examples/server-town/game.json";
import sampleTown from "../examples/server-town/town.json";
import grapevineTown from "./game/data/grapevine-town.json";
import { MatchReplay } from "./components/MatchReplay";
import { matchIdFromPath } from "./game/matches";

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
function loadDemo(saveKey = SAVE_KEY, town?: ServerTown): SaveGame {
  const saved = loadSave(
    saveKey,
    town?.walkArea,
    town?.spawn,
    town ? SAVE_KEY : undefined,
  );
  const crew = saved.crew.filter(
    (c) => c.preset || c.sprite || !["Friend 01", "Friend 02"].includes(c.name),
  );
  return {
    ...saved,
    crew,
    activeCharacter: crew.find((c) => c.id === saved.activeCharacter)?.id,
  };
}

export default function App() {
  const pathname = window.location.pathname;
  const matchId = matchIdFromPath(pathname);
  if (matchId) return <MatchReplay id={matchId} />;
  if (!studioAvailable() || /^\/mint\/?$/.test(pathname)) return <Game />;
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    /^\/grapevine\/?$/.test(pathname)
  )
    return (
      <Game town={parseServerTown(grapevineTown, grapevineTown.guildId)} />
    );
  if (/^\/town-preview\/?$/.test(pathname)) {
    const server: ServerGame = {
      ...sampleGame,
      version: 1,
      characters: DEFAULT_CREW.filter(
        (c) => c.kind === "mint" || c.preset,
      ).slice(0, 4),
    };
    return (
      <Game
        server={server}
        town={parseServerTown(sampleTown, server.guildId)}
        preview
      />
    );
  }
  return (
    <ServerLoader>
      {(server, town) => (
        <Game key={server?.guildId || "mint"} server={server} town={town} />
      )}
    </ServerLoader>
  );
}

function Game({
  server,
  town,
  preview = false,
}: {
  server?: ServerGame;
  town?: ServerTown;
  preview?: boolean;
}) {
  const clan = !!town && !server;
  const saveKey = preview
    ? "grapevine.town-preview.v1"
    : server
      ? serverSaveKey(server.guildId)
      : clan
        ? "grapevine.clan.v1"
        : SAVE_KEY;
  const versionScope = clan ? saveKey : undefined;
  const title = clan ? "Grapevine Clan" : server?.name || "Adventures of Mint";
  const townName = town?.name || server?.name || TOWN_NAME;
  const spawn = town?.spawn ?? START;
  const [game, setGame] = useState(() =>
      server ? loadServerSave(server, town, saveKey) : loadDemo(saveKey, town),
    ),
    [player, setPlayer] = useState<Point>(game.player);
  const [moving, setMoving] = useState(false),
    [facing, setFacing] = useState<-1 | 1>(1),
    [target, setTarget] = useState<Point | null>(null);
  const [openPanel, setPanel] = useState<Panel>(null),
    [search, setSearch] = useState("");
  const [pendingCharacterId, setPendingCharacterId] = useState<string>();
  const [selectionError, setSelectionError] = useState("");
  const selecting = useRef(false);
  const sharedUpdatedAt = useRef(0);
  const [publicCrew, setPublicCrew] = useState(
    () => server?.characters ?? mintStudioSeed.characters,
  );
  const [editorCharacter, setEditorCharacter] = useState<Character>();
  const [interaction, setInteraction] = useState<{
    actor: Character;
    other: Character;
    point: Point;
    opponentSessionId?: string;
  } | null>(null);
  const [localFighting, setLocalFighting] = useState(false);
  const [duelPending, setDuelPending] = useState(false);
  const sendingDuel = useRef(false);
  const [dismissedDuel, setDismissedDuel] = useState<string>();
  const [conversation, setConversation] = useState<ResidentConversation | null>(
    null,
  );
  const defaultZoom = clan ? 2 : DEFAULT_ZOOM;
  const [zoom, setZoom] = useState(defaultZoom),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState<"saved" | "failed">("saved"),
    [running, setRunning] = useState(false),
    [inputReset, setInputReset] = useState(0);
  const position = useRef(player),
    walkArea = useRef(town?.walkArea),
    lastWalkArea = useRef(town?.walkArea),
    keys = useRef(new Set<string>()),
    stick = useRef<Point>({ x: 0, y: 0 }),
    path = useRef<Point[]>([]),
    state = useRef(game),
    canSave = useRef(true),
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
    town,
  );
  const selectRef = useRef<(direction: number) => void>(() => {}),
    openRef = useRef<(p: Exclude<Panel, null>) => void>(() => {});
  const tvLook = game.tvLook !== false;
  const canUseStudio = !preview && studioAvailable();
  const publicRoster = useMemo(
    () => new Map(publicCrew.map((c) => [c.id, c])),
    [publicCrew],
  );
  const worldId = server?.guildId ?? (clan ? "grapevine" : "mint");
  const presenceWorldId = canUseStudio ? worldId : undefined;
  const savedCharacter = game.crew.find((c) => c.id === game.activeCharacter);
  const stop = useCallback(() => {
    keys.current.clear();
    stick.current = { x: 0, y: 0 };
    path.current = [];
    setTarget(null);
    setMoving(false);
    setRunning(false);
    setInputReset((v) => v + 1);
  }, []);
  const rejectSavedCharacter = (id: string) => {
    const c = state.current.crew.find((character) => character.id === id);
    stop();
    setGame((current) =>
      current.activeCharacter === id
        ? { ...current, activeCharacter: undefined }
        : current,
    );
    setPanel("characters");
    setSelectionError(
      `${c?.name ?? "That character"} is already playing in this town.`,
    );
  };
  const {
    players,
    connection,
    claim,
    release,
    claimedCharacterId,
    presenceCredentials,
    duelSnapshot,
    refresh,
    applyDuels,
  } = useTownPresence(
    presenceWorldId,
    { ...player, moving, facing },
    Boolean(openPanel || !savedCharacter || pendingCharacterId || duelPending),
    (id) => {
      if (state.current.activeCharacter === id) rejectSavedCharacter(id);
    },
  );
  const active =
    savedCharacter &&
    (!presenceWorldId ||
      !publicRoster.has(savedCharacter.id) ||
      claimedCharacterId === savedCharacter.id ||
      connection === "offline")
      ? savedCharacter
      : undefined;
  const activeKey = active?.id ?? "";
  const panel = openPanel ?? (active ? null : "characters");
  const townDuels = useMemo(() => readTownDuels(duelSnapshot), [duelSnapshot]);
  const myDuel = townDuels.own;
  const onlineFighting = myDuel?.status === "fighting";
  const fights = useMemo(() => {
    const markers: TownFight[] = [];
    for (const marker of townDuels.fights) {
      const [first, second] = marker.characterIds.map((id) =>
        publicRoster.get(id),
      );
      if (first && second)
        markers.push({ ...marker, fighters: [first, second] });
    }
    if (localFighting && interaction && !interaction.opponentSessionId) {
      markers.push({
        id: "local-fight",
        x: interaction.point.x,
        y: interaction.point.y,
        fighters: [interaction.actor, interaction.other],
      });
    }
    return markers;
  }, [townDuels.fights, publicRoster, localFighting, interaction]);
  const occupied = useMemo(
    () => new Set(players.map((p) => p.characterId)),
    [players],
  );
  const remotePlayers = useMemo(
    () =>
      players.flatMap((p) => {
        const character = publicRoster.get(p.characterId);
        return character && canStand(p, town?.walkArea)
          ? [{ ...p, character }]
          : [];
      }),
    [players, publicRoster, town?.walkArea],
  );
  walkArea.current = town?.walkArea;
  state.current = game;
  canSave.current = !savedCharacter || !!active;
  blocked.current = Boolean(panel || pendingCharacterId || onlineFighting);
  useEffect(() => {
    if (onlineFighting) stop();
  }, [onlineFighting, stop]);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  const select = async (c: Character, restoring = false) => {
    if (selecting.current || onlineFighting || sendingDuel.current)
      return false;
    const id = characterKey(c);
    const showError = (message: string) => {
      setSelectionError(message);
      if (!restoring && panel !== "characters") notify(message);
    };
    if (occupied.has(id)) {
      if (restoring) rejectSavedCharacter(id);
      else showError(`${c.name} is already playing in this town.`);
      return false;
    }
    stop();
    setSelectionError("");
    if (presenceWorldId && publicRoster.has(id)) {
      selecting.current = true;
      setPendingCharacterId(id);
      const result = await claim(id);
      selecting.current = false;
      setPendingCharacterId(undefined);
      if (result === "taken") {
        if (restoring) rejectSavedCharacter(id);
        else showError(`${c.name} is already playing in this town.`);
        return false;
      }
      if (result === "unavailable") {
        showError("Couldn’t connect to this town. Try again in a moment.");
        return false;
      }
      if (result === "offline") release();
    } else {
      release();
    }
    if (!state.current.crew.some((character) => character.id === id)) {
      release();
      return false;
    }
    setGame((g) => ({ ...g, activeCharacter: id }));
    return true;
  };
  const choose = async (c: Character) => {
    if (!(await select(c))) return false;
    setPanel(null);
    setSearch("");
    return true;
  };
  const restoreCharacter = useEffectEvent((c: Character) => {
    void select(c, true);
  });
  useEffect(() => {
    if (
      connection !== "online" ||
      !savedCharacter ||
      !publicRoster.has(savedCharacter.id) ||
      claimedCharacterId === savedCharacter.id ||
      selecting.current
    )
      return;
    restoreCharacter(savedCharacter);
  }, [connection, savedCharacter, publicRoster, claimedCharacterId]);
  useEffect(() => {
    if (
      !selecting.current &&
      claimedCharacterId &&
      (!savedCharacter || !publicRoster.has(savedCharacter.id))
    )
      release();
  }, [claimedCharacterId, savedCharacter, publicRoster, release]);
  selectRef.current = (direction) => {
    const crew = game.crew.filter((c) => !occupied.has(c.id));
    if (!crew.length) return;
    const i = crew.findIndex((c) => characterKey(c) === activeKey);
    void select(crew[(i + direction + crew.length) % crew.length]);
  };
  const open = useCallback(
    (p: Exclude<Panel, null>) => {
      stop();
      setPanel(p);
      setSearch("");
      setSelectionError("");
    },
    [stop],
  );
  openRef.current = open;
  const closeInteraction = () => {
    setPanel((current) => (current === "interact" ? null : current));
    setInteraction(null);
  };
  const actOnDuel = async (action: TownDuelAction) => {
    if (sendingDuel.current) return;
    const credentials = presenceCredentials();
    if (!credentials) {
      notify("Choose an available online character to fight.");
      return;
    }
    sendingDuel.current = true;
    setDuelPending(true);
    try {
      const snapshot = await requestTownDuel(credentials, action);
      const current = presenceCredentials();
      if (
        current?.sessionToken === credentials.sessionToken &&
        current.characterId === credentials.characterId
      )
        applyDuels(snapshot);
      if (action.action === "challenge") closeInteraction();
      if (action.action === "accept") stop();
      refresh();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The fight request failed.",
      );
    } finally {
      sendingDuel.current = false;
      setDuelPending(false);
    }
  };
  const openWorkshop = () => {
    setEditorCharacter(undefined);
    open("crew");
  };
  const editCharacter = (character: Character) => {
    setEditorCharacter(character);
    const inStudio =
      server ||
      character.sprite?.startsWith("/api/studio/assets/") ||
      DEFAULT_CREW.some(
        (c) =>
          c.id === character.id &&
          c.preset === character.preset &&
          (c.kind === "mint" || c.preset || c.sprite),
      );
    setPanel(canUseStudio && inStudio ? "studio" : "crew");
  };
  const addCharacter = () => {
    setSearch("");
    if (canUseStudio) {
      setEditorCharacter(undefined);
      setPanel("studio");
    } else if (game.crew.length < MINT_CREW_LIMIT) {
      const character = createCrewMember(game.crew.length);
      setGame((current) => ({
        ...current,
        crew: [...current.crew, character],
      }));
      setEditorCharacter(character);
      setPanel("crew");
    }
  };
  const walkTo = (point: Point) => {
    const route = findPath(position.current, point, walkArea.current);
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
    position.current = { ...spawn };
    setPlayer(position.current);
    setZoom(defaultZoom);
    setPanel(null);
  };
  useEffect(() => {
    const changed = lastWalkArea.current !== town?.walkArea;
    lastWalkArea.current = town?.walkArea;
    if (!changed && canStand(position.current, town?.walkArea)) return;
    stop();
    position.current = { ...spawn };
    setPlayer(position.current);
  }, [spawn, stop, town]);
  useEffect(() => {
    if (!server) return;
    setPublicCrew(server.characters);
    setGame((g) => ({
      ...g,
      crew: server.characters,
      activeCharacter: server.characters.some((c) => c.id === g.activeCharacter)
        ? g.activeCharacter
        : undefined,
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
        const updatedAt = Date.parse(shared.updatedAt);
        if (
          controller.signal.aborted ||
          shared.guildId !== "mint" ||
          !Number.isFinite(updatedAt) ||
          updatedAt <= sharedUpdatedAt.current ||
          !Array.isArray(shared.characters) ||
          shared.characters.length > MINT_CREW_LIMIT
        )
          return;
        const publicCharacters = publicMintRoster(shared.characters);
        if (publicCharacters.length !== shared.characters.length) return;
        sharedUpdatedAt.current = updatedAt;
        setPublicCrew(publicCharacters);
        const applied = readAppliedVersions(versionScope);
        setGame((current) => {
          const crew = mergeStudioCrew(current.crew, shared, applied);
          return crew === current.crew ? current : { ...current, crew };
        });
        rememberAppliedVersions(shared, versionScope);
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
  }, [server?.guildId, versionScope]);
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
          walkArea.current,
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
    if (!canSave.current) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          saveKey,
          JSON.stringify({ ...game, player, layoutGuildId: town?.guildId }),
        );
        setSaved("saved");
      } catch {
        setSaved("failed");
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [game, player, activeKey, saveKey, town?.guildId]);
  useEffect(() => {
    const save = () => {
      if (!canSave.current) return;
      try {
        localStorage.setItem(
          saveKey,
          JSON.stringify({
            ...state.current,
            player: position.current,
            layoutGuildId: town?.guildId,
          }),
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
  }, [saveKey, town?.guildId]);
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
              remotePlayers={remotePlayers}
              occupiedCharacterIds={occupied}
              fights={fights}
              townName={townName}
              serverTown={town}
              paused={!!panel}
              onTalk={
                server || town
                  ? undefined
                  : (dialogue) => {
                      setConversation(dialogue);
                      open("talk");
                    }
              }
              onMove={(point) => {
                if (!blocked.current) walkTo(point);
              }}
              onSelect={(other, point) => {
                if (!active || onlineFighting) return;
                setInteraction({ actor: active, other, point });
                open("interact");
              }}
              onSelectRemote={(opponentSessionId, other, point) => {
                if (!active || onlineFighting) return;
                setInteraction({
                  actor: active,
                  other,
                  point,
                  opponentSessionId,
                });
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
        <div className="game-hud" hidden={!active}>
          <header className="game-topbar">
            <button
              className="hud-player"
              onClick={() => open("characters")}
              aria-label="Choose character"
            >
              <span className="hud-avatar">
                {active && <Portrait c={active} />}
              </span>
              <span className="hud-player-info">
                <span className="hud-caption">{title.toUpperCase()}</span>
                <strong data-testid="active-character-name" aria-live="polite">
                  {active?.name}
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
                <MapIcon size={21} />
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
            <strong>
              {town ? serverDistrictAt(town, player) : districtAt(player)}
            </strong>
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
              disabled={!!panel || onlineFighting}
              resetKey={`${activeKey}:${inputReset}`}
              onMove={setStick}
            />
          </div>
          <button
            className={`hold-run ${running ? "running" : ""}`}
            aria-label="Hold to run"
            aria-pressed={running}
            disabled={onlineFighting}
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
      {!panel && active && myDuel && myDuel.id !== dismissedDuel && (
        <TownDuelNotice
          duel={myDuel}
          roster={publicRoster}
          pending={duelPending}
          onAction={(action) => void actOnDuel(action)}
          onDismiss={() => setDismissedDuel(myDuel.id)}
        />
      )}
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
          title={clan ? "Choose a clan member" : "Choose a character"}
          className="game-modal character-picker-modal"
          onClose={active ? () => setPanel(null) : undefined}
          wide
        >
          <div className="picker-toolbar">
            <label className="picker-search">
              <Search size={17} />
              <input
                autoComplete="off"
                aria-label="Find a character"
                placeholder="Find a character…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {!preview && (
              <button
                className="button primary picker-add"
                aria-label="Add character"
                title="Add character"
                disabled={!canUseStudio && game.crew.length >= MINT_CREW_LIMIT}
                onClick={addCharacter}
              >
                <Plus size={21} aria-hidden="true" />
              </button>
            )}
          </div>
          {(selectionError || pendingCharacterId) && (
            <p className="picker-status" role="status">
              {pendingCharacterId ? "Checking availability…" : selectionError}
            </p>
          )}
          <div
            className="picker-grid"
            role="group"
            aria-label="Character selection"
          >
            {filtered.map((c) => {
              const selected = c.id === activeKey;
              const taken = occupied.has(c.id);
              return (
                <div className="picker-card" key={c.id}>
                  <button
                    className={`picker-character ${selected ? "selected" : ""}`}
                    aria-label={`Play as ${c.name}`}
                    aria-description={
                      taken ? "Already playing in this town" : undefined
                    }
                    aria-pressed={selected}
                    disabled={taken || !!pendingCharacterId}
                    onClick={() => void choose(c)}
                  >
                    <span className="picker-portrait">
                      <Portrait c={c} />
                    </span>
                    <strong>{c.name}</strong>
                    {taken && <span className="picker-occupied">In use</span>}
                    {selected && (
                      <span className="picker-check">
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                  {!preview && (
                    <button
                      className="picker-edit"
                      aria-label={`Edit ${c.name}`}
                      title={`Edit ${c.name}`}
                      onClick={() => editCharacter(c)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
            {!filtered.length && (
              <p className="picker-empty">No one by that name.</p>
            )}
          </div>
          {!server && (
            <footer className="picker-footer">
              <button className="button secondary" onClick={openWorkshop}>
                <Pencil size={15} /> Character workshop
              </button>
            </footer>
          )}
        </Modal>
      )}
      {panel === "map" && (
        <TownMap
          player={player}
          townName={townName}
          serverTown={town}
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
            {!server && canUseStudio && (
              <a className="button secondary" href={clan ? "/mint" : "/"}>
                <MapPin size={18} />
                {clan ? "Visit Adventures of Mint" : "Visit Grapevine Clan"}
              </a>
            )}
            {!server && (
              <button onClick={openWorkshop}>
                <Pencil size={19} />
                <span>Character workshop</span>
                <ChevronRight size={17} />
              </button>
            )}
            <button onClick={() => open("map")}>
              <MapIcon size={20} />
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
          initialCharacter={editorCharacter}
          onClose={() => setPanel("characters")}
          onPublished={(shared, characterId) => {
            const publicCharacters = server
              ? parseServerGame(shared, server.guildId).characters
              : publicMintRoster(shared.characters);
            sharedUpdatedAt.current = Date.parse(shared.updatedAt);
            setPublicCrew(publicCharacters);
            const applied = readAppliedVersions(versionScope);
            delete applied[characterId];
            setGame((current) => ({
              ...current,
              crew: server
                ? publicCharacters
                : mergeStudioCrew(current.crew, shared, applied),
            }));
            if (!server) {
              rememberAppliedVersions(shared, versionScope);
            }
            notify("Character saved.");
          }}
        />
      )}
      {panel === "interact" && interaction && (
        <CharacterInteraction
          actor={interaction.actor}
          other={interaction.other}
          crew={game.crew}
          challengePending={duelPending}
          onChallenge={
            interaction.opponentSessionId
              ? () => {
                  const opponentSessionId = interaction.opponentSessionId;
                  if (opponentSessionId)
                    void actOnDuel({ action: "challenge", opponentSessionId });
                }
              : undefined
          }
          onFightingChange={setLocalFighting}
          onClose={closeInteraction}
          onPlay={async (character) => {
            if (await choose(character)) setInteraction(null);
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
          initialCharacterId={editorCharacter?.id ?? activeKey}
          onPlay={select}
          onChange={(crew) =>
            setGame((g) => ({
              ...g,
              crew,
              activeCharacter: crew.some(
                (c) => characterKey(c) === g.activeCharacter,
              )
                ? g.activeCharacter
                : undefined,
            }))
          }
          onClose={() => setPanel(editorCharacter ? "characters" : null)}
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
                {server || town ? "." : ", or a resident to talk."}
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
